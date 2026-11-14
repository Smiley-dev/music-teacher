//! Types sent from the engine to the UI. Mirrored in `src/lib/engine.ts`.

use audio_engine::{DeviceId, ErrorKind, StreamInfo};
use dsp::{MeterReading, StableNote};
use rhythm::{Judgement, TimingReport};
use serde::Serialize;
use theory::{PitchCheck, PitchExerciseKind, PitchReport, PitchTask};

use crate::settings::{LatencyCalibration, Settings};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
    Status {
        status: EngineStatus,
    },
    Frame {
        frame: Frame,
    },
    Calibration {
        calibration: CalibrationState,
    },
    Practice {
        practice: PracticeState,
    },
    /// Notes judged since the last event while a practice session runs.
    PracticeJudged {
        judgements: Vec<Judgement>,
    },
    /// Notes whose pitch was judged since the last event, while a
    /// sight-reading melody is played with the metronome.
    PracticePitched {
        checks: Vec<PitchCheck>,
    },
    /// Pitch practice (note reading, intervals …) state, whenever it changes.
    PitchPractice {
        pitch: PitchPracticeState,
    },
    /// Sight reading at your own pace, whenever it changes.
    Reading {
        reading: ReadingState,
    },
    Settings {
        /// Boxed: much larger than the other events, which are sent 30x/s.
        settings: Box<Settings>,
    },
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

/// `rename_all` only renames variants; `rename_all_fields` is needed so the
/// variants' fields are camelCase too (`beatsPerBar`, `totalClicks`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "phase",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
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

/// What a rhythm session does.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SessionMode {
    /// The user plays along and is judged.
    Practice,
    /// The exercise is played back as tones on `note` (e.g. "E3").
    Listen { note: String },
    /// A sight-reading melody is played back at its pitches.
    Melody,
}

/// Sight reading at your own pace (ADR 0012), sent whenever it changes.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "phase",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ReadingState {
    Idle,
    Running {
        /// Notes of the melody played correctly so far.
        progress: usize,
        total: usize,
        /// The last wrong note, as written (e.g. "F#4"); cleared by the next
        /// correct note.
        wrong: Option<String>,
        /// The note heard right now, as written.
        heard: Option<String>,
        mistakes: u32,
    },
    /// Every note played.
    Finished {
        notes: usize,
        mistakes: u32,
        /// From the first tick to the last note, on the audio clock.
        seconds: f64,
    },
    Failed {
        message: String,
    },
}

/// Rhythm practice session state, sent every engine tick while running.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "phase",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum PracticeState {
    Idle,
    Running {
        mode: SessionMode,
        /// Beats from the start of the exercise on the audio clock; negative
        /// during the count-in, `None` until the first click is scheduled.
        position_beats: Option<f64>,
        count_in_beats: u32,
        total_beats: u32,
    },
    /// The session played to the end; the timing analysis, and the pitch
    /// analysis for sight-reading melodies (`None` for rhythm practice).
    Finished {
        report: TimingReport,
        pitch: Option<PitchReport>,
    },
    Failed {
        message: String,
    },
}

/// Where the current pitch practice task is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskStage {
    /// The notes are being played to the user; not judging yet.
    Listening,
    /// Waiting for the user to play.
    Playing,
    /// Every note played; the next task follows shortly.
    Solved,
    /// Skipped: the answer is shown; the next task follows shortly.
    Revealed,
}

/// Running totals of a pitch practice session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchScore {
    /// Tasks played to the end.
    pub solved: u32,
    /// Solved without a single wrong note.
    pub clean: u32,
    pub skipped: u32,
    /// Wrong notes, all tasks together.
    pub wrong_notes: u32,
}

/// Pitch practice session state (ADR 0011), sent whenever it changes.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "phase",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum PitchPracticeState {
    Idle,
    Running {
        exercise: PitchExerciseKind,
        task: PitchTask,
        stage: TaskStage,
        /// Notes of `task` played correctly so far.
        progress: usize,
        /// The last wrong note of this task, as written for the instrument
        /// (e.g. "D#4"); cleared by the next correct note.
        wrong: Option<String>,
        /// The note heard right now, as written for the instrument.
        heard: Option<String>,
        /// Number of the current task, from 1.
        round: u32,
        score: PitchScore,
    },
    /// Stopped after at least one task: the final score.
    Finished {
        exercise: PitchExerciseKind,
        score: PitchScore,
    },
    Failed {
        message: String,
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
    pub practice: PracticeState,
    pub pitch: PitchPracticeState,
    pub reading: ReadingState,
}

#[cfg(test)]
mod tests {
    //! Pin the JSON shape that `src/lib/engine.ts` relies on.
    use super::*;
    use crate::settings::LatencySource;
    use serde_json::json;

