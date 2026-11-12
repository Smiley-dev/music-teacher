//! Turns noisy per-frame pitch readings into a steady note display.

use serde::Serialize;

use crate::PitchReading;
use crate::note::cents_from;

/// Consecutive readings of the same note needed before switching to it.
pub const NOTE_CONFIRM_READINGS: u32 = 2;
/// Seconds the last note stays visible (inactive) after it stops sounding.
pub const NOTE_HOLD_SECS: f64 = 1.2;
/// Weight of the newest reading in the frequency moving average (0..1).
pub const FREQ_SMOOTHING: f32 = 0.35;

/// The note to display.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StableNote {
    pub name: &'static str,
    pub octave: i32,
    pub midi: i32,
    /// Smoothed frequency in Hz.
    pub frequency: f32,
    /// Smoothed deviation from the exact note, -50..+50.
    pub cents: f32,
    /// 0-based input channel the note was detected on.
    pub channel: usize,
    /// False once the note stopped sounding (kept for `NOTE_HOLD_SECS`).
    pub active: bool,
}

#[derive(Debug, Default)]
pub struct NoteStabilizer {
    candidate_midi: Option<i32>,
    candidate_count: u32,
    current: Option<StableNote>,
    last_heard: f64,
}

impl NoteStabilizer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }

    /// Feed the strongest reading of this frame (`None` = nothing heard) with
    /// its channel, at time `now` in seconds. Returns the note to display.
    pub fn update(
        &mut self,
        reading: Option<(&PitchReading, usize)>,
        now: f64,
    ) -> Option<&StableNote> {
        match reading {
            Some((reading, channel)) => {
                let midi = reading.note.midi;
                self.candidate_count = if self.candidate_midi == Some(midi) {
                    self.candidate_count + 1
                } else {
                    1
                };
                self.candidate_midi = Some(midi);

                let same_note = self.current.as_ref().is_some_and(|n| n.midi == midi);
                if same_note || self.candidate_count >= NOTE_CONFIRM_READINGS {
                    let frequency = match &self.current {
                        Some(prev) if same_note => {
                            prev.frequency + (reading.frequency - prev.frequency) * FREQ_SMOOTHING
                        }
                        _ => reading.frequency,
                    };
                    self.last_heard = now;
                    self.current = Some(StableNote {
                        name: reading.note.name,
                        octave: reading.note.octave,
                        midi,
                        frequency,
                        cents: cents_from(frequency, midi),
                        channel,
                        active: true,
                    });
                }
            }
            None => {
                self.candidate_midi = None;
                self.candidate_count = 0;
                if let Some(note) = &mut self.current
                    && now - self.last_heard > NOTE_HOLD_SECS
                {
                    note.active = false;
                }
            }
        }
        self.current.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Note;

    fn reading(hz: f32) -> PitchReading {
        PitchReading {
            frequency: hz,
            clarity: 0.9,
            note: Note::from_frequency(hz).unwrap(),
        }
    }

    #[test]
    fn needs_two_readings_to_show_a_note() {
        let mut s = NoteStabilizer::new();
        assert!(s.update(Some((&reading(110.0), 0)), 0.0).is_none());
        let n = s.update(Some((&reading(110.0), 0)), 0.03).unwrap();
        assert_eq!((n.name, n.octave, n.active), ("A", 2, true));
    }

    #[test]
    fn single_glitch_does_not_switch_note() {
        let mut s = NoteStabilizer::new();
        s.update(Some((&reading(110.0), 0)), 0.0);
        s.update(Some((&reading(110.0), 0)), 0.03);
        // One octave-error reading...
        let n = s.update(Some((&reading(220.0), 0)), 0.06).unwrap();
        assert_eq!(n.midi, 45);
        // ...then back to the real note.
        let n = s.update(Some((&reading(110.0), 0)), 0.09).unwrap();
        assert_eq!(n.midi, 45);
    }

    #[test]
    fn smooths_frequency_within_a_note() {
        let mut s = NoteStabilizer::new();
        s.update(Some((&reading(110.0), 0)), 0.0);
        s.update(Some((&reading(110.0), 0)), 0.03);
        let n = s.update(Some((&reading(111.0), 0)), 0.06).unwrap();
        assert!(n.frequency > 110.0 && n.frequency < 111.0);
        assert!(n.cents > 0.0);
    }

    #[test]
    fn holds_then_deactivates_after_silence() {
        let mut s = NoteStabilizer::new();
        s.update(Some((&reading(110.0), 1)), 0.0);
        s.update(Some((&reading(110.0), 1)), 0.03);
        assert!(s.update(None, 1.0).unwrap().active);
        let n = s.update(None, 1.3).unwrap();
        assert!(!n.active);
        assert_eq!(n.channel, 1);
    }
}
