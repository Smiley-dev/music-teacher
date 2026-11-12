//! Input monitoring: opens an input stream, tracks per-channel peaks and
//! forwards the raw samples through a lock-free ring buffer for analysis.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread::JoinHandle;

use cpal::SizedSample;
use cpal::traits::{DeviceTrait, StreamTrait};
use rtrb::{Consumer, Producer, RingBuffer};
use serde::Serialize;

/// Ring buffer length in seconds of audio. If the reader falls further behind
/// than this, the newest samples are dropped (the audio thread never blocks).
const RING_SECONDS: usize = 1;

use crate::{AudioError, find_input_device};

/// State shared between the audio callback and readers.
struct Shared {
    /// Peak absolute sample value per channel since the last read, stored as
    /// `f32` bits. For non-negative floats, bit order equals numeric order, so
    /// `fetch_max` on the bits is a lock-free "max".
    peaks: Box<[AtomicU32]>,
    /// Last stream error (set from the error callback, which is not real-time).
    error: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub channels: u16,
    pub sample_rate: u32,
    pub sample_format: String,
}

/// A running input stream. Dropping it stops the stream.
pub struct InputMonitor {
    shared: Arc<Shared>,
    info: MonitorInfo,
    samples: Consumer<f32>,
    stop_tx: Option<mpsc::Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl InputMonitor {
    /// Open the given device with its default input config and start capturing.
    pub fn start(host: &str, device_name: &str) -> Result<Self, AudioError> {
        let (ready_tx, ready_rx) = mpsc::channel();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let host = host.to_string();
        let device_name = device_name.to_string();

        // cpal streams are not `Send` on every platform, so the stream is
        // created, owned and dropped on one dedicated thread.
        let thread = std::thread::Builder::new()
            .name("audio-input".into())
            .spawn(move || match open_stream(&host, &device_name) {
                Ok((stream, shared, info, samples)) => {
                    let _ = ready_tx.send(Ok((shared, info, samples)));
                    // Block until asked to stop (or the handle is dropped).
                    let _ = stop_rx.recv();
                    drop(stream);
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                }
            })
            .map_err(|_| AudioError::ThreadDied)?;

        let (shared, info, samples) = ready_rx.recv().map_err(|_| AudioError::ThreadDied)??;
        Ok(Self {
            shared,
            info,
            samples,
            stop_tx: Some(stop_tx),
            thread: Some(thread),
        })
    }

    pub fn info(&self) -> &MonitorInfo {
        &self.info
    }

    /// Read each channel's peak (linear, 1.0 = full scale) since the last call
    /// and reset it. `out` is resized to the channel count.
    pub fn take_peaks(&self, out: &mut Vec<f32>) {
        out.clear();
        out.extend(
            self.shared
                .peaks
                .iter()
                .map(|p| f32::from_bits(p.swap(0, Ordering::Relaxed))),
        );
    }

    /// Drain all samples captured since the last call into `out` (replacing its
    /// contents). Samples are interleaved: `[ch0, ch1, ch0, ch1, ...]`.
    pub fn read_samples(&mut self, out: &mut Vec<f32>) {
        out.clear();
        let available = self.samples.slots();
        if let Ok(chunk) = self.samples.read_chunk(available) {
            let (a, b) = chunk.as_slices();
            out.extend_from_slice(a);
            out.extend_from_slice(b);
            chunk.commit_all();
        }
    }

    /// Take the last stream error, if any (e.g. the device was unplugged).
    pub fn take_error(&self) -> Option<String> {
        self.shared.error.lock().ok()?.take()
    }
}

impl Drop for InputMonitor {
    fn drop(&mut self) {
        drop(self.stop_tx.take());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

fn open_stream(
    host: &str,
    device_name: &str,
) -> Result<(cpal::Stream, Arc<Shared>, MonitorInfo, Consumer<f32>), AudioError> {
    let device = find_input_device(host, device_name)?;
    let supported = device.default_input_config()?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    let info = MonitorInfo {
        channels: config.channels,
        sample_rate: config.sample_rate.0,
        sample_format: format.to_string(),
    };
    let shared = Arc::new(Shared {
        peaks: (0..config.channels).map(|_| AtomicU32::new(0)).collect(),
        error: Mutex::new(None),
    });

    let capacity = config.sample_rate.0 as usize * config.channels as usize * RING_SECONDS;
    let (tx, rx) = RingBuffer::<f32>::new(capacity);

    use cpal::SampleFormat as F;
    let (d, c, s) = (&device, &config, &shared);
    let stream = match format {
        F::F32 => build::<f32>(d, c, s, tx)?,
        F::F64 => build::<f64>(d, c, s, tx)?,
        F::I8 => build::<i8>(d, c, s, tx)?,
        F::I16 => build::<i16>(d, c, s, tx)?,
        F::I32 => build::<i32>(d, c, s, tx)?,
        F::I64 => build::<i64>(d, c, s, tx)?,
        F::U8 => build::<u8>(d, c, s, tx)?,
        F::U16 => build::<u16>(d, c, s, tx)?,
        F::U32 => build::<u32>(d, c, s, tx)?,
        F::U64 => build::<u64>(d, c, s, tx)?,
        other => return Err(AudioError::UnsupportedFormat(other)),
    };
    stream.play()?;
    Ok((stream, shared, info, rx))
}

fn build<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    shared: &Arc<Shared>,
    mut samples: Producer<f32>,
) -> Result<cpal::Stream, AudioError>
where
    T: SizedSample,
    f32: cpal::FromSample<T>,
{
    let channels = config.channels as usize;
    let data_shared = Arc::clone(shared);
    let err_shared = Arc::clone(shared);

    let stream = device.build_input_stream(
        config,
        // REAL-TIME CALLBACK: no allocation, locks, I/O or logging here.
        move |data: &[T], _: &cpal::InputCallbackInfo| {
            for frame in data.chunks_exact(channels) {
                for (sample, peak) in frame.iter().zip(data_shared.peaks.iter()) {
                    let v = sample.to_sample::<f32>().abs();
                    if v.is_finite() {
                        peak.fetch_max(v.to_bits(), Ordering::Relaxed);
                    }
                }
            }
            // Forward raw samples for analysis; drop whatever doesn't fit.
            let n = data.len().min(samples.slots());
            if let Ok(chunk) = samples.write_chunk_uninit(n) {
                chunk.fill_from_iter(data.iter().map(|s| s.to_sample::<f32>()));
            }
        },
        move |err| {
            if let Ok(mut slot) = err_shared.error.lock() {
                *slot = Some(err.to_string());
            }
        },
        None,
    )?;
    Ok(stream)
}
