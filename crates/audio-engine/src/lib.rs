//! Audio device I/O with cpal: device listing, timestamped input capture and
//! sample-accurate click output. No analysis and no UI code here.
//!
//! Real-time rule: code that runs inside a cpal data callback must never
//! allocate, lock, do I/O, or log. It only moves data into pre-allocated,
//! lock-free ring buffers.

mod input;
mod output;

use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

pub use cpal::StreamInstant;
pub use input::{BufferTimestamp, InputStream, StreamInfo};
pub use output::{ClickPlayer, ClickSchedule, ClickTimestamp, Tone};

/// Identifies an input device across restarts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceId {
    /// Audio host name, e.g. "WASAPI".
    pub host: String,
    /// Device name as reported by the host.
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceInfo {
    pub id: DeviceId,
    pub is_default: bool,
    pub channels: Option<u16>,
    pub sample_rate: Option<u32>,
    pub sample_format: Option<String>,
}

/// Broad category of an audio failure, for choosing what to tell the user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    /// The OS blocked access (Windows microphone privacy setting).
    PermissionDenied,
    /// There are no input devices at all.
    NoDevices,
    /// The device disappeared, reset or is not plugged in.
    DeviceLost,
    Other,
}

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("failed to enumerate devices: {0}")]
    Devices(#[from] cpal::DevicesError),
    #[error("no input devices found")]
    NoInputDevices,
    #[error("no output device found")]
    NoOutputDevice,
    #[error("audio host `{0}` is not available")]
    HostUnavailable(String),
    #[error("input device `{0}` is not connected")]
    DeviceNotFound(String),
    #[error("could not read device configuration: {0}")]
    Config(#[from] cpal::DefaultStreamConfigError),
    #[error("could not open audio stream: {0}")]
    BuildStream(#[from] cpal::BuildStreamError),
    #[error("could not start audio stream: {0}")]
    PlayStream(#[from] cpal::PlayStreamError),
    #[error("audio stream stopped: {0}")]
    Stream(#[from] cpal::StreamError),
    #[error("unsupported sample format: {0}")]
    UnsupportedFormat(cpal::SampleFormat),
    #[error("audio thread stopped unexpectedly")]
    ThreadDied,
}

impl AudioError {
    pub fn kind(&self) -> ErrorKind {
        use cpal::{
            BuildStreamError as B, DefaultStreamConfigError as C, PlayStreamError as P,
            StreamError as S,
        };
        match self {
            Self::NoInputDevices => ErrorKind::NoDevices,
            Self::DeviceNotFound(_)
            | Self::Config(C::DeviceNotAvailable)
            | Self::BuildStream(B::DeviceNotAvailable)
            | Self::PlayStream(P::DeviceNotAvailable)
            | Self::Stream(S::DeviceNotAvailable) => ErrorKind::DeviceLost,
            other if is_access_denied(&other.to_string()) => ErrorKind::PermissionDenied,
            _ => ErrorKind::Other,
        }
    }
}

/// WASAPI reports a blocked microphone as E_ACCESSDENIED (0x80070005).
fn is_access_denied(message: &str) -> bool {
    let m = message.to_ascii_lowercase();
    m.contains("0x80070005") || m.contains("access is denied") || m.contains("access denied")
}

/// List all input devices on every available audio host (WASAPI, ASIO, ...).
pub fn list_input_devices() -> Result<Vec<InputDeviceInfo>, AudioError> {
    let mut out = Vec::new();
    for host_id in cpal::available_hosts() {
        let Ok(host) = cpal::host_from_id(host_id) else {
            continue;
        };
        let default_name = host.default_input_device().and_then(|d| d.name().ok());
        for device in host.input_devices()? {
            let name = device.name().unwrap_or_else(|_| "<unknown>".into());
            let config = device.default_input_config().ok();
            out.push(InputDeviceInfo {
                is_default: default_name.as_deref() == Some(name.as_str()),
                id: DeviceId {
                    host: host_id.name().to_string(),
                    name,
                },
                channels: config.as_ref().map(|c| c.channels()),
                sample_rate: config.as_ref().map(|c| c.sample_rate().0),
                sample_format: config.as_ref().map(|c| c.sample_format().to_string()),
            });
        }
    }
    Ok(out)
}

/// The system default input device, if any.
pub fn default_input_device() -> Result<DeviceId, AudioError> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or(AudioError::NoInputDevices)?;
    Ok(DeviceId {
        host: host.id().name().to_string(),
        name: device.name().map_err(|_| AudioError::NoInputDevices)?,
    })
}

fn find_input_device(id: &DeviceId) -> Result<cpal::Device, AudioError> {
    let host_id = cpal::available_hosts()
        .into_iter()
        .find(|h| h.name() == id.host)
        .ok_or_else(|| AudioError::HostUnavailable(id.host.clone()))?;
    let host =
        cpal::host_from_id(host_id).map_err(|_| AudioError::HostUnavailable(id.host.clone()))?;
    let mut devices = host.input_devices()?.peekable();
    if devices.peek().is_none() {
        return Err(AudioError::NoInputDevices);
    }
    devices
        .find(|d| d.name().is_ok_and(|n| n == id.name))
        .ok_or_else(|| AudioError::DeviceNotFound(id.name.clone()))
}

/// `later - earlier` in seconds; negative if `later` is actually earlier.
pub fn signed_secs(later: &StreamInstant, earlier: &StreamInstant) -> f64 {
    match later.duration_since(earlier) {
        Some(d) => d.as_secs_f64(),
        None => -earlier
            .duration_since(later)
            .map_or(0.0, |d| d.as_secs_f64()),
    }
}

/// `instant + frames / sample_rate`.
pub fn offset_instant(instant: &StreamInstant, frames: u64, sample_rate: u32) -> StreamInstant {
    let offset = std::time::Duration::from_secs_f64(frames as f64 / sample_rate as f64);
    instant.add(offset).unwrap_or(*instant)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_errors() {
        assert_eq!(AudioError::NoInputDevices.kind(), ErrorKind::NoDevices);
        assert_eq!(
            AudioError::DeviceNotFound("x".into()).kind(),
            ErrorKind::DeviceLost
        );
        let denied = cpal::BuildStreamError::BackendSpecific {
            err: cpal::BackendSpecificError {
                description: "Access is denied. (0x80070005)".into(),
            },
        };
        assert_eq!(
            AudioError::BuildStream(denied).kind(),
            ErrorKind::PermissionDenied
        );
        assert_eq!(
            AudioError::UnsupportedFormat(cpal::SampleFormat::U8).kind(),
            ErrorKind::Other
        );
    }

    #[test]
    fn instant_math() {
        let a = StreamInstant::new(10, 0);
        let b = offset_instant(&a, 4_800, 48_000);
        assert!((signed_secs(&b, &a) - 0.1).abs() < 1e-9);
        assert!((signed_secs(&a, &b) + 0.1).abs() < 1e-9);
    }
}
