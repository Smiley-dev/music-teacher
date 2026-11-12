use std::collections::VecDeque;

use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;
use serde::Serialize;

use crate::Note;

/// Window length in seconds. Must hold a few periods of the lowest note we
/// care about (bass low E = 41 Hz -> 24 ms period).
const WINDOW_SECONDS: f32 = 0.08;
/// Ignore anything quieter than this RMS level (~ -50 dBFS).
const MIN_RMS: f32 = 0.003;
/// McLeod clarity threshold (0..1). Higher = fewer but more confident readings.
const CLARITY_THRESHOLD: f32 = 0.7;
/// Plausible instrument range.
const MIN_HZ: f32 = 30.0;
const MAX_HZ: f32 = 4200.0;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchReading {
    pub frequency: f32,
    /// Confidence of the estimate, 0..1.
    pub clarity: f32,
    pub note: Note,
}

/// Tracks the pitch of one mono channel from a continuous stream of samples.
pub struct PitchTracker {
    detector: McLeodDetector<f32>,
    window: VecDeque<f32>,
    scratch: Vec<f32>,
    size: usize,
    sample_rate: u32,
}

impl PitchTracker {
    pub fn new(sample_rate: u32) -> Self {
        let size = ((sample_rate as f32 * WINDOW_SECONDS) as usize).next_power_of_two();
        Self {
            detector: McLeodDetector::new(size, size / 2),
            window: VecDeque::with_capacity(size),
            scratch: vec![0.0; size],
            size,
            sample_rate,
        }
    }

    /// Append new samples, keeping only the most recent window.
    pub fn push(&mut self, samples: impl IntoIterator<Item = f32>) {
        for s in samples {
            if self.window.len() == self.size {
                self.window.pop_front();
            }
            self.window.push_back(s);
        }
    }

    /// Estimate the pitch of the current window, if it is loud and periodic enough.
    pub fn detect(&mut self) -> Option<PitchReading> {
        if self.window.len() < self.size {
            return None;
        }
        for (dst, src) in self.scratch.iter_mut().zip(self.window.iter()) {
            *dst = *src;
        }
        let rms = (self.scratch.iter().map(|s| s * s).sum::<f32>() / self.size as f32).sqrt();
        if rms < MIN_RMS {
            return None;
        }
        let pitch = self.detector.get_pitch(
            &self.scratch,
            self.sample_rate as usize,
            0.0,
            CLARITY_THRESHOLD,
        )?;
        if !(MIN_HZ..=MAX_HZ).contains(&pitch.frequency) {
            return None;
        }
        Some(PitchReading {
            frequency: pitch.frequency,
            clarity: pitch.clarity,
            note: Note::from_frequency(pitch.frequency)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    const SR: u32 = 48_000;

    /// A guitar-like tone: fundamental plus decaying harmonics.
    fn tone(hz: f32, seconds: f32, amplitude: f32) -> Vec<f32> {
        let n = (SR as f32 * seconds) as usize;
        (0..n)
            .map(|i| {
                let t = i as f32 / SR as f32;
                (1..=6)
                    .map(|h| (TAU * hz * h as f32 * t).sin() / h as f32)
                    .sum::<f32>()
                    * amplitude
                    * 0.5
            })
            .collect()
    }

    fn detect(samples: Vec<f32>) -> Option<PitchReading> {
        let mut tracker = PitchTracker::new(SR);
        tracker.push(samples);
        tracker.detect()
    }

    #[test]
    fn detects_open_strings() {
        for (hz, name, octave) in [
            (41.20, "E", 1),
            (82.41, "E", 2),
            (110.0, "A", 2),
            (196.0, "G", 3),
            (329.63, "E", 4),
            (880.0, "A", 5),
        ] {
            let r = detect(tone(hz, 0.2, 0.5)).unwrap_or_else(|| panic!("no pitch at {hz} Hz"));
            assert_eq!((r.note.name, r.note.octave), (name, octave), "{hz} Hz -> {r:?}");
            assert!(r.note.cents.abs() < 5.0, "{hz} Hz -> {r:?}");
        }
    }

    #[test]
    fn silence_and_noise_floor_give_nothing() {
        assert!(detect(vec![0.0; SR as usize / 5]).is_none());
        assert!(detect(tone(110.0, 0.2, 0.001)).is_none());
    }

    #[test]
    fn needs_a_full_window() {
        assert!(detect(tone(110.0, 0.01, 0.5)).is_none());
    }
}
