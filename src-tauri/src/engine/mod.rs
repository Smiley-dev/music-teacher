//! The one shared audio engine (ADR 0005). Owns the input stream, gain,
//! device selection, reconnects, analysis, calibration and practice sessions
//! (rhythm, pitch and sight reading) on a single `audio-engine` thread, and
//! broadcasts `EngineEvent`s to every subscribed webview.

mod analysis;
mod calibration;
pub mod events;
mod pitch;
mod practice;
mod reading;

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, mpsc};
use std::time::{Duration, Instant};

use audio_engine::{AudioError, DeviceId, InputStream};
use dsp::calibration::{BEATS_PER_BAR, CLICK_COUNT};
use tauri::ipc::Channel;

use rhythm::{CustomMode, Difficulty, Exercise, ExerciseDraft};
use theory::{PitchExerciseKind, ReadingExercise};

use crate::settings::{
    LatencyCalibration, LatencySource, PitchPracticeSettings, ReadingPracticeSettings,
    RhythmPracticeSettings, Settings, SettingsStore,
};
use analysis::Analyzer;
use calibration::{CalibrationSession, Failure, Progress};
use events::{
    CalibrationState, EngineError, EngineEvent, EngineSnapshot, EngineState, EngineStatus,
    PitchPracticeState, PracticeState, ReadingState, SessionMode,
};
use pitch::PitchSession;
use practice::{COUNT_IN_CLICKS, RhythmSession};
use reading::ReadingSession;

/// Shown when a session is started while another one runs.
const BUSY_MESSAGE: &str = "Stop the exercise that is running first.";

/// Engine tick: how often audio is analysed and frames are sent (~30 Hz).
const TICK: Duration = Duration::from_millis(33);
/// Delay between attempts to (re)open a device.
const RETRY_INTERVAL: Duration = Duration::from_millis(750);

enum Command {
    /// Switch to this device (`None` = system default).
    SetDevice(Option<DeviceId>),
    StartCalibration,
    CancelCalibration,
    StartRhythm {
        exercise: Exercise,
        bpm: u32,
        mode: SessionMode,
        /// When listening: tone frequency per played note (one = same pitch
        /// for every note).
        listen: Option<Vec<f32>>,
    },
    StopRhythm,
    StartPitch(PitchExerciseKind),
    StopPitch,
    SkipPitchTask,
    ReplayPitchTask,
    /// Sight reading at your own pace.
    StartReading(ReadingExercise),
    StopReading,
}

