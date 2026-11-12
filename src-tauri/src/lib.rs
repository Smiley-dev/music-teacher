mod commands;
mod engine;
mod settings;

use tauri::Manager;

use engine::AudioEngine;
use settings::SettingsStore;

const SETTINGS_FILE: &str = "settings.json";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let path = app.path().app_config_dir()?.join(SETTINGS_FILE);
            let engine = AudioEngine::start(SettingsStore::load(path))?;
            app.manage(engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_input_devices,
            commands::subscribe_engine,
            commands::unsubscribe_engine,
            commands::set_input_device,
            commands::set_gain_db,
            commands::set_latency_ms,
            commands::start_calibration,
            commands::cancel_calibration,
            commands::open_microphone_privacy_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
