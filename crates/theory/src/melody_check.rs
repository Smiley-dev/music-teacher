//! Pitch of a sight-reading melody played with the metronome (ADR 0012).
//! The pitch readings taken while a note should sound vote; the note is
//! right if the most frequent reading is its written pitch. Timing is judged
//! separately by `rhythm::TimingJudge`.
//!
//! Positions are in beats from the start of the melody on the audio clock,
//! already corrected for the calibrated latency.

use rhythm::SIXTEENTHS_PER_BEAT;
use serde::Serialize;

use crate::reading::ReadingExercise;

/// Readings count only from this long after a note's start, in seconds: the
/// pitch tracker's window (~80 ms) still holds the previous note and the
/// attack before then. Short notes start counting at half their length.
pub const PITCH_SETTLE_SECS: f64 = 0.08;
/// Fewest readings needed to judge a note's pitch (readings come about 30
/// times a second).
pub const MIN_PITCH_READINGS: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PitchResult {
    Right,
    Wrong,
    /// Too few clear readings while the note should sound (not played, too
    /// short, or too quiet).
    Unclear,
}

/// The pitch result for one played note of the melody.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchCheck {
    pub bar: usize,
    pub symbol: usize,
    pub result: PitchResult,
    /// The pitch heard most, as written (e.g. "F#4"); `None` if nothing
    /// clear was heard.
    pub played: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchSummary {
    pub notes: usize,
    pub right: usize,
    pub wrong: usize,
    pub unclear: usize,
    /// Share of notes played at the right pitch, 0..100.
    pub right_percent: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchReport {
    pub checks: Vec<PitchCheck>,
    pub summary: PitchSummary,
}

struct Span {
    bar: usize,
    symbol: usize,
    /// Readings between `from` and `to` (beats) vote for this note.
    from: f64,
    to: f64,
    midi: i32,
    votes: Vec<i32>,
}

/// Collects pitch readings per note and decides each note once it is over.
pub struct MelodyPitchJudge {
    exercise: ReadingExercise,
    spans: Vec<Span>,
    /// First note not decided yet.
    next: usize,
    checks: Vec<PitchCheck>,
}

impl MelodyPitchJudge {
    pub fn new(exercise: &ReadingExercise, bpm: f64) -> Self {
        let beats_per_bar = exercise.rhythm.time_signature.beats_per_bar as f64;
        let per_beat = SIXTEENTHS_PER_BEAT as f64;
        let settle = PITCH_SETTLE_SECS * bpm / 60.0;
        let spans = exercise
            .notes
            .iter()
            .filter_map(|n| {
                let placed = exercise.rhythm.bars.get(n.bar)?.symbols.get(n.symbol)?;
                let start = n.bar as f64 * beats_per_bar + placed.start as f64 / per_beat;
                let length = placed.duration as f64 / per_beat;
                Some(Span {
                    bar: n.bar,
                    symbol: n.symbol,
                    from: start + settle.min(length / 2.0),
                    to: start + length,
                    midi: n.midi,
                    votes: Vec::new(),
                })
            })
            .collect();
        Self {
            exercise: exercise.clone(),
            spans,
            next: 0,
            checks: Vec::new(),
        }
    }

    /// One pitch reading at position `beat` (`None` = no clear pitch).
    pub fn hear(&mut self, beat: f64, midi: Option<i32>) {
        let Some(midi) = midi else { return };
        if let Some(span) = self.spans[self.next..]
            .iter_mut()
            .take_while(|s| s.from <= beat)
            .find(|s| beat < s.to)
        {
            span.votes.push(midi);
        }
    }

    /// Decide every note that ended at or before `beat`.
    pub fn advance(&mut self, beat: f64) -> Vec<PitchCheck> {
        let mut decided = Vec::new();
        while let Some(span) = self.spans.get(self.next) {
            if span.to > beat {
                break;
            }
            let check = self.decide(span);
            self.checks.push(check.clone());
            decided.push(check);
            self.next += 1;
        }
        decided
    }

    fn decide(&self, span: &Span) -> PitchCheck {
        // Most frequent reading; ties go to the expected note.
        let mut best: Option<(i32, usize)> = None;
        for &midi in &span.votes {
            let count = span.votes.iter().filter(|&&v| v == midi).count();
            let better = match best {
                None => true,
                Some((b, c)) => count > c || (count == c && midi == span.midi && b != span.midi),
            };
            if better {
                best = Some((midi, count));
            }
        }
        let result = match best {
            _ if span.votes.len() < MIN_PITCH_READINGS => PitchResult::Unclear,
            Some((midi, _)) if midi == span.midi => PitchResult::Right,
            _ => PitchResult::Wrong,
        };
        PitchCheck {
            bar: span.bar,
            symbol: span.symbol,
            result,
            played: best.map(|(midi, _)| self.exercise.name_of(midi).to_string()),
        }
    }

    /// Decide the remaining notes and summarise.
    pub fn report(mut self) -> PitchReport {
        self.advance(f64::INFINITY);
        let count = |r| self.checks.iter().filter(|c| c.result == r).count();
        let (right, wrong, unclear) = (
            count(PitchResult::Right),
            count(PitchResult::Wrong),
            count(PitchResult::Unclear),
        );
        let notes = self.checks.len();
        PitchReport {
            summary: PitchSummary {
                notes,
                right,
                wrong,
                unclear,
                right_percent: if notes == 0 {
                    0.0
                } else {
                    100.0 * right as f64 / notes as f64
                },
            },
            checks: self.checks,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instrument::Instrument;
    use crate::reading::{ReadingOptions, generate_reading};
    use rhythm::{NoteValue, RhythmOptions};

    /// A melody of quarter notes (one per beat) at 60 BPM: beat = 1 s.
    fn quarters() -> ReadingExercise {
        let options = ReadingOptions {
            rhythm: RhythmOptions {
                values: vec![NoteValue::Quarter],
                dotted: false,
                rests: false,
            },
            bars: 1,
            ..Default::default()
        };
        generate_reading(&options, Instrument::KeyboardTreble, 4).unwrap()
    }

    /// Readings every 33 ms over `[from, to)` beats (1 beat = 1 s).
    fn hear_range(judge: &mut MelodyPitchJudge, from: f64, to: f64, midi: Option<i32>) {
        let mut t = from;
        while t < to {
            judge.hear(t, midi);
            t += 0.033;
        }
    }

    #[test]
    fn right_wrong_and_unclear_notes() {
        let e = quarters();
        let midi: Vec<i32> = e.midi_notes();
        let mut judge = MelodyPitchJudge::new(&e, 60.0);
        // Note 1 right; its attack read an octave high for a moment.
        hear_range(&mut judge, 0.0, 0.1, Some(midi[0] + 12));
        hear_range(&mut judge, 0.1, 1.0, Some(midi[0]));
        // Note 2 wrong (a semitone up).
        hear_range(&mut judge, 1.0, 2.0, Some(midi[1] + 1));
        // Note 3 silent.
        hear_range(&mut judge, 2.0, 3.0, None);
        // Note 4 right.
        hear_range(&mut judge, 3.0, 4.0, Some(midi[3]));

        let decided = judge.advance(2.5);
        assert_eq!(decided.len(), 2, "only notes that are over");
        assert_eq!(decided[0].result, PitchResult::Right);
        assert_eq!(decided[1].result, PitchResult::Wrong);
        assert_eq!(
            decided[1].played.as_deref(),
            Some(e.name_of(midi[1] + 1).to_string().as_str())
        );

        let report = judge.report();
        let results: Vec<PitchResult> = report.checks.iter().map(|c| c.result).collect();
        assert_eq!(
            results,
            [
                PitchResult::Right,
                PitchResult::Wrong,
                PitchResult::Unclear,
                PitchResult::Right
            ]
        );
        assert_eq!(report.summary.right, 2);
        assert_eq!(report.summary.unclear, 1);
        assert!((report.summary.right_percent - 50.0).abs() < 1e-9);
        assert_eq!(report.checks[2].played, None);
    }

    #[test]
    fn the_previous_note_ringing_into_the_attack_does_not_count() {
        let e = quarters();
        let midi = e.midi_notes();
        let mut judge = MelodyPitchJudge::new(&e, 60.0);
        hear_range(&mut judge, 0.0, 1.0, Some(midi[0]));
        // The first 70 ms of note 2 still read as note 1 (inside the settle time).
        hear_range(&mut judge, 1.0, 1.07, Some(midi[0]));
        hear_range(&mut judge, 1.07, 2.0, Some(midi[1]));
        let checks = judge.advance(2.0);
        assert!(
            checks.iter().all(|c| c.result == PitchResult::Right),
            "{checks:?}"
        );
    }
}