struct Shared {
    status: Mutex<EngineStatus>,
    calibration: Mutex<CalibrationState>,
    practice: Mutex<PracticeState>,
    pitch: Mutex<PitchPracticeState>,
    reading: Mutex<ReadingState>,
    /// Subscribed webviews, keyed by subscription id.
    subscribers: Mutex<Vec<(u64, Channel<EngineEvent>)>>,
    next_subscriber: AtomicU64,
    /// Linear input gain as `f32` bits, read every tick.
    gain: AtomicU32,
    settings: SettingsStore,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Shared {
    fn broadcast(&self, event: &EngineEvent) {
        // Webviews that went away (reload, closed window) fail to receive.
        lock(&self.subscribers).retain(|(_, channel)| channel.send(event.clone()).is_ok());
    }

    fn set_status(&self, status: EngineStatus) {
        let mut current = lock(&self.status);
        if *current != status {
            *current = status.clone();
            drop(current);
            self.broadcast(&EngineEvent::Status { status });
        }
    }

    fn set_calibration(&self, calibration: CalibrationState) {
        let mut current = lock(&self.calibration);
        if *current != calibration {
            *current = calibration.clone();
            drop(current);
            self.broadcast(&EngineEvent::Calibration { calibration });
        }
    }

    fn set_practice(&self, practice: PracticeState) {
        let mut current = lock(&self.practice);
        if *current != practice {
            *current = practice.clone();
            drop(current);
            self.broadcast(&EngineEvent::Practice { practice });
        }
    }

    fn set_pitch(&self, pitch: PitchPracticeState) {
        let mut current = lock(&self.pitch);
        if *current != pitch {
            *current = pitch.clone();
            drop(current);
            self.broadcast(&EngineEvent::PitchPractice { pitch });
        }
    }

    fn set_reading(&self, reading: ReadingState) {
        let mut current = lock(&self.reading);
        if *current != reading {
            *current = reading.clone();
            drop(current);
            self.broadcast(&EngineEvent::Reading { reading });
        }
    }

    fn reading_running(&self) -> bool {
        matches!(*lock(&self.reading), ReadingState::Running { .. })
    }

    fn calibration_running(&self) -> bool {
        matches!(*lock(&self.calibration), CalibrationState::Running { .. })
    }

    fn practice_running(&self) -> bool {
        matches!(*lock(&self.practice), PracticeState::Running { .. })
    }

    fn pitch_running(&self) -> bool {
        matches!(*lock(&self.pitch), PitchPracticeState::Running { .. })
    }

    /// Persist a settings change and tell every subscriber.
    fn update_settings(&self, change: impl FnOnce(&mut Settings)) -> Result<Settings, String> {
        let result = self.settings.update(change);
        self.broadcast(&EngineEvent::Settings {
            settings: Box::new(self.settings.get()),
        });
        result
    }

    fn gain(&self) -> f32 {
        f32::from_bits(self.gain.load(Ordering::Relaxed))
    }
}

/// Handle to the engine, stored in Tauri state.
pub struct AudioEngine {
    commands: mpsc::Sender<Command>,
    shared: Arc<Shared>,
}

impl AudioEngine {
    /// Start the engine thread with the saved settings.
    pub fn start(settings: SettingsStore) -> std::io::Result<Self> {
        let initial = settings.get();
        let shared = Arc::new(Shared {
            status: Mutex::new(EngineStatus {
                state: EngineState::Starting,
                device: initial.input_device.clone(),
                stream: None,
                error: None,
            }),
            calibration: Mutex::new(CalibrationState::Idle),
            practice: Mutex::new(PracticeState::Idle),
            pitch: Mutex::new(PitchPracticeState::Idle),
            reading: Mutex::new(ReadingState::Idle),
            subscribers: Mutex::new(Vec::new()),
            next_subscriber: AtomicU64::new(1),
            gain: AtomicU32::new(dsp::meter::db_to_gain(initial.gain_db).to_bits()),
            settings,
        });
        let (tx, rx) = mpsc::channel();
        let thread_shared = Arc::clone(&shared);
        std::thread::Builder::new()
            .name("audio-engine".into())
            .spawn(move || run(thread_shared, rx, initial.input_device))?;
        Ok(Self {
            commands: tx,
            shared,
        })
    }

    /// Add a subscriber and return the current state for its first render.
    pub fn subscribe(&self, channel: Channel<EngineEvent>) -> EngineSnapshot {
        let id = self.shared.next_subscriber.fetch_add(1, Ordering::Relaxed);
        lock(&self.shared.subscribers).push((id, channel));
        EngineSnapshot {
            subscription_id: id,
            status: lock(&self.shared.status).clone(),
            settings: self.shared.settings.get(),
            calibration: lock(&self.shared.calibration).clone(),
            practice: lock(&self.shared.practice).clone(),
            pitch: lock(&self.shared.pitch).clone(),
            reading: lock(&self.shared.reading).clone(),
        }
    }

    pub fn unsubscribe(&self, subscription_id: u64) {
        lock(&self.shared.subscribers).retain(|(id, _)| *id != subscription_id);
    }

