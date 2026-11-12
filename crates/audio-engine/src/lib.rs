//! Audio engine: device enumeration and real-time input capture.
//!
//! Real-time rule: code that runs inside a cpal audio callback must never
//! allocate, lock, do I/O, or log. Write results into pre-allocated atomics or
//! a lock-free ring buffer and process them on another thread.

mod monitor;

use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

pub use monitor::{InputMonitor, MonitorInfo};

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("failed to enumerate devices: {0}")]
    Devices(#[from] cpal::DevicesError),
    #[error("audio host `{0}` is not available")]
    HostUnavailable(String),
    #[error("input device `{0}` was not found (was it unplugged?)")]
    DeviceNotFound(String),
    #[error("could not read device configuration: {0}")]
    Config(#[from] cpal::DefaultStreamConfigError),
    #[error("could not open input stream: {0}")]
    BuildStream(#[from] cpal::BuildStreamError),
    #[error("could not start input stream: {0}")]
    PlayStream(#[from] cpal::PlayStreamError),
    #[error("unsupported sample format: {0}")]
    UnsupportedFormat(cpal::SampleFormat),
    #[error("audio thread stopped unexpectedly")]
    ThreadDied,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceInfo {
    pub name: String,
    pub host: String,
    pub is_default: bool,
    pub channels: Option<u16>,
    pub sample_rate: Option<u32>,
    pub sample_format: Option<String>,
}

/// List all input devices on every available audio host (WASAPI, ASIO, ...).
pub fn list_input_devices() -> Result<Vec<InputDeviceInfo>, AudioError> {
    let mut out = Vec::new();
    for host_id in cpal::available_hosts() {
        let Ok(host) = cpal::host_from_id(host_id) else { continue };
        let default_name = host.default_input_device().and_then(|d| d.name().ok());
        for device in host.input_devices()? {
            let name = device.name().unwrap_or_else(|_| "<unknown>".into());
            let config = device.default_input_config().ok();
            out.push(InputDeviceInfo {
                is_default: default_name.as_deref() == Some(name.as_str()),
                host: host_id.name().to_string(),
                channels: config.as_ref().map(|c| c.channels()),
                sample_rate: config.as_ref().map(|c| c.sample_rate().0),
                sample_format: config.as_ref().map(|c| c.sample_format().to_string()),
                name,
            });
        }
    }
    Ok(out)
}

/// Find an input device by host name (e.g. "WASAPI") and device name.
pub(crate) fn find_input_device(host: &str, name: &str) -> Result<cpal::Device, AudioError> {
    let host_id = cpal::available_hosts()
        .into_iter()
        .find(|id| id.name() == host)
        .ok_or_else(|| AudioError::HostUnavailable(host.to_string()))?;
    let host = cpal::host_from_id(host_id)
        .map_err(|_| AudioError::HostUnavailable(host.to_string()))?;
    host.input_devices()?
        .find(|d| d.name().is_ok_and(|n| n == name))
        .ok_or_else(|| AudioError::DeviceNotFound(name.to_string()))
}
