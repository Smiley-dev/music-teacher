//! Note reading: one note on the staff, play it.

use serde::{Deserialize, Serialize};

use crate::exercise::TheoryError;
use crate::instrument::Instrument;
use crate::pitch::{Letter, Pitch};
use crate::rng::Rng;
use crate::task::{Matching, PitchTask, Prompt};

/// Note reading choices (saved in settings).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct NoteReadingOptions {
    /// Include notes on ledger lines above and below the staff (up to the
    /// instrument's range).
    pub ledger_lines: bool,
    /// Include sharps and flats.
    pub accidentals: bool,
    /// Accept the note in any octave.
    pub any_octave: bool,
}

/// Sharps and flats that are written as plain naturals in practice (E♯ = F,
/// B♯ = C, C♭ = B, F♭ = E): left out of note reading.
fn is_unusual(letter: Letter, accidental: i8) -> bool {
    matches!(
        (letter, accidental),
        (Letter::E | Letter::B, 1) | (Letter::C | Letter::F, -1)
    )
}

/// Every note the options allow for `instrument`, low to high.
pub fn note_pool(options: &NoteReadingOptions, instrument: Instrument) -> Vec<Pitch> {
    let (low, high) = instrument.written_range();
    let (mut from, mut to) = (low.step(), high.step());
    if !options.ledger_lines {
        let (bottom, top) = instrument.clef().staff_range();
        from = from.max(bottom);
        to = to.min(top);
    }
    let accidentals: &[i8] = if options.accidentals {
        &[-1, 0, 1]
    } else {
        &[0]
    };
    (from..=to)
        .flat_map(|step| {
            let natural = Pitch::natural_at(step);
            accidentals
                .iter()
                .filter(move |&&a| !is_unusual(natural.letter, a))
                .map(move |&accidental| Pitch {
                    accidental,
                    ..natural
                })
        })
        .filter(|p| instrument.in_range(*p))
        .collect()
}

pub(crate) fn generate(
    options: &NoteReadingOptions,
    instrument: Instrument,
    previous: Option<&PitchTask>,
    rng: &mut Rng,
) -> Result<PitchTask, TheoryError> {
    // Never the same note (in any octave or spelling) twice in a row: it
    // would still be ringing when the next task starts.
    let last = previous.and_then(|t| t.notes.first()).map(|n| n.midi);
    let pool: Vec<Pitch> = note_pool(options, instrument)
        .into_iter()
        .filter(|p| last.is_none_or(|m| (instrument.sounding(*p) - m).rem_euclid(12) != 0))
        .collect();
    let written = *rng.pick(&pool).ok_or(TheoryError::OutOfRange("note"))?;
    Ok(PitchTask {
        prompt: Prompt::Note,
        clef: instrument.clef(),
        notes: vec![PitchTask::note(instrument, written, true)],
        matching: if options.any_octave {
            Matching::AnyOctave
        } else {
            Matching::Exact
        },
        play_first: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staff_only_pool_for_treble() {
        let options = NoteReadingOptions::default();
        let pool = note_pool(&options, Instrument::KeyboardTreble);
        let names: Vec<String> = pool.iter().map(|p| p.to_string()).collect();
        assert_eq!(
            names,
            [
                "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5"
            ]
        );
    }

    #[test]
    fn ledger_lines_extend_to_the_instrument_range() {
        let options = NoteReadingOptions {
            ledger_lines: true,
            ..Default::default()
        };
        let pool = note_pool(&options, Instrument::Guitar);
        assert_eq!(pool.first().map(|p| p.to_string()).as_deref(), Some("E3"));
        assert_eq!(pool.last().map(|p| p.to_string()).as_deref(), Some("C6"));
    }

    #[test]
    fn accidentals_skip_unusual_spellings_and_out_of_range_notes() {
        let options = NoteReadingOptions {
            ledger_lines: true,
            accidentals: true,
            any_octave: false,
        };
        let pool = note_pool(&options, Instrument::Guitar);
        let names: Vec<String> = pool.iter().map(|p| p.to_string()).collect();
        assert!(names.contains(&"F#3".to_string()));
        assert!(names.contains(&"Bb4".to_string()));
        assert!(
            !names.contains(&"Eb3".to_string()),
            "below the low E string"
        );
        assert!(
            !names
                .iter()
                .any(|n| n.starts_with("E#") || n.starts_with("Cb"))
        );
    }

    #[test]
    fn tasks_change_note_and_sound_for_the_instrument() {
        let options = NoteReadingOptions::default();
        let mut rng = Rng::new(7);
        let mut previous: Option<PitchTask> = None;
        for _ in 0..50 {
            let task = generate(&options, Instrument::Guitar, previous.as_ref(), &mut rng).unwrap();
            let note = task.notes[0];
            assert_eq!(note.midi, note.written.midi() - 12);
            assert!(note.given);
            if let Some(prev) = &previous {
                assert_ne!(prev.notes[0].midi.rem_euclid(12), note.midi.rem_euclid(12));
            }
            previous = Some(task);
        }
    }
}