    /// The saved round-trip latency calibration (ADR 0003), for
    /// timing-sensitive features such as Practice.
    #[expect(
        dead_code,
        reason = "public API for Practice, see docs/features/practice.md"
    )]
    pub fn latency(&self) -> Option<LatencyCalibration> {
        self.shared.settings.get().latency
    }

    /// Select and save the input device; the old stream is released first.
    pub fn set_input_device(&self, device: DeviceId) -> Result<Settings, String> {
        let settings = self
            .shared
            .update_settings(|s| s.input_device = Some(device.clone()))?;
        let _ = self.commands.send(Command::SetDevice(Some(device)));
        Ok(settings)
    }

    /// Save the input gain and apply it immediately (no stream restart).
    pub fn set_gain_db(&self, gain_db: f32) -> Result<Settings, String> {
        let settings = self.shared.update_settings(|s| s.gain_db = gain_db)?;
        let linear = dsp::meter::db_to_gain(settings.gain_db);
        self.shared.gain.store(linear.to_bits(), Ordering::Relaxed);
        Ok(settings)
    }

    /// Save a manually entered latency, or clear it with `None`.
    pub fn set_latency_ms(&self, ms: Option<f64>) -> Result<Settings, String> {
        if let Some(ms) = ms
            && (!ms.is_finite() || ms.abs() > crate::settings::MAX_ABS_LATENCY_MS)
        {
            return Err(format!(
                "latency must be between -{0} and {0} ms",
                crate::settings::MAX_ABS_LATENCY_MS
            ));
        }
        self.shared.update_settings(|s| {
            s.latency = ms.map(|ms| LatencyCalibration {
                ms,
                source: LatencySource::Manual,
                matched: None,
                total_clicks: None,
            });
        })
    }

    pub fn start_calibration(&self) -> Result<(), String> {
        if lock(&self.shared.status).state != EngineState::Running {
            return Err("Select a working input device before calibrating.".into());
        }
        if self.shared.practice_running()
            || self.shared.pitch_running()
            || self.shared.reading_running()
        {
            return Err("Stop the practice session before calibrating.".into());
        }
        let _ = self.commands.send(Command::StartCalibration);
        Ok(())
    }

    pub fn cancel_calibration(&self) {
        let _ = self.commands.send(Command::CancelCalibration);
    }

    /// Save the rhythm practice settings (clamped to valid ranges).
    pub fn set_rhythm_settings(&self, rhythm: RhythmPracticeSettings) -> Result<Settings, String> {
        self.shared.update_settings(|s| s.practice.rhythm = rhythm)
    }

    /// The exercise for the saved rhythm settings: a new random one, or the
    /// user's written rhythm (possibly unfinished) in Custom → Written mode.
    pub fn generate_rhythm_exercise(&self) -> Result<ExerciseDraft, String> {
        let rhythm = self.shared.settings.get().practice.rhythm;
        if rhythm.difficulty == Difficulty::Custom && rhythm.custom_mode == CustomMode::Written {
            return rhythm::layout(&rhythm.written, rhythm.time_signature)
                .map_err(|e| e.to_string());
        }
        rhythm::generate(
            &rhythm.options(),
            rhythm.time_signature,
            rhythm.bars,
            seed_from_clock(),
        )
        .map(ExerciseDraft::from_complete)
        .map_err(|e| e.to_string())
    }

    /// Play `exercise` with a count-in at the saved tempo.
    pub fn start_rhythm_practice(&self, exercise: Exercise) -> Result<(), String> {
        exercise.validate().map_err(|e| e.to_string())?;
        if lock(&self.shared.status).state != EngineState::Running {
            return Err("Select a working input device before practicing.".into());
        }
        if self.shared.calibration_running() {
            return Err("Wait for the calibration to finish first.".into());
        }
        if self.shared.pitch_running() || self.shared.reading_running() {
            return Err(BUSY_MESSAGE.into());
        }
        let bpm = self.shared.settings.get().practice.rhythm.bpm;
        let _ = self.commands.send(Command::StartRhythm {
            exercise,
            bpm,
            mode: SessionMode::Practice,
            listen: None,
        });
        Ok(())
    }

    /// Play `exercise` back (count-in, metronome and each note as a tone on a
    /// random pitch) so the user can hear how it should sound.
    pub fn listen_to_rhythm(&self, exercise: Exercise) -> Result<(), String> {
        exercise.validate().map_err(|e| e.to_string())?;
        if lock(&self.shared.status).state != EngineState::Running {
            return Err("Select a working input device first.".into());
        }
        if self.shared.calibration_running() {
            return Err("Wait for the calibration to finish first.".into());
        }
        if self.shared.pitch_running() || self.shared.reading_running() {
            return Err(BUSY_MESSAGE.into());
        }
        let bpm = self.shared.settings.get().practice.rhythm.bpm;
        let midi = random_listen_note();
        let frequency = dsp::note::midi_to_frequency(midi);
        let note = dsp::Note::from_frequency(frequency)
            .map(|n| format!("{}{}", n.name, n.octave))
            .unwrap_or_default();
        let _ = self.commands.send(Command::StartRhythm {
            exercise,
            bpm,
            mode: SessionMode::Listen { note },
            listen: Some(vec![frequency]),
        });
        Ok(())
    }

    pub fn stop_rhythm_practice(&self) {
        let _ = self.commands.send(Command::StopRhythm);
    }

    /// Save the pitch practice settings (instrument and exercise options).
    pub fn set_pitch_settings(&self, pitch: PitchPracticeSettings) -> Result<Settings, String> {
        self.shared.update_settings(|s| s.practice.pitch = pitch)
    }

    /// Start a pitch exercise with its saved options. Tasks follow one
    /// after another until stopped; progress arrives as events.
    pub fn start_pitch_practice(&self, kind: PitchExerciseKind) -> Result<(), String> {
        if lock(&self.shared.status).state != EngineState::Running {
            return Err("Select a working input device before practicing.".into());
        }
        if self.shared.calibration_running() {
            return Err("Wait for the calibration to finish first.".into());
        }
        if self.shared.practice_running() || self.shared.reading_running() {
            return Err(BUSY_MESSAGE.into());
        }
        let _ = self.commands.send(Command::StartPitch(kind));
        Ok(())
    }

    pub fn stop_pitch_practice(&self) {
        let _ = self.commands.send(Command::StopPitch);
    }

    /// Show the current task's answer and move on.
    pub fn skip_pitch_task(&self) {
        let _ = self.commands.send(Command::SkipPitchTask);
    }

    /// Play the current task's notes (again); the task restarts.
    pub fn replay_pitch_task(&self) {
        let _ = self.commands.send(Command::ReplayPitchTask);
    }

    /// Save the sight-reading settings (tempo and melody options).
    pub fn set_reading_settings(
        &self,
        reading: ReadingPracticeSettings,
    ) -> Result<Settings, String> {
        self.shared
            .update_settings(|s| s.practice.reading = reading)
    }

    /// A new sight-reading melody for the saved options and instrument.
    pub fn generate_reading_exercise(&self) -> Result<ReadingExercise, String> {
        let practice = self.shared.settings.get().practice;
        theory::generate_reading(
            &practice.reading.melody,
            practice.pitch.instrument,
            seed_from_clock(),
        )
        .map_err(|e| e.to_string())
    }

    /// Check that a session may start now: a running input and no other
    /// session.
    fn can_start_session(&self) -> Result<(), String> {
        if lock(&self.shared.status).state != EngineState::Running {
            return Err("Select a working input device first.".into());
        }
        if self.shared.calibration_running() {
            return Err("Wait for the calibration to finish first.".into());
        }
        if self.shared.practice_running()
            || self.shared.pitch_running()
            || self.shared.reading_running()
        {
            return Err(BUSY_MESSAGE.into());
        }
        Ok(())
    }

    /// Play `exercise` back at its pitches, with count-in and metronome at
    /// the saved reading tempo (a rhythm session in listen mode).
    pub fn listen_to_reading(&self, exercise: ReadingExercise) -> Result<(), String> {
        exercise.validate().map_err(|e| e.to_string())?;
        self.can_start_session()?;
        let bpm = self.shared.settings.get().practice.reading.bpm;
        let frequencies = exercise
            .notes
            .iter()
            .map(|n| dsp::note::midi_to_frequency(n.midi))
            .collect();
        let _ = self.commands.send(Command::StartRhythm {
            exercise: exercise.rhythm,
            bpm,
            mode: SessionMode::Melody,
            listen: Some(frequencies),
        });
        Ok(())
    }

    /// Play `exercise` at your own pace, judged note by note by pitch.
    pub fn start_reading_practice(&self, exercise: ReadingExercise) -> Result<(), String> {
        exercise.validate().map_err(|e| e.to_string())?;
        self.can_start_session()?;
        let _ = self.commands.send(Command::StartReading(exercise));
        Ok(())
    }

    pub fn stop_reading_practice(&self) {
        let _ = self.commands.send(Command::StopReading);
    }
}

