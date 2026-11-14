//! Judges the notes a player plays against a task (ADR 0011).
//!
//! Input is one pitch reading per engine tick (the MIDI note of the
//! strongest clear pitch, or `None`), with its time on the audio clock. A
//! note counts once it has been heard steadily for a moment, so the short
//! octave jumps of a pick attack and pitch-tracker glitches are not judged.

use crate::task::{Matching, PitchTask};

/// A correct note counts once heard steadily for this long, in seconds
/// (about three pitch readings).
pub const CONFIRM_SECS: f64 = 0.08;
/// A wrong note counts as a mistake only once held this long, in seconds.
/// Longer than `CONFIRM_SECS` so attack transients (often an octave too
/// high) and slides through other notes are not punished.
pub const WRONG_SECS: f64 = 0.25;

/// A note the judge decided on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Heard {
    /// The task's note `index` was played (`midi` = as played).
    Correct { index: usize, midi: i32 },
    /// `midi` was played while note `index` was expected.
    Wrong { index: usize, midi: i32 },
}

#[derive(Debug, Clone, Copy)]
struct Held {
    midi: i32,
    since: f64,
    /// Already judged; the same held note is not judged again.
    judged: bool,
}

/// Matches played notes against a task's notes, in order. Wrong notes are
/// counted but do not advance: the player tries again.
#[derive(Debug, Clone)]
pub struct NoteJudge {
    expected: Vec<i32>,
    matching: Matching,
    next: usize,
    /// Played minus expected, fixed by the first note (`AnyOctave`).
    shift: i32,
    held: Option<Held>,
    /// The last correct note as played. Hearing it (or its octave) again is
    /// ignored: usually it is still ringing.
    last: Option<i32>,
    mistakes: u32,
}

impl NoteJudge {
    pub fn new(task: &PitchTask) -> Self {
        Self::from_midi(task.midi_notes(), task.matching)
    }

    /// A judge for `expected` sounding MIDI notes, in order.
    pub fn from_midi(expected: Vec<i32>, matching: Matching) -> Self {
        Self {
            expected,
            matching,
            next: 0,
            shift: 0,
            held: None,
            last: None,
            mistakes: 0,
        }
    }

    /// A new note was struck (an onset). If the next expected note is the
    /// one already held (a repeated note), it may now count again; other
    /// onsets change nothing, so a ringing note is still not judged twice.
    pub fn onset(&mut self) {
        if let Some(held) = self.held
            && !self.is_done()
            && held.judged
            && self.matches(held.midi)
        {
            self.held = None;
            self.last = None;
        }
    }

    /// Ignore `midi`, sounding at `now`, until it stops or changes: the
    /// previous task's last note still ringing, or a reference tone fading.
    pub fn ignore(&mut self, now: f64, midi: Option<i32>) {
        self.held = midi.map(|midi| Held {
            midi,
            since: now,
            judged: true,
        });
    }

    /// Feed one pitch reading (`None` = silence or no clear pitch).
    pub fn hear(&mut self, now: f64, midi: Option<i32>) -> Option<Heard> {
        let Some(midi) = midi else {
            self.held = None;
            return None;
        };
        if self.is_done() {
            return None;
        }
        let held = match self.held {
            Some(h) if h.midi == midi => h,
            _ => Held {
                midi,
                since: now,
                judged: false,
            },
        };
        self.held = Some(held);
        if held.judged {
            return None;
        }

        let elapsed = now - held.since;
        let index = self.next;
        let echo_of_last = self
            .last
            .is_some_and(|last| last == midi || (last - midi).abs() == 12);
        if self.matches(midi) {
            // An octave of the note just played may be the tracker hearing
            // its harmonic while it rings: insist a little longer.
            let needed = if echo_of_last {
                WRONG_SECS
            } else {
                CONFIRM_SECS
            };
            if elapsed < needed {
                return None;
            }
            if index == 0 {
                self.shift = midi - self.expected[0];
            }
            self.next += 1;
            self.last = Some(midi);
            self.mark_judged();
            return Some(Heard::Correct { index, midi });
        }
        if echo_of_last || elapsed < WRONG_SECS {
            return None;
        }
        self.mistakes += 1;
        self.mark_judged();
        Some(Heard::Wrong { index, midi })
    }

