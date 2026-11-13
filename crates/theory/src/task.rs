//! One question of a pitch exercise: the notes to play, in order.

use serde::Serialize;

use crate::instrument::{Clef, Instrument};
use crate::interval::{Direction, IntervalName};
use crate::pitch::Pitch;
use crate::scale::ScaleKind;

/// How played notes are compared with the expected ones.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Matching {
    /// The exact sounding pitch.
    Exact,
    /// Any octave: the first note may be played in any octave; the others
    /// must keep the same octave shift from it (so the shape is the same).
    AnyOctave,
}

/// One note the user must play.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskNote {
    /// As written for the instrument (clef and transposition).
    pub written: Pitch,
    /// The sounding MIDI note to play.
    pub midi: i32,
    /// Shown on the staff before it is played (otherwise it appears once
    /// played correctly).
    pub given: bool,
}

/// What a task asks for, so the UI can phrase it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Prompt {
    /// Play the note shown on the staff.
    Note,
    /// Play the first note, then the note `interval` above or below it.
    Interval {
        interval: IntervalName,
        direction: Direction,
    },
    /// Play `scale` from `root` up to its octave (and back down).
    Scale {
        root: Pitch,
        scale: ScaleKind,
        up_and_down: bool,
    },
}

/// A task: play `notes` in order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchTask {
    pub prompt: Prompt,
    pub clef: Clef,
    pub notes: Vec<TaskNote>,
    pub matching: Matching,
    /// Play the notes to the user before they answer (ear training).
    pub play_first: bool,
}

impl PitchTask {
    /// A note written for `instrument`.
    pub fn note(instrument: Instrument, written: Pitch, given: bool) -> TaskNote {
        TaskNote {
            written,
            midi: instrument.sounding(written),
            given,
        }
    }

    /// Sounding MIDI notes, in order.
    pub fn midi_notes(&self) -> Vec<i32> {
        self.notes.iter().map(|n| n.midi).collect()
    }

    /// How to name a played (sounding) note: as written for the instrument,
    /// spelled like the task's note of the same name if there is one (B♭,
    /// not A♯, when the task shows B♭), otherwise with sharps.
    pub fn name_of(&self, midi: i32) -> Pitch {
        let same_name = self
            .notes
            .iter()
            .find(|n| (midi - n.midi).rem_euclid(12) == 0);
        if let Some(n) = same_name {
            let octaves = (midi - n.midi) / 12;
            return Pitch {
                octave: n.written.octave + octaves as i8,
                ..n.written
            };
        }
        let transposition = self.notes.first().map_or(0, |n| n.midi - n.written.midi());
        Pitch::from_midi(midi - transposition)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::Letter;

    #[test]
    fn played_notes_are_named_like_the_task() {
        let guitar = Instrument::Guitar;
        let task = PitchTask {
            prompt: Prompt::Note,
            clef: Clef::Treble,
            notes: vec![PitchTask::note(guitar, Pitch::new(Letter::B, -1, 4), true)],
            matching: Matching::Exact,
            play_first: false,
        };
        // Bb4 written sounds Bb3 (58) on guitar.
        assert_eq!(task.name_of(58).to_string(), "Bb4");
        assert_eq!(task.name_of(70).to_string(), "Bb5");
        assert_eq!(task.name_of(57).to_string(), "A4");
        assert_eq!(task.name_of(61).to_string(), "C#5");
    }
}
