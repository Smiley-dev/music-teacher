//! Music theory and pitch exercises: spelled pitches, instruments, task
//! generators and the note judge. Pure: no devices, threads or UI (ADR 0011).
//!
//! Notes are spelled (letter, accidental, octave) so they can be drawn on a
//! staff; what the player must play is the sounding MIDI note, which differs
//! for transposing instruments (guitar sounds an octave lower than written).

mod chord;
mod exercise;
mod instrument;
mod interval;
mod judge;
mod notes;
mod pitch;
mod rng;
mod scale;
mod task;

pub use chord::{ChordKind, ChordOptions};
pub use exercise::{PitchExercise, PitchExerciseKind, TheoryError, generate};
pub use instrument::{Clef, Instrument};
pub use interval::{Direction, Directions, IntervalName, IntervalOptions};
pub use judge::{CONFIRM_SECS, Heard, NoteJudge, WRONG_SECS};
pub use notes::{NoteReadingOptions, note_pool};
pub use pitch::{Letter, Pitch};
pub use scale::{ScaleKind, ScaleOptions};
pub use task::{Matching, PitchTask, Prompt, TaskNote};
