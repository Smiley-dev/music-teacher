//! User settings, persisted as JSON in the app config directory (ADR 0004).

use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use audio_engine::DeviceId;
use serde::{Deserialize, Serialize};

/// Allowed input gain range in dB.
pub const MIN_GAIN_DB: f32 = -24.0;
pub const MAX_GAIN_DB: f32 = 24.0;
/// Manually entered latency must be within this range, in ms.
pub const MAX_ABS_LATENCY_MS: f64 = 2000.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LatencySource {
    Measured,
    Manual,
}

/// Round-trip latency (output + input + reaction offset), see ADR 0003.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatencyCalibration {
    pub ms: f64,
    pub source: LatencySource,
    /// For measured values: clicks that matched a played note.
    #[serde(default)]
    pub matched: Option<usize>,
    /// For measured values: clicks played.
    #[serde(default)]
    pub total_clicks: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// `None` = use the system default input device.
    pub input_device: Option<DeviceId>,
    pub gain_db: f32,
    pub latency: Option<LatencyCalibration>,
}

/// Owns the settings and their file. Every change is saved immediately.
pub struct SettingsStore {
    path: PathBuf,
    settings: Mutex<Settings>,
}

impl SettingsStore {
    /// Load from `path`; a missing or unreadable file gives defaults.
    pub fn load(path: PathBuf) -> Self {
        let settings = match std::fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_else(|e| {
                eprintln!("[settings] ignoring invalid {}: {e}", path.display());
                Settings::default()
            }),
            Err(_) => Settings::default(),
        };
        Self {
            path,
            settings: Mutex::new(sanitize(settings)),
        }
    }

    pub fn get(&self) -> Settings {
        self.lock().clone()
    }

    /// Apply `change`, save, and return the new settings. The in-memory value
    /// is updated even if saving fails (the error is returned).
    pub fn update(&self, change: impl FnOnce(&mut Settings)) -> Result<Settings, String> {
        let mut settings = self.lock();
        change(&mut settings);
        *settings = sanitize(settings.clone());
        let snapshot = settings.clone();
        drop(settings);
        save(&self.path, &snapshot).map_err(|e| format!("could not save settings: {e}"))?;
        Ok(snapshot)
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Settings> {
        self.settings.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

fn sanitize(mut s: Settings) -> Settings {
    s.gain_db = if s.gain_db.is_finite() {
        s.gain_db.clamp(MIN_GAIN_DB, MAX_GAIN_DB)
    } else {
        0.0
    };
    if s.latency
        .as_ref()
        .is_some_and(|l| !l.ms.is_finite() || l.ms.abs() > MAX_ABS_LATENCY_MS)
    {
        s.latency = None;
    }
    s
}

/// Write via a temp file + rename so a crash never leaves a half-written file.
fn save(path: &Path, settings: &Settings) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    std::fs::write(&tmp, json)?;
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!("music-teacher-test-{}-{name}", std::process::id()))
            .join("settings.json")
    }

    #[test]
    fn round_trips_through_the_file() {
        let path = temp_path("roundtrip");
        let store = SettingsStore::load(path.clone());
        assert_eq!(store.get(), Settings::default());
        store
            .update(|s| {
                s.gain_db = 6.0;
                s.input_device = Some(DeviceId {
                    host: "WASAPI".into(),
                    name: "Scarlett".into(),
                });
                s.latency = Some(LatencyCalibration {
                    ms: 42.5,
                    source: LatencySource::Measured,
                    matched: Some(15),
                    total_clicks: Some(16),
                });
            })
            .unwrap();
        let reloaded = SettingsStore::load(path.clone()).get();
        assert_eq!(reloaded, store.get());
        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn clamps_and_tolerates_bad_files() {
        let path = temp_path("bad");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, r#"{"gainDb": 99, "unknown": true}"#).unwrap();
        assert_eq!(SettingsStore::load(path.clone()).get().gain_db, MAX_GAIN_DB);
        std::fs::write(&path, "not json").unwrap();
        assert_eq!(SettingsStore::load(path.clone()).get(), Settings::default());
        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }
}
