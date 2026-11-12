//! Note onset detection with log-compressed spectral flux (ADR 0010).
//!
//! Each hop, the magnitude spectrum of the last ~20 ms is compared with the
//! previous one; new energy appearing across the spectrum ("flux") marks an
//! attack. Unlike a plain volume rise, this also catches a string picked
//! again while it is still ringing. Used for timing (calibration, practice).

use std::collections::VecDeque;
use std::sync::Arc;

use rustfft::num_complex::Complex;
use rustfft::{Fft, FftPlanner};

/// Analysis window length, seconds (rounded up to a power of two in samples).
pub const FRAME_SECS: f64 = 0.04;
/// Hops per frame (hop = frame / 4 ≈ 5 ms).
const HOPS_PER_FRAME: usize = 4;
/// A frame must be at least this loud (RMS, dBFS) to start an onset.
pub const GATE_DB: f32 = -45.0;
/// Log compression strength: `ln(1 + LOG_COMPRESSION * magnitude)`.
const LOG_COMPRESSION: f32 = 100.0;
/// Flux must exceed `THRESHOLD_RATIO * recent mean + THRESHOLD_OFFSET`.
const THRESHOLD_RATIO: f32 = 1.5;
const THRESHOLD_OFFSET: f32 = 0.01;
/// Number of past hops averaged for the adaptive threshold (~100 ms).
const THRESHOLD_HOPS: usize = 20;
/// Frequency band of the flux, Hz. Below MIN, a low note's fundamental
/// spans less than two cycles of the window and its magnitude wobbles from
/// frame to frame (false onsets); above MAX is mostly noise.
const MIN_FLUX_HZ: f32 = 250.0;
const MAX_FLUX_HZ: f32 = 8000.0;
/// Minimum time between two onsets, seconds. A sixteenth at 200 BPM is 75 ms.
pub const REFRACTORY_SECS: f64 = 0.05;
/// Onsets are refined in blocks of this length, seconds.
const REFINE_BLOCK_SECS: f64 = 0.001;
/// Blocks before a candidate that form its "before" level.
const REFINE_BASELINE_BLOCKS: usize = 4;

/// Streaming onset detector for one mono signal.
pub struct OnsetDetector {
    frame: usize,
    hop: usize,
    sample_rate: u32,
    fft: Arc<dyn Fft<f32>>,
    window: Vec<f32>,
    /// Bins used for the flux (min_bin..=max_bin).
    min_bin: usize,
    max_bin: usize,
    /// The most recent samples (frame + refine margin), oldest first.
    history: VecDeque<f32>,
    /// Absolute frame index of `history[0]`.
    /// May be negative: the history starts pre-filled with silence.
    history_start: i64,
    pending_hop: usize,
    spectrum: Vec<Complex<f32>>,
    scratch: Vec<Complex<f32>>,
    previous_log: Vec<f32>,
    has_previous: bool,
    recent_flux: VecDeque<f32>,
    /// Last two hops' flux and loudness, for 1-hop-delayed peak picking.
    last_flux: f32,
    before_last_flux: f32,
    last_loud: bool,
    /// Absolute frame index of the end of the last analysed frame.
    last_frame_end: u64,
    refractory_frames: u64,
    gate_energy: f32,
    last_onset: Option<u64>,
}

impl OnsetDetector {
    /// `first_frame` is the absolute frame index of the first sample that will
    /// be pushed; reported onsets use the same frame numbering.
    pub fn new(sample_rate: u32, first_frame: u64) -> Self {
        let frame = ((sample_rate as f64 * FRAME_SECS) as usize).next_power_of_two();
        let hop = frame / HOPS_PER_FRAME;
        let fft = FftPlanner::new().plan_fft_forward(frame);
        let window = (0..frame)
            .map(|n| {
                let x = std::f32::consts::PI * n as f32 / frame as f32;
                x.sin() * x.sin()
            })
            .collect();
        let bin_hz = sample_rate as f32 / frame as f32;
        let max_bin = ((MAX_FLUX_HZ / bin_hz) as usize).clamp(1, frame / 2);
        let min_bin = ((MIN_FLUX_HZ / bin_hz).ceil() as usize).clamp(1, max_bin);
        let gate_rms = 10f32.powf(GATE_DB / 20.0);
        // Room to look back over a whole frame (plus a hop) when refining.
        let history = 2 * frame;
        Self {
            frame,
            hop,
            sample_rate,
            scratch: vec![Complex::default(); fft.get_inplace_scratch_len()],
            fft,
            window,
            min_bin,
            max_bin,
            history: std::iter::repeat_n(0.0, history).collect(),
            history_start: first_frame as i64 - history as i64,
            pending_hop: 0,
            spectrum: vec![Complex::default(); frame],
            previous_log: vec![0.0; max_bin + 1],
            has_previous: false,
            recent_flux: VecDeque::with_capacity(THRESHOLD_HOPS),
            last_flux: 0.0,
            before_last_flux: 0.0,
            last_loud: false,
            last_frame_end: first_frame,
            refractory_frames: (sample_rate as f64 * REFRACTORY_SECS) as u64,
            gate_energy: gate_rms * gate_rms,
            last_onset: None,
        }
    }

