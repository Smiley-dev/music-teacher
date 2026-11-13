//! The pitch exercises and their task generator.

use serde::{Deserialize, Serialize};

use crate::chord::{self, ChordOptions};
use crate::ear::{self, EarOptions};
use crate::instrument::Instrument;
use crate::interval::{self, IntervalOptions};
use crate::notes::{self, NoteReadingOptions};
use crate::rng::Rng;
use crate::scale::{self, ScaleOptions};
use crate::task::PitchTask;

/// Which pitch exercise (the Practice tab).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PitchExerciseKind {
    Notes,
    Intervals,
    Scales,
    Chords,
    Ear,
}

/// A pitch exercise with its options.
#[derive(Debug, Clone, PartialEq)]
pub enum PitchExercise {
    Notes(NoteReadingOptions),
    Intervals(IntervalOptions),
    Scales(ScaleOptions),
    Chords(ChordOptions),
    Ear(EarOptions),
}

impl PitchExercise {
    pub fn kind(&self) -> PitchExerciseKind {
        match self {
            Self::Notes(_) => PitchExerciseKind::Notes,
            Self::Intervals(_) => PitchExerciseKind::Intervals,
            Self::Scales(_) => PitchExerciseKind::Scales,
            Self::Chords(_) => PitchExerciseKind::Chords,
            Self::Ear(_) => PitchExerciseKind::Ear,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum TheoryError {
    #[error("Select at least one {0}.")]
    NothingSelected(&'static str),
    #[error("No {0} fits the range of this instrument.")]
    OutOfRange(&'static str),
}

/// Whether a task starting on `midi` would start on the previous task's last
/// note (in any octave). That note may still be ringing, and a ringing note
/// is only judged again after it stops, so generators avoid it.
pub(crate) fn rings_on(previous: Option<&PitchTask>, midi: i32) -> bool {
    previous
        .and_then(|p| p.notes.last())
        .is_some_and(|last| (last.midi - midi).rem_euclid(12) == 0)
}

/// A new random task. Deterministic for a given `seed`; `previous` (the task
/// before) is used to avoid asking the same thing twice in a row.
pub fn generate(
    exercise: &PitchExercise,
    instrument: Instrument,
    previous: Option<&PitchTask>,
    seed: u64,
) -> Result<PitchTask, TheoryError> {
    let mut rng = Rng::new(seed);
    match exercise {
        PitchExercise::Notes(options) => notes::generate(options, instrument, previous, &mut rng),
        PitchExercise::Intervals(options) => {
            interval::generate(options, instrument, previous, &mut rng)
        }
        PitchExercise::Scales(options) => scale::generate(options, instrument, previous, &mut rng),
        PitchExercise::Chords(options) => chord::generate(options, instrument, previous, &mut rng),
        PitchExercise::Ear(options) => ear::generate(options, instrument, previous, &mut rng),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_task() {
        for exercise in [
            PitchExercise::Notes(NoteReadingOptions::default()),
            PitchExercise::Intervals(IntervalOptions::default()),
            PitchExercise::Scales(ScaleOptions::default()),
            PitchExercise::Chords(ChordOptions::default()),
            PitchExercise::Ear(EarOptions::default()),
        ] {
            let a = generate(&exercise, Instrument::Violin, None, 42).unwrap();
            let b = generate(&exercise, Instrument::Violin, None, 42).unwrap();
            assert_eq!(a, b);
        }
        let exercise = PitchExercise::Intervals(IntervalOptions::default());
        assert_eq!(exercise.kind(), PitchExerciseKind::Intervals);
    }

    #[test]
    fn every_instrument_has_tasks_for_the_defaults() {
        for instrument in Instrument::ALL {
            for exercise in [
                PitchExercise::Notes(NoteReadingOptions::default()),
                PitchExercise::Intervals(IntervalOptions::default()),
                PitchExercise::Scales(ScaleOptions::default()),
                PitchExercise::Chords(ChordOptions::default()),
                PitchExercise::Ear(EarOptions::default()),
            ] {
                let mut previous = None;
                for seed in 0..20 {
                    let task = generate(&exercise, instrument, previous.as_ref(), seed);
                    let task = task.unwrap_or_else(|e| panic!("{instrument:?} {exercise:?}: {e}"));
                    previous = Some(task);
                }
            }
        }
    }
}
