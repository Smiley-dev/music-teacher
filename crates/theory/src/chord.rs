//! Chords: play a named chord's notes one at a time, lowest first (an
//! arpeggio; pitch detection hears one note at a time).

use serde::{Deserialize, Serialize};

use crate::exercise::{TheoryError, rings_on};
use crate::instrument::Instrument;
use crate::notes::{NoteReadingOptions, note_pool};
use crate::pitch::Pitch;
use crate::rng::Rng;
use crate::task::{Matching, PitchTask, Prompt};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChordKind {
    Major,
    Minor,
    Diminished,
    Augmented,
    Dominant7,
    Major7,
    Minor7,
    HalfDiminished7,
    Diminished7,
}

impl ChordKind {
    pub const ALL: [Self; 9] = [
        Self::Major,
        Self::Minor,
        Self::Diminished,
        Self::Augmented,
        Self::Dominant7,
        Self::Major7,
        Self::Minor7,
        Self::HalfDiminished7,
        Self::Diminished7,
    ];

    /// Chord tones from the root, as (letter steps, semitones).
    pub fn tones(self) -> &'static [(i32, i32)] {
        match self {
            Self::Major => &[(0, 0), (2, 4), (4, 7)],
            Self::Minor => &[(0, 0), (2, 3), (4, 7)],
            Self::Diminished => &[(0, 0), (2, 3), (4, 6)],
            Self::Augmented => &[(0, 0), (2, 4), (4, 8)],
            Self::Dominant7 => &[(0, 0), (2, 4), (4, 7), (6, 10)],
            Self::Major7 => &[(0, 0), (2, 4), (4, 7), (6, 11)],
            Self::Minor7 => &[(0, 0), (2, 3), (4, 7), (6, 10)],
            Self::HalfDiminished7 => &[(0, 0), (2, 3), (4, 6), (6, 10)],
            Self::Diminished7 => &[(0, 0), (2, 3), (4, 6), (6, 9)],
        }
    }

    /// The chord's notes from the lowest up: with `inversion` k, the k
    /// lowest tones move up an octave (1st inversion starts on the 3rd).
    /// `None` if a note would need a double sharp or flat.
    pub fn notes(self, root: Pitch, inversion: usize) -> Option<Vec<Pitch>> {
        let tones = self.tones();
        (0..tones.len())
            .map(|i| {
                let (steps, semitones) = tones[(i + inversion) % tones.len()];
                let octave = if i + inversion >= tones.len() { 1 } else { 0 };
                root.transpose(steps + 7 * octave, semitones + 12 * octave)
                    .filter(|p| !p.is_double())
            })
            .collect()
    }
}

/// Chord choices (saved in settings).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ChordOptions {
    pub chords: Vec<ChordKind>,
    /// Also inversions (lowest note the 3rd, 5th or 7th).
    pub inversions: bool,
    /// Show every note (reading practice) instead of working them out.
    pub show_notes: bool,
}

impl Default for ChordOptions {
    fn default() -> Self {
        Self {
            chords: vec![ChordKind::Major, ChordKind::Minor],
            inversions: false,
            show_notes: false,
        }
    }
}