    /// Push consecutive mono samples; frame indices of detected onsets are
    /// appended to `onsets`.
    pub fn push(&mut self, samples: &[f32], onsets: &mut Vec<u64>) {
        for &s in samples {
            self.history.pop_front();
            self.history.push_back(s);
            self.history_start += 1;
            self.pending_hop += 1;
            if self.pending_hop == self.hop {
                self.pending_hop = 0;
                if let Some(onset) = self.analyze() {
                    onsets.push(onset);
                }
            }
        }
    }

    fn analyze(&mut self) -> Option<u64> {
        let frame_end = (self.history_start + self.history.len() as i64).max(0) as u64;
        let offset = self.history.len() - self.frame;
        let mut energy = 0.0f32;
        for (i, (dst, w)) in self.spectrum.iter_mut().zip(&self.window).enumerate() {
            let s = self.history[offset + i];
            energy += s * s;
            *dst = Complex::new(s * w, 0.0);
        }
        let loud = energy / self.frame as f32 >= self.gate_energy;
        self.fft
            .process_with_scratch(&mut self.spectrum, &mut self.scratch);

        // Magnitudes normalised so a full-scale sine peaks near 1.
        let norm = 4.0 / self.frame as f32;
        let mut flux = 0.0f32;
        for k in self.min_bin..=self.max_bin {
            let log = (1.0 + LOG_COMPRESSION * self.spectrum[k].norm() * norm).ln();
            if self.has_previous {
                flux += (log - self.previous_log[k]).max(0.0);
            }
            self.previous_log[k] = log;
        }
        self.has_previous = true;
        flux /= (self.max_bin - self.min_bin + 1) as f32;

        // Peak picking, one hop late: the previous hop is an onset if it is a
        // local maximum above the adaptive threshold.
        let mean = if self.recent_flux.is_empty() {
            0.0
        } else {
            self.recent_flux.iter().sum::<f32>() / self.recent_flux.len() as f32
        };
        let candidate = self.last_flux;
        let is_peak = candidate > self.before_last_flux && candidate >= flux;
        let above = candidate > THRESHOLD_RATIO * mean + THRESHOLD_OFFSET;
        let candidate_end = self.last_frame_end;
        // The refractory period is measured between refined onset times.
        let onset = (is_peak && above && self.last_loud)
            .then(|| self.refine(candidate_end))
            .filter(|&onset| {
                self.last_onset
                    .is_none_or(|last| onset >= last + self.refractory_frames)
            });
        if onset.is_some() {
            self.last_onset = onset;
        }

        if self.recent_flux.len() == THRESHOLD_HOPS {
            self.recent_flux.pop_front();
        }
        self.recent_flux.push_back(candidate);
        self.before_last_flux = candidate;
        self.last_flux = flux;
        self.last_loud = loud;
        self.last_frame_end = frame_end;
        onset
    }

