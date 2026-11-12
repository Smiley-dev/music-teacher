use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use audio_engine::{InputDeviceInfo, InputMonitor, MonitorInfo};
use dsp::{PitchReading, PitchTracker};
use serde::Serialize;
use tauri::State;
use tauri::ipc::Channel;

/// How often level updates are pushed to the UI (~30 fps).
const METER_INTERVAL: Duration = Duration::from_millis(33);
/// How long to wait between attempts to reopen a device whose stream died.
const RECONNECT_INTERVAL: Duration = Duration::from_millis(750);

/// Messages streamed to the frontend while monitoring.
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum MonitorEvent {
    /// Peak per channel since the last update (linear, 1.0 = full scale) and
    /// the detected pitch per channel (`None` = silent or no clear pitch).
    Levels {
        peaks: Vec<f32>,
        pitches: Vec<Option<PitchReading>>,
    },
    /// The stream died (e.g. the device reset or was unplugged); retrying.
    Reconnecting { message: String },
    /// The stream was reopened after a `Reconnecting` event.
    Reconnected { info: MonitorInfo },
}

struct ActiveMonitor {
    /// Tells the meter thread to exit; it then drops the monitor (stopping audio).
    running: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

#[derive(Default)]
struct AppState {
    monitor: Mutex<Option<ActiveMonitor>>,
}

impl AppState {
    /// Stop the active monitor and wait until its audio stream is closed.
    fn stop(&self) {
        let active = self.monitor.lock().unwrap().take();
        if let Some(active) = active {
            active.running.store(false, Ordering::Relaxed);
            let _ = active.thread.join();
        }
    }
}

/// Per-channel analysis state, owned by the meter thread.
struct Analyzer {
    trackers: Vec<PitchTracker>,
    samples: Vec<f32>,
    peaks: Vec<f32>,
}

impl Analyzer {
    fn new(info: &MonitorInfo) -> Self {
        Self {
            trackers: (0..info.channels)
                .map(|_| PitchTracker::new(info.sample_rate))
                .collect(),
            samples: Vec::new(),
            peaks: Vec::new(),
        }
    }

    /// Read everything captured since the last call and analyze it.
    fn update(&mut self, monitor: &mut InputMonitor) -> MonitorEvent {
        monitor.take_peaks(&mut self.peaks);
        monitor.read_samples(&mut self.samples);

        let channels = self.trackers.len();
        let pitches = self
            .trackers
            .iter_mut()
            .enumerate()
            .map(|(ch, tracker)| {
                tracker.push(self.samples.iter().skip(ch).step_by(channels).copied());
                tracker.detect()
            })
            .collect();

        MonitorEvent::Levels {
            peaks: self.peaks.clone(),
            pitches,
        }
    }
}

#[tauri::command]
fn list_input_devices() -> Result<Vec<InputDeviceInfo>, String> {
    audio_engine::list_input_devices().map_err(|e| e.to_string())
}

/// Start capturing from a device and stream its levels through `on_event`.
/// Any previously running monitor is stopped first.
#[tauri::command]
fn start_monitoring(
    host: String,
    name: String,
    on_event: Channel<MonitorEvent>,
    state: State<'_, AppState>,
) -> Result<MonitorInfo, String> {
    state.stop();

    let monitor = InputMonitor::start(&host, &name).map_err(|e| e.to_string())?;
    let info = monitor.info().clone();
    let running = Arc::new(AtomicBool::new(true));

    let thread_running = Arc::clone(&running);
    let thread = std::thread::Builder::new()
        .name("level-meter".into())
        .spawn(move || {
            let mut analyzer = Analyzer::new(monitor.info());
            let mut monitor = Some(monitor);
            let mut next_retry = Instant::now();

            while thread_running.load(Ordering::Relaxed) {
                std::thread::sleep(METER_INTERVAL);

                let event = match &mut monitor {
                    Some(m) => match m.take_error() {
                        // On WASAPI any stream error is fatal (the stream stops
                        // for good), so drop it and reopen the device.
                        Some(message) => {
                            eprintln!("[audio] stream error on `{name}`: {message}");
                            monitor = None;
                            next_retry = Instant::now() + RECONNECT_INTERVAL;
                            MonitorEvent::Reconnecting { message }
                        }
                        None => analyzer.update(m),
                    },
                    None if Instant::now() < next_retry => continue,
                    None => match InputMonitor::start(&host, &name) {
                        Ok(m) => {
                            eprintln!("[audio] reconnected to `{name}`");
                            let info = m.info().clone();
                            analyzer = Analyzer::new(&info);
                            monitor = Some(m);
                            MonitorEvent::Reconnected { info }
                        }
                        Err(e) => {
                            next_retry = Instant::now() + RECONNECT_INTERVAL;
                            MonitorEvent::Reconnecting {
                                message: e.to_string(),
                            }
                        }
                    },
                };

                if on_event.send(event).is_err() {
                    break; // The webview went away.
                }
            }
            // `monitor` is dropped here, which stops the audio stream.
        })
        .map_err(|e| e.to_string())?;

    *state.monitor.lock().unwrap() = Some(ActiveMonitor { running, thread });
    Ok(info)
}

#[tauri::command]
fn stop_monitoring(state: State<'_, AppState>) {
    state.stop();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_input_devices,
            start_monitoring,
            stop_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