    #[test]
    fn calibration_state_fields_are_camel_case() {
        let running = CalibrationState::Running {
            beat: 3,
            beats_per_bar: 4,
            total_clicks: 16,
        };
        assert_eq!(
            serde_json::to_value(&running).unwrap(),
            json!({"phase": "running", "beat": 3, "beatsPerBar": 4, "totalClicks": 16})
        );

        let failed = CalibrationState::Failed {
            message: "x".into(),
            matched: Some(5),
            total_clicks: 16,
        };
        assert_eq!(
            serde_json::to_value(&failed).unwrap(),
            json!({"phase": "failed", "message": "x", "matched": 5, "totalClicks": 16})
        );

        let done = CalibrationState::Done {
            latency: LatencyCalibration {
                ms: 40.0,
                source: LatencySource::Measured,
                matched: Some(15),
                total_clicks: Some(16),
            },
            rejected: 1,
        };
        assert_eq!(
            serde_json::to_value(&done).unwrap(),
            json!({
                "phase": "done",
                "latency": {"ms": 40.0, "source": "measured", "matched": 15, "totalClicks": 16},
                "rejected": 1
            })
        );
        assert_eq!(
            serde_json::to_value(CalibrationState::Idle).unwrap(),
            json!({"phase": "idle"})
        );
    }

    #[test]
    fn practice_state_fields_are_camel_case() {
        let running = PracticeState::Running {
            mode: SessionMode::Listen { note: "E3".into() },
            position_beats: Some(-2.5),
            count_in_beats: 4,
            total_beats: 64,
        };
        assert_eq!(
            serde_json::to_value(&running).unwrap(),
            json!({"phase": "running", "mode": {"kind": "listen", "note": "E3"},
                "positionBeats": -2.5, "countInBeats": 4, "totalBeats": 64})
        );
        assert_eq!(
            serde_json::to_value(PracticeState::Failed {
                message: "x".into()
            })
            .unwrap(),
            json!({"phase": "failed", "message": "x"})
        );
        let exercise = rhythm::generate(
            &rhythm::Difficulty::Easy.preset().unwrap(),
            rhythm::TimeSignature::default(),
            1,
            1,
        )
        .unwrap();
        let report = rhythm::TimingJudge::new(&exercise, 60.0).report();
        let finished = serde_json::to_value(EngineEvent::Practice {
            practice: PracticeState::Finished {
                report,
                pitch: None,
            },
        })
        .unwrap();
        assert_eq!(finished["practice"]["pitch"], json!(null));
        assert_eq!(finished["type"], "practice");
        assert_eq!(finished["practice"]["phase"], "finished");
        let summary = &finished["practice"]["report"]["summary"];
        for key in [
            "onTime",
            "accuracyPercent",
            "hitPercent",
            "meanOffsetMs",
            "spreadMs",
        ] {
            assert!(summary.get(key).is_some(), "missing {key}");
        }
        assert!(finished["practice"]["report"]["extraBeats"].is_array());
        assert_eq!(
            finished["practice"]["report"]["judgements"][0]["result"],
            "missed"
        );

        let judged = serde_json::to_value(EngineEvent::PracticeJudged { judgements: vec![] });
        assert_eq!(
            judged.unwrap(),
            json!({"type": "practiceJudged", "judgements": []})
        );

        // A melody played with the metronome: pitch checks and report.
        let melody = theory::generate_reading(
            &theory::ReadingOptions::default(),
            theory::Instrument::Guitar,
            1,
        )
        .unwrap();
        let mut pitch = theory::MelodyPitchJudge::new(&melody, 60.0);
        let checks = pitch.advance(1000.0);
        assert_eq!(
            serde_json::to_value(EngineEvent::PracticePitched {
                checks: checks[..1].to_vec()
            })
            .unwrap(),
            json!({"type": "practicePitched", "checks": [
                {"bar": 0, "symbol": 0, "result": "unclear", "played": null}]})
        );
        let report = serde_json::to_value(pitch.report()).unwrap();
        for key in ["notes", "right", "wrong", "unclear", "rightPercent"] {
            assert!(report["summary"].get(key).is_some(), "missing {key}");
        }
        assert!(report["checks"].is_array());
    }

