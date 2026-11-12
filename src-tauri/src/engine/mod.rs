//! The one shared audio engine (ADR 0005). Owns the input stream, gain,
//! device selection, reconnects, analysis and calibration on a single
//! `audio-engine` thread, and broadcasts `EngineEvent`s to every subscribed
//! webview.

mod analysis;
mod calibration;
pub mod events;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, mpsc};
use std::time::{Duration, Instant};

use audio_engine::{AudioError, DeviceId, InputStream};
use dsp::calibration::{BEATS_PER_BAR, CLICK_COUNT};
use tauri::ipc::Channel;

use crate::settings::{LatencyCalibration, LatencySource, Settings, SettingsStore};
use analysis::Analyzer;
use calibration::{CalibrationSession, Failure, Progress};
use events::{
    CalibrationState, EngineError, EngineEvent, EngineSnapshot, EngineState, EngineStatus,
};

/// Engine tick: how often audio is analysed and frames are sent (~30 Hz).
const TICK: Duration = Duration::from_millis(33);
/// Delay between attempts to (re)open a device.
const RETRY_INTERVAL: Duration = Duration::from_millis(750);

enum Command {
    /// Switch to this device (`None` = system default).
    SetDevice(Option<DeviceId>),
    StartCalibration,
    CancelCalibration,
}

struct Shared {
    status: Mutex<EngineStatus>,
    calibration: Mutex<CalibrationState>,
    subscribers: Mutex<Vec<Channel<EngineEvent>>>,
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
        lock(&self.subscribers).retain(|channel| channel.send(event.clone()).is_ok());
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

    /// Persist a settings change and tell every subscriber.
    fn update_settings(&self, change: impl FnOnce(&mut Settings)) -> Result<Settings, String> {
        let result = self.settings.update(change);
        self.broadcast(&EngineEvent::Settings {
            settings: self.settings.get(),
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
            subscribers: Mutex::new(Vec::new()),
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
        lock(&self.shared.subscribers).push(channel);
        EngineSnapshot {
            status: lock(&self.shared.status).clone(),
            settings: self.shared.settings.get(),
            calibration: lock(&self.shared.calibration).clone(),
        }
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
        let _ = self.commands.send(Command::StartCalibration);
        Ok(())
    }

    pub fn cancel_calibration(&self) {
        let _ = self.commands.send(Command::CancelCalibration);
    }
}

/// State owned by the engine thread.
struct Runner {
    shared: Arc<Shared>,
    /// The device the user chose (`None` = system default).
    wanted: Option<DeviceId>,
    input: Option<(InputStream, Analyzer)>,
    calibration: Option<CalibrationSession>,
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
            return;
        }

        let now = self.clock.elapsed().as_secs_f64();
        let frame = analyzer.process(stream, self.shared.gain(), now);
        self.shared.broadcast(&EngineEvent::Frame { frame });

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
                    self.finish_calibration(result);
                }
            }
        }
    }

    fn finish_calibration(&self, result: Result<dsp::LatencyEstimate, Failure>) {
        let estimate = match result {
            Ok(estimate) => estimate,
            Err(f) => return self.shared.set_calibration(failed(f.message, f.matched)),
        };
        let latency = LatencyCalibration {
            ms: estimate.latency_ms,
            source: LatencySource::Measured,
            matched: Some(estimate.matched),
            total_clicks: Some(estimate.total_clicks),
        };
        match self
            .shared
            .update_settings(|s| s.latency = Some(latency.clone()))
        {
            Ok(_) => self.shared.set_calibration(CalibrationState::Done {
                latency,
                rejected: estimate.rejected,
            }),
            Err(e) => self
                .shared
                .set_calibration(failed(e, Some(estimate.matched))),
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
