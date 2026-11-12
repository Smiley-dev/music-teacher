//! Rhythm exercises: note values, time signatures, difficulty presets, a
//! seeded generator and timing judgement. Pure: no devices, threads or UI
//! (ADR 0006, 0008, 0009).
//!
//! All durations are integers in sixteenths, the shortest value.

mod generate;
mod judge;
mod model;
mod rng;
mod written;

pub use generate::generate;
pub use judge::{
    FAST_NOTE_GAP_MS, Judgement, MAX_WINDOW_MS, MIN_JUDGEABLE_GAP_MS, ON_TIME_MS, TimingJudge,
    TimingReport, TimingResult, TimingSummary,
};
pub use model::{
    Bar, CustomMode, Difficulty, Exercise, MAX_BARS, MIN_BARS, NoteValue, PlacedSymbol,
    RhythmError, RhythmOptions, SIXTEENTHS_PER_BEAT, Symbol, TimeSignature,
};
pub use written::{ExerciseDraft, MAX_WRITTEN_SYMBOLS, layout};
