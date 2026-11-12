//! Signal analysis: pitch detection and music-theory helpers.
//!
//! Pure, UI-free and audio-device-free so it can be unit tested with
//! synthetic signals or recorded WAV files.

mod note;
mod pitch;

pub use note::Note;
pub use pitch::{PitchReading, PitchTracker};
