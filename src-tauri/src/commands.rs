//! Tauri commands: thin wrappers around the engine and settings.
//! Wrapped on the frontend by `src/lib/engine.ts`.

use audio_engine::{DeviceId, InputDeviceInfo};
use tauri::State;
use tauri::ipc::Channel;
use tauri_plugin_opener::OpenerExt;

use crate::engine::AudioEngine;
use crate::engine::events::{EngineEvent, EngineSnapshot};
use crate::settings::{
    PitchPracticeSettings, ReadingPracticeSettings, RhythmPracticeSettings, Settings,
};
use rhythm::{Exercise, ExerciseDraft};
use theory::{PitchExerciseKind, ReadingExercise};

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
pub fn unsubscribe_engine(subscription_id: u64, engine: State<'_, AudioEngine>) {
    engine.unsubscribe(subscription_id);
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

/// Save rhythm practice settings; returns the (clamped) saved settings.
#[tauri::command]
pub fn set_rhythm_settings(
    rhythm: RhythmPracticeSettings,
    engine: State<'_, AudioEngine>,
) -> Result<Settings, String> {
    engine.set_rhythm_settings(rhythm)
}

/// The exercise for the saved rhythm settings (random, or the written one).
#[tauri::command]
pub fn generate_rhythm_exercise(engine: State<'_, AudioEngine>) -> Result<ExerciseDraft, String> {
    engine.generate_rhythm_exercise()
}

/// Play `exercise` with count-in and metronome; progress arrives as events.
#[tauri::command]
pub fn start_rhythm_practice(
    exercise: Exercise,
    engine: State<'_, AudioEngine>,
) -> Result<(), String> {
    engine.start_rhythm_practice(exercise)
}

/// Play `exercise` back as tones on a random note, with count-in and
/// metronome; progress arrives as events.
#[tauri::command]
pub fn listen_to_rhythm(exercise: Exercise, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.listen_to_rhythm(exercise)
}

#[tauri::command]
pub fn stop_rhythm_practice(engine: State<'_, AudioEngine>) {
    engine.stop_rhythm_practice();
}

/// Save pitch practice settings (instrument, exercise options).
#[tauri::command]
pub fn set_pitch_settings(
    pitch: PitchPracticeSettings,
    engine: State<'_, AudioEngine>,
) -> Result<Settings, String> {
    engine.set_pitch_settings(pitch)
}

/// Start a pitch exercise with its saved options; progress arrives as events.
#[tauri::command]
pub fn start_pitch_practice(
    exercise: PitchExerciseKind,
    engine: State<'_, AudioEngine>,
) -> Result<(), String> {
    engine.start_pitch_practice(exercise)
}

#[tauri::command]
pub fn stop_pitch_practice(engine: State<'_, AudioEngine>) {
    engine.stop_pitch_practice();
}

/// Show the current task's answer and move on to the next one.
#[tauri::command]
pub fn skip_pitch_task(engine: State<'_, AudioEngine>) {
    engine.skip_pitch_task();
}

/// Play the current task's notes (again).
#[tauri::command]
pub fn replay_pitch_task(engine: State<'_, AudioEngine>) {
    engine.replay_pitch_task();
}

/// Save sight-reading settings (tempo, melody options).
#[tauri::command]
pub fn set_reading_settings(
    reading: ReadingPracticeSettings,
    engine: State<'_, AudioEngine>,
) -> Result<Settings, String> {
    engine.set_reading_settings(reading)
}

/// A new sight-reading melody for the saved options and instrument.
#[tauri::command]
pub fn generate_reading_exercise(
    engine: State<'_, AudioEngine>,
) -> Result<ReadingExercise, String> {
    engine.generate_reading_exercise()
}

/// Play the melody back with count-in and metronome; progress arrives as
/// practice events.
#[tauri::command]
pub fn listen_to_reading(
    exercise: ReadingExercise,
    engine: State<'_, AudioEngine>,
) -> Result<(), String> {
    engine.listen_to_reading(exercise)
}

/// Play the melody at your own pace, judged by pitch; progress arrives as
/// reading events.
#[tauri::command]
pub fn start_reading_practice(
    exercise: ReadingExercise,
    engine: State<'_, AudioEngine>,
) -> Result<(), String> {
    engine.start_reading_practice(exercise)
}

#[tauri::command]
pub fn stop_reading_practice(engine: State<'_, AudioEngine>) {
    engine.stop_reading_practice();
}

#[tauri::command]
pub fn open_microphone_privacy_settings(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(MICROPHONE_PRIVACY_URL, None::<&str>)
        .map_err(|e| e.to_string())
}
