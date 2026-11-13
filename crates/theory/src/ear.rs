//! Ear training: the app plays a few notes, the player plays them back. One
//! note is pitch matching; several are melodic dictation.

use serde::{Deserialize, Serialize};

use crate::exercise::{TheoryError, rings_on};
use crate::instrument::Instrument;
use crate::pitch::{Letter, Pitch};
use crate::rng::Rng;
use crate::scale::ScaleKind;
use crate::task::{Matching, PitchTask, Prompt};

/// Fewest and most notes per task.
pub const MIN_EAR_NOTES: u32 = 1;
pub const MAX_EAR_NOTES: u32 = 8;
/// Largest step between neighbouring notes of a melody, in semitones (a
/// perfect 5th): wider leaps are much harder to hear and find.
pub const MAX_LEAP: i32 = 7;
/// Most sharps or flats a key may have (excludes C♯ and C♭ major).
const MAX_KEY_ACCIDENTALS: usize = 6;

/// Ear training choices (saved in settings).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct EarOptions {
    /// Notes per task, `MIN_EAR_NOTES..=MAX_EAR_NOTES`.
    pub notes: u32,
    /// Any of the twelve notes, instead of the notes of a major key.
    pub chromatic: bool,
    /// Show the first note on the staff (the rest are worked out by ear).
    pub show_first: bool,
    /// Accept the notes in any octave (same shape).
    pub any_octave: bool,
}

impl Default for EarOptions {
    fn default() -> Self {
        Self {
            notes: 3,
            chromatic: false,
            show_first: false,
            any_octave: false,
        }
    }
}

/// Major keys with at most `MAX_KEY_ACCIDENTALS` sharps or flats, as the
/// spelling of each letter: (tonic, accidental per letter C..B).
fn major_keys() -> Vec<(Pitch, [i8; 7])> {
    let tonics = Letter::ALL
        .iter()
        .flat_map(|&l| [-1, 0, 1].map(|a| Pitch::new(l, a, 4)));
    tonics
        .filter_map(|tonic| {
            let notes = ScaleKind::Major.notes(tonic, false)?;
            let accidentals = notes[..7].iter().filter(|p| p.accidental != 0).count();
            if accidentals > MAX_KEY_ACCIDENTALS || notes.iter().any(|p| p.accidental.abs() > 1) {
                return None;
            }
            let mut spelling = [0; 7];
            for p in &notes[..7] {
                spelling[p.letter as usize] = p.accidental;
            }
            Some((tonic, spelling))
        })
        .collect()
}

/// A random walk of `length` notes over `pool` (sorted, distinct pitches):
/// no note twice in a row, steps of at most `MAX_LEAP`.
fn walk(
    pool: &[Pitch],
    length: usize,
    can_start: impl Fn(Pitch) -> bool,
    rng: &mut Rng,
) -> Option<Vec<Pitch>> {
    let starts: Vec<Pitch> = pool.iter().copied().filter(|&p| can_start(p)).collect();
    let mut notes = vec![*rng.pick(&starts)?];
    while notes.len() < length {
        let last = notes[notes.len() - 1].midi();
        let next: Vec<Pitch> = pool
            .iter()
            .copied()
            .filter(|p| p.midi() != last && (p.midi() - last).abs() <= MAX_LEAP)
            .collect();
        notes.push(*rng.pick(&next)?);
    }
    Some(notes)
}

