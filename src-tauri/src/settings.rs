//! User settings, persisted as JSON in the app config directory (ADR 0004).

use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use audio_engine::DeviceId;
use rhythm::{CustomMode, Difficulty, NoteValue, RhythmOptions, Symbol, TimeSignature};
use serde::{Deserialize, Serialize};
use theory::{
    ChordOptions, EarOptions, Instrument, IntervalOptions, NoteReadingOptions, PitchExercise,
    PitchExerciseKind, ScaleOptions,
};

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

/// Allowed metronome tempo in BPM (quarter note = beat).
pub const MIN_BPM: u32 = 40;
pub const MAX_BPM: u32 = 200;
pub const DEFAULT_BPM: u32 = 80;
pub const DEFAULT_BARS: u32 = 16;

/// Rhythm practice choices, see docs/features/practice.md.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RhythmPracticeSettings {
    pub bpm: u32,
    pub difficulty: Difficulty,
    /// Used when `difficulty` is `Custom`.
    pub custom: RhythmOptions,
    /// Custom: generate randomly from `custom`, or play `written`.
    pub custom_mode: CustomMode,
    /// The user's own rhythm, in order (laid out into bars by the time
    /// signature, ADR 0009).
    pub written: Vec<Symbol>,
    pub time_signature: TimeSignature,
    pub bars: u32,
}

impl Default for RhythmPracticeSettings {
    fn default() -> Self {
        Self {
            bpm: DEFAULT_BPM,
            difficulty: Difficulty::Easy,
            custom: Difficulty::Medium.preset().unwrap_or(RhythmOptions {
                values: vec![NoteValue::Quarter],
                dotted: false,
                rests: false,
            }),
            custom_mode: CustomMode::Random,
            written: Vec::new(),
            time_signature: TimeSignature::default(),
            bars: DEFAULT_BARS,
        }
    }
}

impl RhythmPracticeSettings {
    /// The options in effect: the preset, or the custom selection.
    pub fn options(&self) -> RhythmOptions {
        self.difficulty
            .preset()
            .unwrap_or_else(|| self.custom.clone())
    }
}

/// Pitch exercise choices (ADR 0011), see docs/features/practice.md.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PitchPracticeSettings {
    /// The instrument played: clef, transposition and range of every pitch
    /// exercise.
    pub instrument: Instrument,
    pub notes: NoteReadingOptions,
    pub intervals: IntervalOptions,
    pub scales: ScaleOptions,
    pub chords: ChordOptions,
    pub ear: EarOptions,
}

