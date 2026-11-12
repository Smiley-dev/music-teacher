//! Rhythm exercises: note values, time signatures, difficulty presets, a
//! seeded generator and timing judgement. Pure: no devices, threads or UI
//! (ADR 0006, ADR 0008).
//!
//! All durations are integers in sixteenths, the shortest value.

mod generate;
mod judge;
mod model;
mod rng;

pub use generate::generate;
pub use judge::{
    Judgement, MAX_WINDOW_MS, ON_TIME_MS, TimingJudge, TimingReport, TimingResult, TimingSummary,
};
pub use model::{
    Bar, Difficulty, Exercise, MAX_BARS, MIN_BARS, NoteValue, PlacedSymbol, RhythmError,
    RhythmOptions, SIXTEENTHS_PER_BEAT, Symbol, TimeSignature,
};