pub(crate) fn generate(
    options: &EarOptions,
    instrument: Instrument,
    previous: Option<&PitchTask>,
    rng: &mut Rng,
) -> Result<PitchTask, TheoryError> {
    let length = options.notes.clamp(MIN_EAR_NOTES, MAX_EAR_NOTES) as usize;
    let (low, high) = instrument.written_range();
    let (pool, key) = if options.chromatic {
        let pool = (low.midi()..=high.midi()).map(Pitch::from_midi).collect();
        (pool, None)
    } else {
        let keys = major_keys();
        let &(tonic, spelling) = rng.pick(&keys).ok_or(TheoryError::OutOfRange("key"))?;
        let pool: Vec<Pitch> = (low.step()..=high.step())
            .map(|step| {
                let natural = Pitch::natural_at(step);
                Pitch {
                    accidental: spelling[natural.letter as usize],
                    ..natural
                }
            })
            .filter(|p| instrument.in_range(*p))
            .collect();
        (pool, Some(tonic))
    };
    let can_start = |p: Pitch| !rings_on(previous, instrument.sounding(p));
    let mut notes = walk(&pool, length, can_start, rng).ok_or(TheoryError::OutOfRange("note"))?;
    if options.chromatic {
        // Sharps going up, flats going down.
        for i in 1..notes.len() {
            if notes[i].midi() < notes[i - 1].midi() {
                notes[i] = Pitch::from_midi_flat(notes[i].midi());
            }
        }
    }
    // Only the letter and accidental of the key matter for the prompt.
    let key = key.map(|tonic| Pitch { octave: 4, ..tonic });
    Ok(PitchTask {
        prompt: Prompt::Echo { key },
        clef: instrument.clef(),
        notes: notes
            .iter()
            .enumerate()
            .map(|(i, &p)| PitchTask::note(instrument, p, i == 0 && options.show_first))
            .collect(),
        matching: if options.any_octave {
            Matching::AnyOctave
        } else {
            Matching::Exact
        },
        play_first: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thirteen_common_major_keys() {
        let keys = major_keys();
        let names: Vec<String> = keys.iter().map(|(t, _)| t.to_string()).collect();
        assert_eq!(keys.len(), 13, "{names:?}");
        for name in ["C4", "F#4", "Gb4", "Db4", "B4"] {
            assert!(names.contains(&name.to_string()), "{name} in {names:?}");
        }
        assert!(!names.contains(&"C#4".to_string()), "7 sharps");
        let (_, d_major) = keys.iter().find(|(t, _)| t.to_string() == "D4").unwrap();
        assert_eq!(d_major, &[1, 0, 0, 1, 0, 0, 0], "F# and C#");
    }

    #[test]
    fn melodies_stay_in_the_key_with_small_steps() {
        let options = EarOptions {
            notes: 8,
            ..Default::default()
        };
        let mut rng = Rng::new(21);
        for instrument in Instrument::ALL {
            let mut previous: Option<PitchTask> = None;
            for _ in 0..20 {
                let task = generate(&options, instrument, previous.as_ref(), &mut rng).unwrap();
                assert_eq!(task.notes.len(), 8);
                assert!(task.play_first);
                let Prompt::Echo { key: Some(tonic) } = task.prompt else {
                    panic!("diatonic tasks name their key");
                };
                let scale = ScaleKind::Major.notes(tonic, false).unwrap();
                for n in &task.notes {
                    assert!(instrument.in_range(n.written));
                    assert!(!n.given);
                    assert!(
                        scale.iter().any(|s| s.letter == n.written.letter
                            && s.accidental == n.written.accidental),
                        "{} not in {tonic} major",
                        n.written
                    );
                }
                for w in task.notes.windows(2) {
                    let step = (w[1].midi - w[0].midi).abs();
                    assert!(step > 0 && step <= MAX_LEAP, "{w:?}");
                }
                previous = Some(task);
            }
        }
    }

    #[test]
    fn chromatic_melodies_spell_by_direction() {
        let options = EarOptions {
            notes: 8,
            chromatic: true,
            show_first: true,
            any_octave: true,
        };
        let mut rng = Rng::new(4);
        for _ in 0..50 {
            let task = generate(&options, Instrument::Violin, None, &mut rng).unwrap();
            assert_eq!(task.prompt, Prompt::Echo { key: None });
            assert_eq!(task.matching, Matching::AnyOctave);
            assert!(task.notes[0].given && !task.notes[1].given);
            for w in task.notes.windows(2) {
                let accidental = w[1].written.accidental;
                if w[1].midi > w[0].midi {
                    assert!(accidental >= 0, "sharps going up: {w:?}");
                } else {
                    assert!(accidental <= 0, "flats going down: {w:?}");
                }
            }
        }
    }

    #[test]
    fn one_note_is_pitch_matching() {
        let options = EarOptions {
            notes: 0,
            ..Default::default()
        };
        let task = generate(&options, Instrument::BassGuitar, None, &mut Rng::new(8)).unwrap();
        assert_eq!(task.notes.len(), 1, "clamped to at least one note");
        assert_eq!(task.matching, Matching::Exact);
    }
}