impl PitchPracticeSettings {
    /// The exercise `kind` with its saved options.
    pub fn exercise(&self, kind: PitchExerciseKind) -> PitchExercise {
        match kind {
            PitchExerciseKind::Notes => PitchExercise::Notes(self.notes),
            PitchExerciseKind::Intervals => PitchExercise::Intervals(self.intervals.clone()),
            PitchExerciseKind::Scales => PitchExercise::Scales(self.scales.clone()),
            PitchExerciseKind::Chords => PitchExercise::Chords(self.chords.clone()),
            PitchExerciseKind::Ear => PitchExercise::Ear(self.ear),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PracticeSettings {
    pub rhythm: RhythmPracticeSettings,
    pub pitch: PitchPracticeSettings,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// `None` = use the system default input device.
    pub input_device: Option<DeviceId>,
    pub gain_db: f32,
    pub latency: Option<LatencyCalibration>,
    pub practice: PracticeSettings,
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
    let rhythm = &mut s.practice.rhythm;
    rhythm.bpm = rhythm.bpm.clamp(MIN_BPM, MAX_BPM);
    rhythm.bars = rhythm.bars.clamp(rhythm::MIN_BARS, rhythm::MAX_BARS);
    if TimeSignature::new(rhythm.time_signature.beats_per_bar).is_err() {
        rhythm.time_signature = TimeSignature::default();
    }
    rhythm.custom.values.sort();
    rhythm.custom.values.dedup();
    rhythm.written.retain(Symbol::is_valid);
    rhythm.written.truncate(rhythm::MAX_WRITTEN_SYMBOLS);
    let pitch = &mut s.practice.pitch;
    pitch.intervals.intervals.sort();
    pitch.intervals.intervals.dedup();
    pitch.scales.scales.sort();
    pitch.scales.scales.dedup();
    pitch.chords.chords.sort();
    pitch.chords.chords.dedup();
    pitch.ear.notes = pitch
        .ear
        .notes
        .clamp(theory::MIN_EAR_NOTES, theory::MAX_EAR_NOTES);
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

    #[test]
    fn rhythm_defaults_and_old_files() {
        let path = temp_path("rhythm");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        // A file from before practice settings existed.
        std::fs::write(&path, r#"{"gainDb": 3}"#).unwrap();
        let rhythm = SettingsStore::load(path.clone()).get().practice.rhythm;
        assert_eq!(rhythm, RhythmPracticeSettings::default());
        assert_eq!((rhythm.bpm, rhythm.bars), (DEFAULT_BPM, DEFAULT_BARS));
        assert_eq!(rhythm.options(), Difficulty::Easy.preset().unwrap());

        let raw = r#"{"practice": {"rhythm": {"bpm": 999, "bars": 0,
            "timeSignature": {"beatsPerBar": 7}, "difficulty": "custom",
            "custom": {"values": ["eighth", "eighth"], "dotted": false, "rests": true}}}}"#;
        std::fs::write(&path, raw).unwrap();
        let rhythm = SettingsStore::load(path.clone()).get().practice.rhythm;
        assert_eq!((rhythm.bpm, rhythm.bars), (MAX_BPM, 1));
        assert_eq!(rhythm.time_signature, TimeSignature::default());
        assert_eq!(rhythm.options().values, vec![NoteValue::Eighth]);
        assert_eq!(rhythm.custom_mode, CustomMode::Random);
        assert!(rhythm.written.is_empty());

        let raw = r#"{"practice": {"rhythm": {"customMode": "written", "written": [
            {"value": "quarter", "dotted": false, "rest": false},
            {"value": "sixteenth", "dotted": true, "rest": false}]}}}"#;
        std::fs::write(&path, raw).unwrap();
        let rhythm = SettingsStore::load(path.clone()).get().practice.rhythm;
        assert_eq!(rhythm.custom_mode, CustomMode::Written);
        assert_eq!(rhythm.written.len(), 1, "dotted sixteenth dropped");
        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn pitch_defaults_and_round_trip() {
        let path = temp_path("pitch");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        // A file from before pitch exercises existed.
        std::fs::write(&path, r#"{"practice": {"rhythm": {"bpm": 90}}}"#).unwrap();
        let store = SettingsStore::load(path.clone());
        assert_eq!(store.get().practice.pitch, PitchPracticeSettings::default());
        assert_eq!(store.get().practice.pitch.instrument, Instrument::Guitar);

        store
            .update(|s| {
                s.practice.pitch.instrument = Instrument::Viola;
                s.practice.pitch.notes.ledger_lines = true;
            })
            .unwrap();
        let pitch = SettingsStore::load(path.clone()).get().practice.pitch;
        assert_eq!(pitch.instrument, Instrument::Viola);
        assert_eq!(
            pitch.exercise(PitchExerciseKind::Notes),
            PitchExercise::Notes(NoteReadingOptions {
                ledger_lines: true,
                ..Default::default()
            })
        );
        assert_eq!(pitch.intervals, IntervalOptions::default());

        let raw = r#"{"practice": {"pitch": {"intervals": {
            "intervals": ["octave", "minorThird", "octave"], "directions": "both"}}}}"#;
        std::fs::write(&path, raw).unwrap();
        let intervals = SettingsStore::load(path.clone())
            .get()
            .practice
            .pitch
            .intervals;
        assert_eq!(
            intervals.intervals,
            vec![
                theory::IntervalName::MinorThird,
                theory::IntervalName::Octave
            ],
            "sorted, duplicates removed"
        );
        assert_eq!(intervals.directions, theory::Directions::Both);
        assert!(!intervals.show_both);

        let raw = r#"{"practice": {"pitch": {"scales": {
            "scales": ["dorian", "major", "dorian"], "upAndDown": true}}}}"#;
        std::fs::write(&path, raw).unwrap();
        let scales = SettingsStore::load(path.clone())
            .get()
            .practice
            .pitch
            .scales;
        assert_eq!(
            scales.scales,
            vec![theory::ScaleKind::Major, theory::ScaleKind::Dorian]
        );
        assert!(scales.up_and_down && !scales.show_notes);
        assert_eq!(
            SettingsStore::load(path.clone())
                .get()
                .practice
                .pitch
                .chords,
            theory::ChordOptions::default()
        );

        let raw = r#"{"practice": {"pitch": {"ear": {"notes": 99, "chromatic": true}}}}"#;
        std::fs::write(&path, raw).unwrap();
        let ear = SettingsStore::load(path.clone()).get().practice.pitch.ear;
        assert_eq!(ear.notes, theory::MAX_EAR_NOTES, "clamped");
        assert!(ear.chromatic && !ear.show_first && !ear.any_octave);
        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }
}
