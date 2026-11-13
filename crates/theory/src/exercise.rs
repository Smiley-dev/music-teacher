//! The pitch exercises and their task generator.

use serde::{Deserialize, Serialize};

use crate::instrument::Instrument;
use crate::notes::{self, NoteReadingOptions};
use crate::rng::Rng;
use crate::task::PitchTask;

/// Which pitch exercise (the Practice tab).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PitchExerciseKind {
    Notes,
}

/// A pitch exercise with its options.
#[derive(Debug, Clone, PartialEq)]
pub enum PitchExercise {
    Notes(NoteReadingOptions),
}

impl PitchExercise {
    pub fn kind(&self) -> PitchExerciseKind {
        match self {
            Self::Notes(_) => PitchExerciseKind::Notes,
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_task() {
        let exercise = PitchExercise::Notes(NoteReadingOptions::default());
        let a = generate(&exercise, Instrument::Violin, None, 42).unwrap();
        let b = generate(&exercise, Instrument::Violin, None, 42).unwrap();
        assert_eq!(a, b);
        assert_eq!(exercise.kind(), PitchExerciseKind::Notes);
    }
}
