//! Tauri commands: thin wrappers around the engine and settings.
//! Wrapped on the frontend by `src/lib/engine.ts`.

use audio_engine::{DeviceId, InputDeviceInfo};
use tauri::State;
use tauri::ipc::Channel;
use tauri_plugin_opener::OpenerExt;

use crate::engine::AudioEngine;
use crate::engine::events::{EngineEvent, EngineSnapshot};
use crate::settings::Settings;

/// Windows Settings page that controls microphone access for desktop apps.
const MICROPHONE_PRIVACY_URL: &str = "ms-settings:privacy-microphone";

#[tauri::command]
pub fn list_input_devices() -> Result<Vec<InputDeviceInfo>, String> {
    audio_engine::list_input_devices().map_err(|e| e.to_string())
}

/// Subscribe to engine events; returns the current state.
#[tauri::command]
pub fn subscribe_engine(
    on_event: Channel<EngineEvent>,
    engine: State<'_, AudioEngine>,
) -> EngineSnapshot {
    engine.subscribe(on_event)
}

#[tauri::command]
pub fn set_input_device(
    device: DeviceId,
    engine: State<'_, AudioEngine>,
) -> Result<Settings, String> {
    engine.set_input_device(device)
}

#[tauri::command]
pub fn set_gain_db(gain_db: f32, engine: State<'_, AudioEngine>) -> Result<Settings, String> {
    engine.set_gain_db(gain_db)
}

/// Save a manually entered latency in ms, or reset it with `null`.
#[tauri::command]
pub fn set_latency_ms(ms: Option<f64>, engine: State<'_, AudioEngine>) -> Result<Settings, String> {
    engine.set_latency_ms(ms)
}

/// Start the click-along calibration; progress arrives as engine events.
#[tauri::command]
pub fn start_calibration(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.start_calibration()
}

#[tauri::command]
pub fn cancel_calibration(engine: State<'_, AudioEngine>) {
    engine.cancel_calibration();
}

#[tauri::command]
pub fn open_microphone_privacy_settings(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(MICROPHONE_PRIVACY_URL, None::<&str>)
        .map_err(|e| e.to_string())
}