/// A seed for random exercises, from the system clock.
fn seed_from_clock() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos() as u64)
}

/// Lowest and highest MIDI note for listening (A2..A4: comfortable on most
/// speakers and in the range of guitar, bass and voice).
const LISTEN_MIDI_MIN: i32 = 45;
const LISTEN_MIDI_MAX: i32 = 69;

fn random_listen_note() -> i32 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.subsec_nanos());
    LISTEN_MIDI_MIN + (nanos % (LISTEN_MIDI_MAX - LISTEN_MIDI_MIN + 1) as u32) as i32
}

/// State owned by the engine thread.
struct Runner {
    shared: Arc<Shared>,
    /// The device the user chose (`None` = system default).
    wanted: Option<DeviceId>,
    input: Option<(InputStream, Analyzer)>,
    calibration: Option<CalibrationSession>,
    practice: Option<RhythmSession>,
    /// Mode of the running rhythm session.
    mode: SessionMode,
    pitch: Option<PitchSession>,
    reading: Option<ReadingSession>,
    next_attempt: Instant,
    /// Whether the last stream ended by failing (vs. never opened).
    was_running: bool,
    clock: Instant,
}

fn run(shared: Arc<Shared>, commands: mpsc::Receiver<Command>, wanted: Option<DeviceId>) {
    let mut runner = Runner {
        shared,
        wanted,
        input: None,
        calibration: None,
        practice: None,
        mode: SessionMode::Practice,
        pitch: None,
        reading: None,
        next_attempt: Instant::now(),
        was_running: false,
        clock: Instant::now(),
    };
    loop {
        match commands.recv_timeout(TICK) {
            Ok(command) => runner.handle(command),
            Err(mpsc::RecvTimeoutError::Timeout) => runner.tick(),
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
        }
    }
}