    /// The flux peaks once the attack is inside the frame ending at
    /// `frame_end`. Look back over that frame (and the hop before it) in
    /// short blocks of high-passed energy and place the onset at the block
    /// with the largest jump over the blocks just before it: the start of the
    /// new attack, even if a previous note is still ringing.
    fn refine(&self, frame_end: u64) -> u64 {
        let block = ((self.sample_rate as f64 * REFINE_BLOCK_SECS) as usize).max(1);
        let span = self.frame + self.hop;
        let end = (frame_end as i64 - self.history_start) as usize;
        let begin = end.saturating_sub(span).max(1);
        let energies: Vec<f32> = (begin..end)
            .step_by(block)
            .map(|b| {
                (b..(b + block).min(end))
                    .map(|i| {
                        let d = self.history[i] - self.history[i - 1];
                        d * d
                    })
                    .sum::<f32>()
                    + 1e-12
            })
            .collect();
        let best = (REFINE_BASELINE_BLOCKS..energies.len())
            .max_by(|&a, &b| {
                let score = |j: usize| {
                    let before = energies[j - REFINE_BASELINE_BLOCKS..j].iter().sum::<f32>()
                        / REFINE_BASELINE_BLOCKS as f32;
                    (energies[j] / before).ln()
                };
                score(a).total_cmp(&score(b))
            })
            .unwrap_or(0);
        (self.history_start + (begin + best * block) as i64).max(0) as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    const SR: u32 = 48_000;

    /// Silence with decaying 220 Hz plucks starting at the given frames.
    fn plucks(len: usize, starts: &[usize], amplitude: f32) -> Vec<f32> {
        let mut out = vec![0.0; len];
        for &start in starts {
            for (i, s) in out[start..].iter_mut().enumerate() {
                let t = i as f32 / SR as f32;
                *s += amplitude * (-t * 6.0).exp() * (TAU * 220.0 * t).sin();
            }
        }
        out
    }

    /// A ringing string re-picked at `starts`: each pick restarts the string
    /// (harmonics back to full), the previous note stops.
    fn repicked(len: usize, starts: &[usize], hz: f32) -> Vec<f32> {
        let mut out = vec![0.0; len];
        for (k, &start) in starts.iter().enumerate() {
            let end = starts.get(k + 1).copied().unwrap_or(len);
            for (i, s) in out[start..end].iter_mut().enumerate() {
                let t = i as f32 / SR as f32;
                let attack = (t / 0.002).min(1.0);
                *s = 0.4
                    * attack
                    * (1..=8)
                        .map(|h| {
                            let h = h as f32;
                            (-t * h / 2.5).exp() * (TAU * hz * h * t).sin() / h
                        })
                        .sum::<f32>();
            }
        }
        out
    }

    fn detect(signal: &[f32]) -> Vec<u64> {
        let mut d = OnsetDetector::new(SR, 0);
        let mut onsets = Vec::new();
        // Feed in odd-sized chunks, like audio callbacks do.
        for chunk in signal.chunks(441) {
            d.push(chunk, &mut onsets);
        }
        onsets
    }

    fn assert_close(onsets: &[u64], starts: &[usize], max_ms: f64) {
        assert_eq!(onsets.len(), starts.len(), "{onsets:?} vs {starts:?}");
        for (onset, start) in onsets.iter().zip(starts) {
            let err_ms = (*onset as f64 - *start as f64) / SR as f64 * 1000.0;
            assert!(
                err_ms.abs() < max_ms,
                "onset {onset} vs {start}: {err_ms:.2} ms"
            );
        }
    }

    #[test]
    fn finds_each_pluck_within_2ms() {
        let starts = [4_800, 36_000, 67_123, 100_000];
        assert_close(&detect(&plucks(130_000, &starts, 0.5)), &starts, 2.0);
    }

    #[test]
    fn finds_repicked_ringing_notes() {
        // Sixteenths at 160 BPM (93.75 ms apart) on a sustaining low E.
        let gap = (SR as f64 * 0.09375) as usize;
        let starts: Vec<usize> = (0..16).map(|k| 4_800 + k * gap).collect();
        let signal = repicked(4_800 + 17 * gap, &starts, 82.41);
        assert_close(&detect(&signal), &starts, 3.0);
    }

    #[test]
    fn ignores_quiet_signal() {
        assert!(detect(&plucks(48_000, &[4_800], 0.002)).is_empty());
    }

    #[test]
    fn sustained_tone_is_one_onset() {
        let mut signal = vec![0.0; 4_800];
        signal.extend((0..48_000).map(|i| 0.3 * (TAU * 110.0 * i as f32 / SR as f32).sin()));
        assert_eq!(detect(&signal).len(), 1);
    }

    #[test]
    fn respects_first_frame_offset() {
        let mut d = OnsetDetector::new(SR, 1_000_000);
        let mut onsets = Vec::new();
        d.push(&plucks(20_000, &[4_800], 0.5), &mut onsets);
        assert_eq!(onsets.len(), 1);
        assert!((onsets[0] as i64 - 1_004_800).abs() < 96, "{onsets:?}");
    }
}
