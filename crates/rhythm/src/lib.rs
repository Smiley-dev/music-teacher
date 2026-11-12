//! Rhythm exercises: note values, time signatures, difficulty presets and a
//! seeded generator. Pure: no devices, threads or UI (ADR 0006).
//!
//! All durations are integers in sixteenths, the shortest value.

mod generate;
mod model;
mod rng;

pub use generate::generate;
pub use model::{
    Bar, Difficulty, Exercise, MAX_BARS, MIN_BARS, NoteValue, PlacedSymbol, RhythmError,
    RhythmOptions, SIXTEENTHS_PER_BEAT, Symbol, TimeSignature,
};
