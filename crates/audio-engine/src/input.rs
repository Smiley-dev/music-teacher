//! Input capture: forwards raw samples and per-buffer capture timestamps
//! through lock-free ring buffers.

use std::sync::{Arc, Mutex, PoisonError, mpsc};
use std::thread::JoinHandle;

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{SizedSample, StreamInstant};
use rtrb::{Consumer, Producer, RingBuffer};
use serde::Serialize;

use crate::{AudioError, DeviceId, find_input_device};

/// Sample ring length in seconds of audio. If the reader falls further behind,
/// whole callback buffers are dropped (the audio thread never blocks).
const RING_SECONDS: usize = 1;
/// Capacity of the timestamp ring (one entry per callback buffer).
const TIMESTAMP_RING: usize = 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamInfo {
    pub channels: u16,
    pub sample_rate: u32,
    pub sample_format: String,
}

/// When the first frame of a callback buffer was captured.
#[derive(Debug, Clone, Copy)]
pub struct BufferTimestamp {
    /// Index of the buffer's first frame among all frames delivered so far.
    pub frame: u64,
    /// Capture time of that frame on the audio clock.
    pub capture: StreamInstant,
}

/// A running input stream. Dropping it stops the stream and releases the device.
pub struct InputStream {
    info: StreamInfo,
    samples: Consumer<f32>,
    timestamps: Consumer<BufferTimestamp>,
    error: Arc<Mutex<Option<AudioError>>>,
    stop_tx: Option<mpsc::Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

struct Opened {
    info: StreamInfo,
    samples: Consumer<f32>,
    timestamps: Consumer<BufferTimestamp>,
}

impl InputStream {
    /// Open `device` with its default input config and start capturing.
    pub fn open(device: &DeviceId) -> Result<Self, AudioError> {
        let (ready_tx, ready_rx) = mpsc::channel();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let error = Arc::new(Mutex::new(None));
        let device = device.clone();
        let thread_error = Arc::clone(&error);

        // cpal streams are not `Send` on every platform, so the stream is
        // created, owned and dropped on one dedicated thread.
        let thread = std::thread::Builder::new()
            .name("audio-input".into())
            .spawn(move || match open_stream(&device, thread_error) {
                Ok((stream, opened)) => {
                    let _ = ready_tx.send(Ok(opened));
                    let _ = stop_rx.recv(); // until stopped or the handle is dropped
                    drop(stream);
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                }
            })
            .map_err(|_| AudioError::ThreadDied)?;

        let opened = ready_rx.recv().map_err(|_| AudioError::ThreadDied)??;
        Ok(Self {
            info: opened.info,
            samples: opened.samples,
            timestamps: opened.timestamps,
            error,
            stop_tx: Some(stop_tx),
            thread: Some(thread),
        })
    }

    pub fn info(&self) -> &StreamInfo {
        &self.info
    }

    /// Drain all samples captured since the last call into `out` (replacing
    /// its contents). Interleaved `[ch0, ch1, ch0, ch1, ...]`, always whole
    /// frames, contiguous with the frame numbering in `BufferTimestamp`.
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

    /// Append the capture timestamps of buffers delivered since the last call.
    pub fn read_timestamps(&mut self, out: &mut Vec<BufferTimestamp>) {
        while let Ok(t) = self.timestamps.pop() {
            out.push(t);
        }
    }

    /// Take the stream error, if one happened. On WASAPI any stream error
    /// means the stream has stopped for good; reopen the device.
    pub fn take_error(&self) -> Option<AudioError> {
        self.error
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take()
    }
}

impl Drop for InputStream {
    fn drop(&mut self) {
        drop(self.stop_tx.take());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

fn open_stream(
    id: &DeviceId,
    error: Arc<Mutex<Option<AudioError>>>,
) -> Result<(cpal::Stream, Opened), AudioError> {
    let device = find_input_device(id)?;
    let supported = device.default_input_config()?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    let info = StreamInfo {
        channels: config.channels,
        sample_rate: config.sample_rate.0,
        sample_format: format.to_string(),
    };
    let capacity = config.sample_rate.0 as usize * config.channels as usize * RING_SECONDS;
    let (samples_tx, samples_rx) = RingBuffer::<f32>::new(capacity);
    let (ts_tx, ts_rx) = RingBuffer::<BufferTimestamp>::new(TIMESTAMP_RING);
    let rings = (samples_tx, ts_tx);

    use cpal::SampleFormat as F;
    let (d, c, e) = (&device, &config, error);
    let stream = match format {
        F::F32 => build::<f32>(d, c, rings, e)?,
        F::F64 => build::<f64>(d, c, rings, e)?,
        F::I8 => build::<i8>(d, c, rings, e)?,
        F::I16 => build::<i16>(d, c, rings, e)?,
        F::I32 => build::<i32>(d, c, rings, e)?,
        F::I64 => build::<i64>(d, c, rings, e)?,
        F::U8 => build::<u8>(d, c, rings, e)?,
        F::U16 => build::<u16>(d, c, rings, e)?,
        F::U32 => build::<u32>(d, c, rings, e)?,
        F::U64 => build::<u64>(d, c, rings, e)?,
        other => return Err(AudioError::UnsupportedFormat(other)),
    };
    stream.play()?;
    Ok((
        stream,
        Opened {
            info,
            samples: samples_rx,
            timestamps: ts_rx,
        },
    ))
}

fn build<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    (mut samples, mut timestamps): (Producer<f32>, Producer<BufferTimestamp>),
    error: Arc<Mutex<Option<AudioError>>>,
) -> Result<cpal::Stream, AudioError>
where
    T: SizedSample,
    f32: cpal::FromSample<T>,
{
    let channels = config.channels as u64;
    let mut next_frame: u64 = 0;

    let stream = device.build_input_stream(
        config,
        // REAL-TIME CALLBACK: no allocation, locks, I/O or logging here.
        move |data: &[T], info: &cpal::InputCallbackInfo| {
            // All-or-nothing, so frame numbering always matches the samples
            // the reader actually receives.
            let Ok(chunk) = samples.write_chunk_uninit(data.len()) else {
                return;
            };
            chunk.fill_from_iter(data.iter().map(|s| s.to_sample::<f32>()));
            let _ = timestamps.push(BufferTimestamp {
                frame: next_frame,
                capture: info.timestamp().capture,
            });
            next_frame += data.len() as u64 / channels;
        },
        // Not real-time: runs on the host's error path.
        move |err| {
            *error.lock().unwrap_or_else(PoisonError::into_inner) = Some(err.into());
        },
        None,
    )?;
    Ok(stream)
}
