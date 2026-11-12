//! Signal analysis: pitch, onsets, meters, calibration math and music theory.
//!
//! Pure, UI-free and audio-device-free so it can be unit tested with
//! synthetic signals. See docs/ARCHITECTURE.md.

pub mod calibration;
pub mod meter;
pub mod note;
pub mod onset;
pub mod pitch;
pub mod stabilizer;
pub mod waveform;

pub use calibration::{CalibrationError, LatencyEstimate, estimate_latency};
pub use meter::{ChannelMeter, MeterReading};
pub use note::Note;
pub use onset::OnsetDetector;
pub use pitch::{PitchReading, PitchTracker};
pub use stabilizer::{NoteStabilizer, StableNote};
pub use waveform::SampleHistory;
