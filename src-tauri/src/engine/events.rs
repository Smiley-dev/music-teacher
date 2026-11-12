//! Types sent from the engine to the UI. Mirrored in `src/lib/engine.ts`.

use audio_engine::{DeviceId, ErrorKind, StreamInfo};
use dsp::{MeterReading, StableNote};
use serde::Serialize;

use crate::settings::{LatencyCalibration, Settings};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
    Status { status: EngineStatus },
    Frame { frame: Frame },
    Calibration { calibration: CalibrationState },
    Settings { settings: Settings },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EngineState {
    /// Opening the device.
    Starting,
    /// Capturing and analysing.
    Running,
    /// The stream was running and died; reopening.
    Reconnecting,
    /// The device could not be opened; retrying.
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineError {
    pub kind: ErrorKind,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub state: EngineState,
    /// The device in use or being opened (`None` while none is available).
    pub device: Option<DeviceId>,
    pub stream: Option<StreamInfo>,
    pub error: Option<EngineError>,
}

/// One analysis frame, ~30 per second.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    /// One meter per input channel (after gain).
    pub meters: Vec<MeterReading>,
    /// `[min, max]` pairs of the most recent samples of `waveform_channel`.
    pub waveform: Vec<f32>,
    pub waveform_channel: usize,
    pub note: Option<StableNote>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "phase", rename_all = "camelCase")]
pub enum CalibrationState {
    Idle,
    /// Clicks are playing. `beat` = clicks played so far (0 during lead-in).
    Running {
        beat: u32,
        beats_per_bar: u32,
        total_clicks: u32,
    },
    Done {
        latency: LatencyCalibration,
        rejected: usize,
    },
    Failed {
        message: String,
        matched: Option<usize>,
        total_clicks: u32,
    },
}

/// Everything a new subscriber needs to render immediately.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineSnapshot {
    /// Pass to `unsubscribe_engine` when the subscriber goes away.
    pub subscription_id: u64,
    pub status: EngineStatus,
    pub settings: Settings,
    pub calibration: CalibrationState,
}
