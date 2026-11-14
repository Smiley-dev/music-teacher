//! Music theory and pitch exercises: spelled pitches, instruments, task
//! generators and the note judge. Pure: no devices, threads or UI (ADR 0011).
//!
//! Notes are spelled (letter, accidental, octave) so they can be drawn on a
//! staff; what the player must play is the sounding MIDI note, which differs
//! for transposing instruments (guitar sounds an octave lower than written).
//!
//! Sight reading (`reading`) combines a rhythm from `crates/rhythm` with
//! pitches walking over a scale (ADR 0012).

mod chord;
mod ear;
mod exercise;
mod instrument;
mod interval;
mod judge;
mod key;
mod melody_check;
mod notes;
mod pitch;
mod reading;
mod rng;
mod scale;
mod task;

pub use chord::{ChordKind, ChordOptions};
pub use ear::{EarOptions, MAX_EAR_NOTES, MAX_LEAP, MIN_EAR_NOTES};
pub use exercise::{PitchExercise, PitchExerciseKind, TheoryError, generate};
pub use instrument::{Clef, Instrument};
pub use interval::{Direction, Directions, IntervalName, IntervalOptions};
pub use judge::{CONFIRM_SECS, Heard, NoteJudge, WRONG_SECS};
pub use key::{KeySignature, MAX_KEY_ACCIDENTALS};
pub use melody_check::{
    MIN_PITCH_READINGS, MelodyPitchJudge, PITCH_SETTLE_SECS, PitchCheck, PitchReport, PitchResult,
    PitchSummary,
};
pub use notes::{NoteReadingOptions, note_pool};
pub use pitch::{Letter, Pitch};
pub use reading::{
    IntervalSize, MAX_READING_BARS, ReadingExercise, ReadingNote, ReadingOptions, generate_reading,
};
pub use scale::{ScaleKind, ScaleOptions};
pub use task::{Matching, PitchTask, Prompt, TaskNote};