    #[test]
    fn pitch_practice_state_fields_are_camel_case() {
        let instrument = theory::Instrument::Guitar;
        let options = theory::NoteReadingOptions::default();
        let task =
            theory::generate(&theory::PitchExercise::Notes(options), instrument, None, 1).unwrap();
        let written = task.notes[0].written;
        let running = PitchPracticeState::Running {
            exercise: PitchExerciseKind::Notes,
            task,
            stage: TaskStage::Playing,
            progress: 0,
            wrong: Some("D#4".into()),
            heard: None,
            round: 1,
            score: PitchScore {
                wrong_notes: 1,
                ..Default::default()
            },
        };
        let value = serde_json::to_value(EngineEvent::PitchPractice { pitch: running }).unwrap();
        assert_eq!(value["type"], "pitchPractice");
        let pitch = &value["pitch"];
        assert_eq!(pitch["phase"], "running");
        assert_eq!(pitch["exercise"], "notes");
        assert_eq!(pitch["stage"], "playing");
        assert_eq!(pitch["wrong"], "D#4");
        assert_eq!(
            pitch["score"],
            json!({"solved": 0, "clean": 0, "skipped": 0, "wrongNotes": 1})
        );
        let task = &pitch["task"];
        assert_eq!(task["prompt"], json!({"kind": "note"}));
        assert_eq!(task["clef"], "treble");
        assert_eq!(task["matching"], "exact");
        assert_eq!(task["playFirst"], false);
        assert_eq!(
            task["notes"][0],
            json!({
                "written": serde_json::to_value(written).unwrap(),
                "midi": written.midi() - 12,
                "given": true
            })
        );

        let finished = PitchPracticeState::Finished {
            exercise: PitchExerciseKind::Notes,
            score: PitchScore::default(),
        };
        assert_eq!(
            serde_json::to_value(&finished).unwrap()["phase"],
            "finished"
        );
        assert_eq!(
            serde_json::to_value(PitchPracticeState::Idle).unwrap(),
            json!({"phase": "idle"})
        );
    }

    #[test]
    fn pitch_prompts_are_tagged_by_kind() {
        let interval = theory::Prompt::Interval {
            interval: theory::IntervalName::MajorThird,
            direction: theory::Direction::Down,
        };
        assert_eq!(
            serde_json::to_value(interval).unwrap(),
            json!({"kind": "interval", "interval": "majorThird", "direction": "down"})
        );
        assert_eq!(
            serde_json::to_value(PitchExerciseKind::Intervals).unwrap(),
            "intervals"
        );
        let scale = theory::Prompt::Scale {
            root: theory::Pitch::new(theory::Letter::E, -1, 4),
            scale: theory::ScaleKind::HarmonicMinor,
            up_and_down: true,
        };
        assert_eq!(
            serde_json::to_value(scale).unwrap(),
            json!({"kind": "scale", "root": {"letter": "e", "accidental": -1, "octave": 4},
                "scale": "harmonicMinor", "upAndDown": true})
        );
        let chord = theory::Prompt::Chord {
            root: theory::Pitch::natural(theory::Letter::A, 3),
            chord: theory::ChordKind::HalfDiminished7,
            inversion: 2,
        };
        assert_eq!(
            serde_json::to_value(chord).unwrap(),
            json!({"kind": "chord", "root": {"letter": "a", "accidental": 0, "octave": 3},
                "chord": "halfDiminished7", "inversion": 2})
        );
        assert_eq!(
            serde_json::to_value(theory::Prompt::Echo { key: None }).unwrap(),
            json!({"kind": "echo", "key": null})
        );
        assert_eq!(serde_json::to_value(PitchExerciseKind::Ear).unwrap(), "ear");
    }

    #[test]
    fn reading_types_are_camel_case() {
        let running = ReadingState::Running {
            progress: 2,
            total: 8,
            wrong: Some("F#4".into()),
            heard: None,
            mistakes: 1,
        };
        assert_eq!(
            serde_json::to_value(EngineEvent::Reading { reading: running }).unwrap(),
            json!({"type": "reading", "reading": {"phase": "running", "progress": 2,
                "total": 8, "wrong": "F#4", "heard": null, "mistakes": 1}})
        );
        assert_eq!(
            serde_json::to_value(SessionMode::Melody).unwrap(),
            json!({"kind": "melody"})
        );

        let options = theory::ReadingOptions::default();
        let melody = theory::generate_reading(&options, theory::Instrument::Guitar, 1).unwrap();
        let value = serde_json::to_value(&melody).unwrap();
        for key in ["rhythm", "clef", "key", "scale", "root", "notes"] {
            assert!(value.get(key).is_some(), "missing {key}");
        }
        assert!(value["key"]["major"]["letter"].is_string());
        assert!(value["key"]["accidentals"].is_number());
        let note = &value["notes"][0];
        for key in ["bar", "symbol", "written", "midi"] {
            assert!(note.get(key).is_some(), "missing notes[].{key}");
        }
        assert_eq!(value["rhythm"]["timeSignature"]["beatsPerBar"], 4);
        // It comes back from the UI unchanged.
        let back: theory::ReadingExercise = serde_json::from_value(value).unwrap();
        assert_eq!(back, melody);
    }

    #[test]
    fn engine_event_is_tagged_by_type() {
        let event = EngineEvent::Calibration {
            calibration: CalibrationState::Idle,
        };
        assert_eq!(
            serde_json::to_value(&event).unwrap(),
            json!({"type": "calibration", "calibration": {"phase": "idle"}})
        );
    }
}
