//! Scales: play a named scale or mode from the root shown.

use serde::{Deserialize, Serialize};

use crate::exercise::{TheoryError, rings_on};
use crate::instrument::Instrument;
use crate::notes::{NoteReadingOptions, note_pool};
use crate::pitch::Pitch;
use crate::rng::Rng;
use crate::task::{Matching, PitchTask, Prompt};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScaleKind {
    Major,
    NaturalMinor,
    HarmonicMinor,
    MelodicMinor,
    MajorPentatonic,
    MinorPentatonic,
    Dorian,
    Phrygian,
    Lydian,
    Mixolydian,
    Locrian,
}

impl ScaleKind {
    pub const ALL: [Self; 11] = [
        Self::Major,
        Self::NaturalMinor,
        Self::HarmonicMinor,
        Self::MelodicMinor,
        Self::MajorPentatonic,
        Self::MinorPentatonic,
        Self::Dorian,
        Self::Phrygian,
        Self::Lydian,
        Self::Mixolydian,
        Self::Locrian,
    ];

    /// Degrees above the root going up, as (letter steps, semitones);
    /// without the root and its octave.
    pub fn degrees(self) -> &'static [(i32, i32)] {
        match self {
            Self::Major => &[(1, 2), (2, 4), (3, 5), (4, 7), (5, 9), (6, 11)],
            Self::NaturalMinor => &[(1, 2), (2, 3), (3, 5), (4, 7), (5, 8), (6, 10)],
            Self::HarmonicMinor => &[(1, 2), (2, 3), (3, 5), (4, 7), (5, 8), (6, 11)],
            Self::MelodicMinor => &[(1, 2), (2, 3), (3, 5), (4, 7), (5, 9), (6, 11)],
            Self::MajorPentatonic => &[(1, 2), (2, 4), (4, 7), (5, 9)],
            Self::MinorPentatonic => &[(2, 3), (3, 5), (4, 7), (6, 10)],
            Self::Dorian => &[(1, 2), (2, 3), (3, 5), (4, 7), (5, 9), (6, 10)],
            Self::Phrygian => &[(1, 1), (2, 3), (3, 5), (4, 7), (5, 8), (6, 10)],
            Self::Lydian => &[(1, 2), (2, 4), (3, 6), (4, 7), (5, 9), (6, 11)],
            Self::Mixolydian => &[(1, 2), (2, 4), (3, 5), (4, 7), (5, 9), (6, 10)],
            Self::Locrian => &[(1, 1), (2, 3), (3, 5), (4, 6), (5, 8), (6, 10)],
        }
    }

    /// Degrees used coming down: melodic minor descends as natural minor.
    pub fn descending_degrees(self) -> &'static [(i32, i32)] {
        match self {
            Self::MelodicMinor => Self::NaturalMinor.degrees(),
            other => other.degrees(),
        }
    }

    /// The scale's notes from `root` up to its octave (and back down with
    /// `up_and_down`), spelled by degree. `None` if a note would need a
    /// double sharp or flat.
    pub fn notes(self, root: Pitch, up_and_down: bool) -> Option<Vec<Pitch>> {
        let at = |&(steps, semitones): &(i32, i32)| {
            root.transpose(steps, semitones).filter(|p| !p.is_double())
        };
        let mut notes = vec![root];
        for degree in self.degrees() {
            notes.push(at(degree)?);
        }
        notes.push(at(&(7, 12))?);
        if up_and_down {
            for degree in self.descending_degrees().iter().rev() {
                notes.push(at(degree)?);
            }
            notes.push(root);
        }
        Some(notes)
    }
}

/// Scale choices (saved in settings).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScaleOptions {
    pub scales: Vec<ScaleKind>,
    /// Up to the octave and back down to the root, instead of up only.
    pub up_and_down: bool,
    /// Show every note (reading practice) instead of only the root.
    pub show_notes: bool,
}

impl Default for ScaleOptions {
    fn default() -> Self {
        Self {
            scales: vec![ScaleKind::Major, ScaleKind::NaturalMinor],
            up_and_down: false,
            show_notes: false,
        }
    }
}