fn failed(message: impl Into<String>, matched: Option<usize>) -> CalibrationState {
    CalibrationState::Failed {
        message: message.into(),
        matched,
        total_clicks: CLICK_COUNT,
    }
}

impl Runner {
    fn handle(&mut self, command: Command) {
        match command {
            Command::SetDevice(device) => {
                self.stop_calibration(Some("the input device was changed"));
                self.stop_practice(Some("the input device was changed"));
                self.stop_pitch(Some("the input device was changed"));
                self.stop_reading(Some("the input device was changed"));
                // Release the old device before opening the new one.
                self.input = None;
                self.shared.set_status(EngineStatus {
                    state: EngineState::Starting,
                    device: device.clone(),
                    stream: None,
                    error: None,
                });
                self.wanted = device;
                self.was_running = false;
                self.next_attempt = Instant::now();
                self.tick();
            }
            Command::StartCalibration => {
                let Some((_, analyzer)) = &self.input else {
                    self.shared
                        .set_calibration(failed("No input device is running.", None));
                    return;
                };
                if self.practice.is_some() || self.pitch.is_some() || self.reading.is_some() {
                    return self.shared.set_calibration(failed(
                        "Stop the practice session before calibrating.",
                        None,
                    ));
                }
                match CalibrationSession::start(analyzer) {
                    Ok(session) => {
                        self.calibration = Some(session);
                        self.shared.set_calibration(CalibrationState::Running {
                            beat: 0,
                            beats_per_bar: BEATS_PER_BAR,
                            total_clicks: CLICK_COUNT,
                        });
                    }
                    Err(message) => self.shared.set_calibration(failed(message, None)),
                }
            }
            Command::CancelCalibration => self.stop_calibration(None),
            Command::StartRhythm {
                exercise,
                bpm,
                mode,
                listen,
            } => {
                let Some((_, analyzer)) = &self.input else {
                    return self.shared.set_practice(PracticeState::Failed {
                        message: "No input device is running.".into(),
                    });
                };
                if self.calibration.is_some() {
                    return self.shared.set_practice(PracticeState::Failed {
                        message: "Wait for the calibration to finish first.".into(),
                    });
                }
                if self.pitch.is_some() || self.reading.is_some() {
                    return self.shared.set_practice(PracticeState::Failed {
                        message: BUSY_MESSAGE.into(),
                    });
                }
                // Restarting replaces the previous session (and its clicks).
                self.practice = None;
                let latency_ms = self.shared.settings.get().latency.map(|l| l.ms);
                match RhythmSession::start(&exercise, bpm, latency_ms, analyzer, listen.as_deref())
                {
                    Ok(session) => {
                        self.mode = mode.clone();
                        self.shared.set_practice(PracticeState::Running {
                            mode,
                            position_beats: None,
                            count_in_beats: COUNT_IN_CLICKS,
                            total_beats: session.total_beats(),
                        });
                        self.practice = Some(session);
                    }
                    Err(message) => self.shared.set_practice(PracticeState::Failed { message }),
                }
            }
            Command::StopRhythm => self.stop_practice(None),
            Command::StartPitch(kind) => self.start_pitch(kind),
            Command::StopPitch => self.stop_pitch(None),
            Command::SkipPitchTask => {
                if let Some(session) = &mut self.pitch {
                    session.skip();
                    self.shared.set_pitch(session.state());
                }
            }
            Command::ReplayPitchTask => {
                if let Some(session) = &mut self.pitch {
                    match session.replay() {
                        Ok(()) => self.shared.set_pitch(session.state()),
                        Err(message) => {
                            self.pitch = None;
                            self.shared
                                .set_pitch(PitchPracticeState::Failed { message });
                        }
                    }
                }
            }
            Command::StartReading(exercise) => {
                let Some((_, analyzer)) = &self.input else {
                    return self.shared.set_reading(ReadingState::Failed {
                        message: "No input device is running.".into(),
                    });
                };
                if self.calibration.is_some() || self.practice.is_some() || self.pitch.is_some() {
                    return self.shared.set_reading(ReadingState::Failed {
                        message: BUSY_MESSAGE.into(),
                    });
                }
                let session = ReadingSession::start(exercise, analyzer);
                self.shared.set_reading(session.state());
                self.reading = Some(session);
            }
            Command::StopReading => self.stop_reading(None),
        }
    }

