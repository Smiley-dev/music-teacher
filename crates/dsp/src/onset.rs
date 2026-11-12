//! Note onset detection from sudden rises in signal energy.
//!
//! Used for timing (calibration, later Practice). Faster and more precise
//! than waiting for a stable pitch.

use std::collections::VecDeque;

/// Analysis hop length in seconds.
pub const HOP_SECS: f64 = 0.005;
/// A hop must be at least this loud (RMS, dBFS) to start an onset.
pub const GATE_DB: f32 = -45.0;
/// Energy must jump by this factor over the recent average (4x = +6 dB).
pub const RISE_RATIO: f32 = 4.0;
/// Number of previous hops averaged as the baseline (4 x 5 ms = 20 ms).
pub const HISTORY_HOPS: usize = 4;
/// Minimum time between two onsets, in seconds.
pub const REFRACTORY_SECS: f64 = 0.1;
/// Within the triggering hop, the onset is the first sample at or above this
/// fraction of the hop's peak.
const REFINE_FRACTION: f32 = 0.5;

/// Streaming onset detector for one mono signal.
pub struct OnsetDetector {
    hop: usize,
    refractory_frames: u64,
    gate_energy: f32,
    hop_buf: Vec<f32>,
    /// Absolute frame index of `hop_buf[0]`.
    hop_start: u64,
    history: VecDeque<f32>,
    last_onset: Option<u64>,
}

impl OnsetDetector {
    /// `first_frame` is the absolute frame index of the first sample that will
    /// be pushed; reported onsets use the same frame numbering.
    pub fn new(sample_rate: u32, first_frame: u64) -> Self {
        let hop = ((sample_rate as f64 * HOP_SECS) as usize).max(1);
        let gate_rms = 10f32.powf(GATE_DB / 20.0);
        Self {
            hop,
            refractory_frames: (sample_rate as f64 * REFRACTORY_SECS) as u64,
            gate_energy: gate_rms * gate_rms,
            hop_buf: Vec::with_capacity(hop),
            hop_start: first_frame,
            history: VecDeque::with_capacity(HISTORY_HOPS),
            last_onset: None,
        }
    }

    /// Push consecutive mono samples; frame indices of detected onsets are
    /// appended to `onsets`.
    pub fn push(&mut self, samples: &[f32], onsets: &mut Vec<u64>) {
        for &s in samples {
            self.hop_buf.push(s);
            if self.hop_buf.len() == self.hop {
                if let Some(onset) = self.analyze_hop() {
                    onsets.push(onset);
                }
                self.hop_start += self.hop as u64;
                self.hop_buf.clear();
            }
        }
    }

    fn analyze_hop(&mut self) -> Option<u64> {
        let energy = self.hop_buf.iter().map(|s| s * s).sum::<f32>() / self.hop as f32;
        let baseline = if self.history.is_empty() {
            0.0
        } else {
            self.history.iter().sum::<f32>() / self.history.len() as f32
        };
        if self.history.len() == HISTORY_HOPS {
            self.history.pop_front();
        }
        self.history.push_back(energy);

        let loud = energy >= self.gate_energy;
        // A floor keeps tiny noise baselines from making any sound an onset
        // while still letting a note out of silence trigger.
        let rising = energy >= RISE_RATIO * baseline.max(self.gate_energy / RISE_RATIO);
        let ready = self
            .last_onset
            .is_none_or(|last| self.hop_start >= last + self.refractory_frames);
        if !(loud && rising && ready) {
            return None;
        }

        let peak = self.hop_buf.iter().fold(0.0f32, |m, s| m.max(s.abs()));
        let offset = self
            .hop_buf
            .iter()
            .position(|s| s.abs() >= peak * REFINE_FRACTION)
            .unwrap_or(0);
        let onset = self.hop_start + offset as u64;
        self.last_onset = Some(onset);
        Some(onset)
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

    fn detect(signal: &[f32]) -> Vec<u64> {
        let mut d = OnsetDetector::new(SR, 0);
        let mut onsets = Vec::new();
        // Feed in odd-sized chunks, like audio callbacks do.
        for chunk in signal.chunks(441) {
            d.push(chunk, &mut onsets);
        }
        onsets
    }

    #[test]
    fn finds_each_pluck_within_2ms() {
        let starts = [4_800, 36_000, 67_123, 100_000];
        let onsets = detect(&plucks(130_000, &starts, 0.5));
        assert_eq!(onsets.len(), starts.len(), "{onsets:?}");
        for (onset, start) in onsets.iter().zip(starts) {
            let err_ms = (*onset as f64 - start as f64) / SR as f64 * 1000.0;
            assert!(
                err_ms.abs() < 2.0,
                "onset {onset} vs {start}: {err_ms:.2} ms"
            );
        }
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
        assert!((onsets[0] as i64 - 1_004_800).abs() < 96);
    }
}