pub(crate) fn generate(
    options: &ScaleOptions,
    instrument: Instrument,
    previous: Option<&PitchTask>,
    rng: &mut Rng,
) -> Result<PitchTask, TheoryError> {
    if options.scales.is_empty() {
        return Err(TheoryError::NothingSelected("scale"));
    }
    // Roots: naturals, sharps and flats (never E♯, B♯, C♭, F♭) whose octave
    // is still in range.
    let roots = note_pool(
        &NoteReadingOptions {
            ledger_lines: true,
            accidentals: true,
            any_octave: false,
        },
        instrument,
    );
    let mut kinds = options.scales.clone();
    // Each selected scale equally often: pick one, then a root.
    while !kinds.is_empty() {
        let scale = kinds.swap_remove(rng.below(kinds.len()));
        let choices: Vec<(Pitch, Vec<Pitch>)> = roots
            .iter()
            .filter_map(|&root| {
                let prompt = Prompt::Scale {
                    root,
                    scale,
                    up_and_down: options.up_and_down,
                };
                let fresh = !rings_on(previous, instrument.sounding(root))
                    && previous.is_none_or(|p| p.prompt != prompt);
                if !fresh {
                    return None;
                }
                let notes = scale.notes(root, options.up_and_down)?;
                notes
                    .iter()
                    .all(|p| instrument.in_range(*p))
                    .then_some((root, notes))
            })
            .collect();
        if let Some((root, notes)) = rng.pick(&choices) {
            return Ok(PitchTask {
                prompt: Prompt::Scale {
                    root: *root,
                    scale,
                    up_and_down: options.up_and_down,
                },
                clef: instrument.clef(),
                notes: notes
                    .iter()
                    .enumerate()
                    .map(|(i, &p)| PitchTask::note(instrument, p, i == 0 || options.show_notes))
                    .collect(),
                matching: Matching::AnyOctave,
                play_first: false,
            });
        }
    }
    Err(TheoryError::OutOfRange("scale"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::Letter;

    fn names(notes: &[Pitch]) -> Vec<String> {
        notes.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn major_scales_are_spelled_by_key() {
        let notes = ScaleKind::Major
            .notes(Pitch::new(Letter::E, -1, 4), false)
            .unwrap();
        assert_eq!(
            names(&notes),
            ["Eb4", "F4", "G4", "Ab4", "Bb4", "C5", "D5", "Eb5"]
        );
        let notes = ScaleKind::Major
            .notes(Pitch::new(Letter::F, 1, 3), false)
            .unwrap();
        assert_eq!(
            names(&notes),
            ["F#3", "G#3", "A#3", "B3", "C#4", "D#4", "E#4", "F#4"]
        );
        assert_eq!(
            ScaleKind::Major.notes(Pitch::new(Letter::G, 1, 3), false),
            None,
            "G# major needs F double sharp"
        );
    }

    #[test]
    fn modes_and_minors() {
        let d = Pitch::natural(Letter::D, 4);
        let dorian = ScaleKind::Dorian.notes(d, false).unwrap();
        assert_eq!(
            names(&dorian),
            ["D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5"]
        );
        let a = Pitch::natural(Letter::A, 3);
        let harmonic = ScaleKind::HarmonicMinor.notes(a, false).unwrap();
        assert_eq!(harmonic[6].to_string(), "G#4");
        let pent = ScaleKind::MinorPentatonic.notes(a, false).unwrap();
        assert_eq!(names(&pent), ["A3", "C4", "D4", "E4", "G4", "A4"]);
        // Every 7-note scale uses each letter once.
        for scale in ScaleKind::ALL {
            let notes = scale.notes(Pitch::natural(Letter::C, 4), false).unwrap();
            let span = notes.last().unwrap().midi() - notes[0].midi();
            assert_eq!(span, 12, "{scale:?}");
            if scale.degrees().len() == 6 {
                let steps: Vec<i32> = notes.iter().map(|p| p.step() - notes[0].step()).collect();
                assert_eq!(steps, [0, 1, 2, 3, 4, 5, 6, 7], "{scale:?}");
            }
        }
    }

    #[test]
    fn melodic_minor_comes_down_natural() {
        let a = Pitch::natural(Letter::A, 3);
        let notes = ScaleKind::MelodicMinor.notes(a, true).unwrap();
        assert_eq!(
            names(&notes),
            [
                "A3", "B3", "C4", "D4", "E4", "F#4", "G#4", "A4", "G4", "F4", "E4", "D4", "C4",
                "B3", "A3"
            ]
        );
    }

    #[test]
    fn tasks_fit_the_instrument_and_show_the_root() {
        let options = ScaleOptions {
            scales: ScaleKind::ALL.to_vec(),
            up_and_down: true,
            show_notes: false,
        };
        for instrument in Instrument::ALL {
            let mut rng = Rng::new(3);
            let mut previous: Option<PitchTask> = None;
            for _ in 0..30 {
                let task = generate(&options, instrument, previous.as_ref(), &mut rng).unwrap();
                assert!(task.notes.iter().all(|n| instrument.in_range(n.written)));
                assert!(task.notes[0].given && !task.notes[1].given);
                assert_eq!(
                    task.notes.first().unwrap().midi,
                    task.notes.last().unwrap().midi
                );
                let windows = task.notes.windows(2);
                assert!(
                    windows.into_iter().all(|w| w[0].midi != w[1].midi),
                    "no repeats"
                );
                previous = Some(task);
            }
        }
    }

    #[test]
    fn nothing_selected() {
        let options = ScaleOptions {
            scales: vec![],
            ..Default::default()
        };
        assert_eq!(
            generate(&options, Instrument::Guitar, None, &mut Rng::new(1)),
            Err(TheoryError::NothingSelected("scale"))
        );
    }
}