    fn mark_judged(&mut self) {
        if let Some(h) = &mut self.held {
            h.judged = true;
        }
    }

    fn matches(&self, midi: i32) -> bool {
        let expected = self.expected[self.next];
        match self.matching {
            Matching::Exact => midi == expected,
            Matching::AnyOctave if self.next == 0 => (midi - expected).rem_euclid(12) == 0,
            Matching::AnyOctave => midi == expected + self.shift,
        }
    }

    /// Notes played correctly so far.
    pub fn progress(&self) -> usize {
        self.next
    }

    pub fn is_done(&self) -> bool {
        self.next >= self.expected.len()
    }

    /// Wrong notes so far.
    pub fn mistakes(&self) -> u32 {
        self.mistakes
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instrument::Clef;
    use crate::pitch::Pitch;
    use crate::task::{Prompt, TaskNote};

    /// Readings every 33 ms, like the engine tick.
    const TICK: f64 = 0.033;

    fn task(notes: &[i32], matching: Matching) -> PitchTask {
        PitchTask {
            prompt: Prompt::Note,
            clef: Clef::Treble,
            notes: notes
                .iter()
                .map(|&midi| TaskNote {
                    written: Pitch::from_midi(midi),
                    midi,
                    given: true,
                })
                .collect(),
            matching,
            play_first: false,
        }
    }

    /// Feed `readings` from time `t`; returns the decisions and the end time.
    fn play(judge: &mut NoteJudge, t: f64, readings: &[Option<i32>]) -> (Vec<Heard>, f64) {
        let mut out = Vec::new();
        let mut now = t;
        for &r in readings {
            out.extend(judge.hear(now, r));
            now += TICK;
        }
        (out, now)
    }

    fn hold(midi: i32, ticks: usize) -> Vec<Option<i32>> {
        vec![Some(midi); ticks]
    }

    #[test]
    fn a_steady_correct_note_counts_once() {
        let mut j = NoteJudge::new(&task(&[64], Matching::Exact));
        let (heard, _) = play(&mut j, 0.0, &hold(64, 20));
        assert_eq!(heard, vec![Heard::Correct { index: 0, midi: 64 }]);
        assert!(j.is_done());
        assert_eq!(j.mistakes(), 0);
    }

    #[test]
    fn needs_a_few_readings() {
        let mut j = NoteJudge::new(&task(&[64], Matching::Exact));
        let (heard, _) = play(&mut j, 0.0, &[Some(64), Some(64), None, Some(64)]);
        assert!(
            heard.is_empty(),
            "two readings then a dropout is not enough"
        );
    }

    #[test]
    fn short_glitches_are_not_mistakes() {
        let mut j = NoteJudge::new(&task(&[52], Matching::Exact));
        // Attack heard an octave high for 4 readings, then the real note.
        let mut readings = hold(64, 4);
        readings.extend(hold(52, 5));
        let (heard, _) = play(&mut j, 0.0, &readings);
        assert_eq!(heard, vec![Heard::Correct { index: 0, midi: 52 }]);
        assert_eq!(j.mistakes(), 0);
    }

    #[test]
    fn a_held_wrong_note_is_one_mistake() {
        let mut j = NoteJudge::new(&task(&[64], Matching::Exact));
        let (heard, now) = play(&mut j, 0.0, &hold(65, 30));
        assert_eq!(heard, vec![Heard::Wrong { index: 0, midi: 65 }]);
        assert_eq!(j.mistakes(), 1);
        // Then the right note.
        let (heard, _) = play(&mut j, now, &hold(64, 5));
        assert_eq!(heard, vec![Heard::Correct { index: 0, midi: 64 }]);
        assert_eq!(j.mistakes(), 1);
    }

    #[test]
    fn exact_rejects_other_octaves() {
        let mut j = NoteJudge::new(&task(&[64], Matching::Exact));
        let (heard, _) = play(&mut j, 0.0, &hold(76, 20));
        assert_eq!(heard, vec![Heard::Wrong { index: 0, midi: 76 }]);
    }

    #[test]
    fn any_octave_keeps_the_shape() {
        // C4 E4 G4, played an octave lower.
        let mut j = NoteJudge::new(&task(&[60, 64, 67], Matching::AnyOctave));
        let mut readings = hold(48, 5);
        readings.push(None);
        readings.extend(hold(52, 5));
        readings.push(None);
        // G4 instead of G3: wrong octave for this shape.
        readings.extend(hold(67, 12));
        readings.push(None);
        readings.extend(hold(55, 5));
        let (heard, _) = play(&mut j, 0.0, &readings);
        assert_eq!(
            heard,
            vec![
                Heard::Correct { index: 0, midi: 48 },
                Heard::Correct { index: 1, midi: 52 },
                Heard::Wrong { index: 2, midi: 67 },
                Heard::Correct { index: 2, midi: 55 },
            ]
        );
    }

    #[test]
    fn the_last_note_ringing_is_ignored() {
        let mut j = NoteJudge::new(&task(&[60, 62], Matching::Exact));
        let mut readings = hold(60, 5);
        readings.push(None);
        // Re-heard after a dropout, and its octave (harmonic): ignored.
        readings.extend(hold(60, 12));
        readings.extend(hold(72, 12));
        let (heard, _) = play(&mut j, 0.0, &readings);
        assert_eq!(heard, vec![Heard::Correct { index: 0, midi: 60 }]);
        assert_eq!(j.mistakes(), 0);
    }

    #[test]
    fn an_octave_of_the_last_note_needs_longer_when_expected() {
        let mut j = NoteJudge::new(&task(&[60, 72], Matching::Exact));
        let mut readings = hold(60, 5);
        // A short harmonic reading: not yet the octave.
        readings.extend(hold(72, 4));
        let (heard, now) = play(&mut j, 0.0, &readings);
        assert_eq!(heard.len(), 1);
        let (heard, _) = play(&mut j, now, &hold(72, 10));
        assert_eq!(heard, vec![Heard::Correct { index: 1, midi: 72 }]);
    }

    #[test]
    fn ignored_note_counts_after_it_stops() {
        let mut j = NoteJudge::new(&task(&[64], Matching::Exact));
        j.ignore(0.0, Some(64));
        let (heard, now) = play(&mut j, 0.0, &hold(64, 20));
        assert!(heard.is_empty(), "still ringing from before");
        let mut readings = vec![None];
        readings.extend(hold(64, 5));
        let (heard, _) = play(&mut j, now, &readings);
        assert_eq!(heard, vec![Heard::Correct { index: 0, midi: 64 }]);
    }

    #[test]
    fn an_onset_lets_a_repeated_note_count_again() {
        let mut j = NoteJudge::from_midi(vec![60, 60, 62], Matching::Exact);
        let (heard, now) = play(&mut j, 0.0, &hold(60, 10));
        assert_eq!(heard, vec![Heard::Correct { index: 0, midi: 60 }]);
        // Struck again without a gap in the pitch readings.
        j.onset();
        let (heard, now) = play(&mut j, now, &hold(60, 5));
        assert_eq!(heard, vec![Heard::Correct { index: 1, midi: 60 }]);
        // An onset while the next note is different changes nothing: the
        // ringing 60 is still ignored.
        j.onset();
        let (heard, _) = play(&mut j, now, &hold(60, 20));
        assert!(heard.is_empty());
        assert_eq!(j.mistakes(), 0);
    }
}