    /// End a sight-reading session: back to idle, or failed with `reason`.
    fn stop_reading(&mut self, reason: Option<&str>) {
        if self.reading.take().is_some() {
            self.shared.set_reading(match reason {
                Some(reason) => ReadingState::Failed {
                    message: format!("Practice stopped: {reason}."),
                },
                None => ReadingState::Idle,
            });
        }
    }

    fn start_pitch(&mut self, kind: PitchExerciseKind) {
        if self.input.is_none() {
            return self.shared.set_pitch(PitchPracticeState::Failed {
                message: "No input device is running.".into(),
            });
        }
        if self.calibration.is_some() || self.practice.is_some() || self.reading.is_some() {
            return self.shared.set_pitch(PitchPracticeState::Failed {
                message: BUSY_MESSAGE.into(),
            });
        }
        // Restarting replaces the previous session.
        self.pitch = None;
        let settings = self.shared.settings.get().practice.pitch;
        match PitchSession::start(
            settings.exercise(kind),
            settings.instrument,
            seed_from_clock(),
        ) {
            Ok(session) => {
                self.shared.set_pitch(session.state());
                self.pitch = Some(session);
            }
            Err(message) => self
                .shared
                .set_pitch(PitchPracticeState::Failed { message }),
        }
    }

    /// End a running pitch session: its score (or idle), or failed with
    /// `reason`.
    fn stop_pitch(&mut self, reason: Option<&str>) {
        if let Some(session) = self.pitch.take() {
            self.shared.set_pitch(match reason {
                Some(reason) => PitchPracticeState::Failed {
                    message: format!("Practice stopped: {reason}."),
                },
                None => session.finish(),
            });
        }
    }

    /// End a running practice session: back to idle, or failed with `reason`.
    fn stop_practice(&mut self, reason: Option<&str>) {
        if self.practice.take().is_some() {
            self.shared.set_practice(match reason {
                Some(reason) => PracticeState::Failed {
                    message: format!("Practice stopped: {reason}."),
                },
                None => PracticeState::Idle,
            });
        }
    }

    /// End a running session: back to idle, or failed with `reason`.
    fn stop_calibration(&mut self, reason: Option<&str>) {
        if self.calibration.take().is_some() {
            self.shared.set_calibration(match reason {
                Some(reason) => failed(format!("Calibration stopped: {reason}."), None),
                None => CalibrationState::Idle,
            });
        }
    }