pub(crate) fn generate(
    options: &ChordOptions,
    instrument: Instrument,
    previous: Option<&PitchTask>,
    rng: &mut Rng,
) -> Result<PitchTask, TheoryError> {
    if options.chords.is_empty() {
        return Err(TheoryError::NothingSelected("chord"));
    }
    let roots = note_pool(
        &NoteReadingOptions {
            ledger_lines: true,
            accidentals: true,
            any_octave: false,
        },
        instrument,
    );
    let mut kinds: Vec<(ChordKind, usize)> = options
        .chords
        .iter()
        .flat_map(|&chord| {
            let inversions = if options.inversions {
                chord.tones().len()
            } else {
                1
            };
            (0..inversions).map(move |inversion| (chord, inversion))
        })
        .collect();
    // Each selected chord equally often (then each inversion), then a root.
    while !kinds.is_empty() {
        let chord = kinds[rng.below(kinds.len())].0;
        let of_chord: Vec<usize> = (0..kinds.len()).filter(|&i| kinds[i].0 == chord).collect();
        let (chord, inversion) = kinds.swap_remove(of_chord[rng.below(of_chord.len())]);
        let choices: Vec<(Pitch, Vec<Pitch>)> = roots
            .iter()
            .filter_map(|&root| {
                let prompt = Prompt::Chord {
                    root,
                    chord,
                    inversion: inversion as u8,
                };
                let notes = chord.notes(root, inversion)?;
                let fresh = !rings_on(previous, instrument.sounding(notes[0]))
                    && previous.is_none_or(|p| p.prompt != prompt);
                let fits = notes.iter().all(|p| instrument.in_range(*p));
                (fresh && fits).then_some((root, notes))
            })
            .collect();
        if let Some((root, notes)) = rng.pick(&choices) {
            return Ok(PitchTask {
                prompt: Prompt::Chord {
                    root: *root,
                    chord,
                    inversion: inversion as u8,
                },
                clef: instrument.clef(),
                notes: notes
                    .iter()
                    .map(|&p| PitchTask::note(instrument, p, options.show_notes))
                    .collect(),
                matching: Matching::AnyOctave,
                play_first: false,
            });
        }
    }
    Err(TheoryError::OutOfRange("chord"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::Letter;

    fn names(notes: &[Pitch]) -> Vec<String> {
        notes.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn chords_are_spelled_in_thirds() {
        let c = Pitch::natural(Letter::C, 4);
        assert_eq!(
            names(&ChordKind::Major.notes(c, 0).unwrap()),
            ["C4", "E4", "G4"]
        );
        assert_eq!(
            names(&ChordKind::Augmented.notes(c, 0).unwrap()),
            ["C4", "E4", "G#4"]
        );
        assert_eq!(
            names(&ChordKind::HalfDiminished7.notes(c, 0).unwrap()),
            ["C4", "Eb4", "Gb4", "Bb4"]
        );
        assert_eq!(
            ChordKind::Diminished7.notes(c, 0),
            None,
            "needs B double flat"
        );
        let b = Pitch::natural(Letter::B, 3);
        assert_eq!(
            names(&ChordKind::Diminished7.notes(b, 0).unwrap()),
            ["B3", "D4", "F4", "Ab4"]
        );
        let e = Pitch::new(Letter::E, -1, 4);
        assert_eq!(
            names(&ChordKind::Major7.notes(e, 0).unwrap()),
            ["Eb4", "G4", "Bb4", "D5"]
        );
    }

    #[test]
    fn inversions_move_the_lowest_notes_up() {
        let a = Pitch::natural(Letter::A, 3);
        assert_eq!(
            names(&ChordKind::Minor.notes(a, 1).unwrap()),
            ["C4", "E4", "A4"]
        );
        assert_eq!(
            names(&ChordKind::Minor.notes(a, 2).unwrap()),
            ["E4", "A4", "C5"]
        );
        let g = Pitch::natural(Letter::G, 3);
        assert_eq!(
            names(&ChordKind::Dominant7.notes(g, 3).unwrap()),
            ["F4", "G4", "B4", "D5"]
        );
        for chord in ChordKind::ALL {
            let root = Pitch::natural(Letter::D, 4);
            for inversion in 0..chord.tones().len() {
                let notes = chord.notes(root, inversion).unwrap();
                assert!(
                    notes.windows(2).all(|w| w[0].midi() < w[1].midi()),
                    "{chord:?} inversion {inversion} must go up: {notes:?}"
                );
            }
        }
    }

    #[test]
    fn tasks_cover_inversions_and_fit_the_instrument() {
        let options = ChordOptions {
            chords: ChordKind::ALL.to_vec(),
            inversions: true,
            show_notes: false,
        };
        let mut seen = std::collections::HashSet::new();
        for instrument in Instrument::ALL {
            let mut rng = Rng::new(9);
            let mut previous: Option<PitchTask> = None;
            for _ in 0..40 {
                let task = generate(&options, instrument, previous.as_ref(), &mut rng).unwrap();
                assert!(
                    task.notes
                        .iter()
                        .all(|n| instrument.in_range(n.written) && !n.given)
                );
                if let Prompt::Chord {
                    chord, inversion, ..
                } = task.prompt
                {
                    assert_eq!(task.notes.len(), chord.tones().len());
                    seen.insert(inversion);
                }
                previous = Some(task);
            }
        }
        assert_eq!(seen.len(), 4, "root position and three inversions");
    }

    #[test]
    fn root_position_only_unless_asked() {
        let options = ChordOptions::default();
        let mut rng = Rng::new(2);
        for _ in 0..30 {
            let task = generate(&options, Instrument::KeyboardTreble, None, &mut rng).unwrap();
            assert!(matches!(task.prompt, Prompt::Chord { inversion: 0, .. }));
        }
        let none = ChordOptions {
            chords: vec![],
            ..Default::default()
        };
        assert_eq!(
            generate(&none, Instrument::Guitar, None, &mut rng),
            Err(TheoryError::NothingSelected("chord"))
        );
    }
}