    fn tick(&mut self) {
        let Some((stream, analyzer)) = &mut self.input else {
            if Instant::now() >= self.next_attempt {
                self.open();
            }
            return;
        };

        if let Some(error) = stream.take_error() {
            eprintln!("[audio] stream stopped: {error}");
            let device = lock(&self.shared.status).device.clone();
            self.input = None;
            self.was_running = true;
            self.next_attempt = Instant::now() + RETRY_INTERVAL;
            self.report_error(device, &error);
            self.stop_calibration(Some("the input device was lost"));
            self.stop_practice(Some("the input device was lost"));
            self.stop_pitch(Some("the input device was lost"));
            self.stop_reading(Some("the input device was lost"));
            return;
        }

        let now = self.clock.elapsed().as_secs_f64();
        let frame = analyzer.process(stream, self.shared.gain(), now);
        // The note on screen, for the "Hearing …" line of pitch exercises
        // and sight reading.
        let display_note = (self.pitch.is_some() || self.reading.is_some())
            .then(|| frame.note.clone())
            .flatten();
        self.shared.broadcast(&EngineEvent::Frame { frame });

        if let Some(session) = &mut self.reading {
            let state = session.tick(analyzer, display_note.as_ref());
            if !matches!(state, ReadingState::Running { .. }) {
                self.reading = None;
            }
            self.shared.set_reading(state);
        }

        if let Some(session) = &mut self.pitch {
            match session.tick(analyzer, display_note.as_ref()) {
                Ok(()) => self.shared.set_pitch(session.state()),
                Err(message) => {
                    self.pitch = None;
                    self.shared
                        .set_pitch(PitchPracticeState::Failed { message });
                }
            }
        }

        if let Some(session) = &mut self.calibration {
            match session.tick(analyzer) {
                Progress::Running { beat } => {
                    self.shared.set_calibration(CalibrationState::Running {
                        beat,
                        beats_per_bar: BEATS_PER_BAR,
                        total_clicks: CLICK_COUNT,
                    })
                }
                Progress::Finished(result) => {
                    self.calibration = None;
                    Self::finish_calibration(&self.shared, result);
                }
            }
        }

        if let Some(session) = &mut self.practice {
            let state = match session.tick(analyzer) {
                practice::Progress::Running {
                    position_beats,
                    judged,
                } => {
                    if !judged.is_empty() {
                        self.shared
                            .broadcast(&EngineEvent::PracticeJudged { judgements: judged });
                    }
                    PracticeState::Running {
                        mode: self.mode.clone(),
                        position_beats,
                        count_in_beats: COUNT_IN_CLICKS,
                        total_beats: session.total_beats(),
                    }
                }
                practice::Progress::Finished(Some(report)) => PracticeState::Finished { report },
                practice::Progress::Finished(None) => PracticeState::Idle,
                practice::Progress::Failed(message) => PracticeState::Failed { message },
            };
            if !matches!(state, PracticeState::Running { .. }) {
                self.practice = None;
            }
            self.shared.set_practice(state);
        }
    }

    /// Save a finished calibration's result. Takes only the shared state so it
    /// can run while the analyzer is still borrowed in `tick`.
    fn finish_calibration(shared: &Shared, result: Result<dsp::LatencyEstimate, Failure>) {
        let estimate = match result {
            Ok(estimate) => estimate,
            Err(f) => return shared.set_calibration(failed(f.message, f.matched)),
        };
        let latency = LatencyCalibration {
            ms: estimate.latency_ms,
            source: LatencySource::Measured,
            matched: Some(estimate.matched),
            total_clicks: Some(estimate.total_clicks),
        };
        match shared.update_settings(|s| s.latency = Some(latency.clone())) {
            Ok(_) => shared.set_calibration(CalibrationState::Done {
                latency,
                rejected: estimate.rejected,
            }),
            Err(e) => shared.set_calibration(failed(e, Some(estimate.matched))),
        }
    }

    fn open(&mut self) {
        let device = match self.wanted.clone() {
            Some(d) => Ok(d),
            None => audio_engine::default_input_device(),
        };
        let result = device.and_then(|d| InputStream::open(&d).map(|s| (d, s)));
        match result {
            Ok((device, stream)) => {
                if self.was_running {
                    eprintln!("[audio] reopened `{}`", device.name);
                }
                let info = stream.info().clone();
                self.shared.set_status(EngineStatus {
                    state: EngineState::Running,
                    device: Some(device),
                    stream: Some(info.clone()),
                    error: None,
                });
                self.input = Some((stream, Analyzer::new(info)));
                self.was_running = false;
            }
            Err(error) => {
                self.next_attempt = Instant::now() + RETRY_INTERVAL;
                self.report_error(self.wanted.clone(), &error);
            }
        }
    }

    fn report_error(&self, device: Option<DeviceId>, error: &AudioError) {
        self.shared.set_status(EngineStatus {
            state: if self.was_running {
                EngineState::Reconnecting
            } else {
                EngineState::Error
            },
            device,
            stream: None,
            error: Some(EngineError {
                kind: error.kind(),
                message: error.to_string(),
            }),
        });
    }
}
