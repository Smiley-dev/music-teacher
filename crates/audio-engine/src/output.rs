//! Metronome click output with sample-accurate scheduling. Each click's
//! playback time is reported on the audio clock.

use std::f32::consts::TAU;
use std::sync::{Arc, Mutex, PoisonError, mpsc};
use std::thread::JoinHandle;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SizedSample, StreamInstant};
use rtrb::{Consumer, Producer, RingBuffer};

use crate::{AudioError, offset_instant};

/// Click length in seconds.
const CLICK_SECS: f32 = 0.03;
/// Click tone frequencies: accented (first beat of a bar) and normal.
const ACCENT_HZ: f32 = 1500.0;
const NORMAL_HZ: f32 = 1000.0;
/// Peak amplitude of a click (linear).
const CLICK_AMPLITUDE: f32 = 0.5;
/// Fade-in length in seconds, short enough to keep the attack sharp.
const ATTACK_SECS: f32 = 0.0005;

/// When to play clicks, relative to the start of the output stream.
#[derive(Debug, Clone, Copy)]
pub struct ClickSchedule {
    /// Silence before the first click, in seconds.
    pub lead_in_secs: f64,
    /// Time between clicks, in seconds.
    pub interval_secs: f64,
    pub count: u32,
    /// Every `accent_every`-th click (starting with the first) is accented.
    pub accent_every: u32,
}

/// A click that has been rendered, with the time its first sample plays.
#[derive(Debug, Clone, Copy)]
pub struct ClickTimestamp {
    pub index: u32,
    pub playback: StreamInstant,
}

/// Plays a click schedule on the default output device. Dropping it stops.
pub struct ClickPlayer {
    clicks: Consumer<ClickTimestamp>,
    error: Arc<Mutex<Option<AudioError>>>,
    stop_tx: Option<mpsc::Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl ClickPlayer {
    pub fn start(schedule: ClickSchedule) -> Result<Self, AudioError> {
        let (ready_tx, ready_rx) = mpsc::channel();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let error = Arc::new(Mutex::new(None));
        let thread_error = Arc::clone(&error);

        let thread = std::thread::Builder::new()
            .name("click-output".into())
            .spawn(move || match open_stream(schedule, thread_error) {
                Ok((stream, clicks)) => {
                    let _ = ready_tx.send(Ok(clicks));
                    let _ = stop_rx.recv();
                    drop(stream);
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                }
            })
            .map_err(|_| AudioError::ThreadDied)?;

        let clicks = ready_rx.recv().map_err(|_| AudioError::ThreadDied)??;
        Ok(Self {
            clicks,
            error,
            stop_tx: Some(stop_tx),
            thread: Some(thread),
        })
    }

    /// Append clicks rendered since the last call.
    pub fn read_clicks(&mut self, out: &mut Vec<ClickTimestamp>) {
        while let Ok(c) = self.clicks.pop() {
            out.push(c);
        }
    }

    pub fn take_error(&self) -> Option<AudioError> {
        self.error
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take()
    }
}

impl Drop for ClickPlayer {
    fn drop(&mut self) {
        drop(self.stop_tx.take());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// A short decaying sine burst.
fn click_sound(sample_rate: u32, hz: f32) -> Vec<f32> {
    let n = (sample_rate as f32 * CLICK_SECS) as usize;
    let attack = (sample_rate as f32 * ATTACK_SECS).max(1.0);
    (0..n)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let envelope = (i as f32 / attack).min(1.0) * (-t / (CLICK_SECS / 5.0)).exp();
            CLICK_AMPLITUDE * envelope * (TAU * hz * t).sin()
        })
        .collect()
}

fn open_stream(
    schedule: ClickSchedule,
    error: Arc<Mutex<Option<AudioError>>>,
) -> Result<(cpal::Stream, Consumer<ClickTimestamp>), AudioError> {
    let device = cpal::default_host()
        .default_output_device()
        .ok_or(AudioError::NoOutputDevice)?;
    let supported = device.default_output_config()?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let (tx, rx) = RingBuffer::new(schedule.count.max(1) as usize);

    use cpal::SampleFormat as F;
    let (d, c, s, e) = (&device, &config, schedule, error);
    let stream = match format {
        F::F32 => build::<f32>(d, c, s, tx, e)?,
        F::F64 => build::<f64>(d, c, s, tx, e)?,
        F::I16 => build::<i16>(d, c, s, tx, e)?,
        F::I32 => build::<i32>(d, c, s, tx, e)?,
        F::U16 => build::<u16>(d, c, s, tx, e)?,
        F::U8 => build::<u8>(d, c, s, tx, e)?,
        other => return Err(AudioError::UnsupportedFormat(other)),
    };
    stream.play()?;
    Ok((stream, rx))
}

fn build<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    schedule: ClickSchedule,
    mut clicks_tx: Producer<ClickTimestamp>,
    error: Arc<Mutex<Option<AudioError>>>,
) -> Result<cpal::Stream, AudioError>
where
    T: SizedSample + FromSample<f32>,
{
    let sample_rate = config.sample_rate.0;
    let channels = config.channels as usize;
    let sr = sample_rate as f64;
    // Everything the callback needs is computed up front.
    let click_frames: Vec<u64> = (0..schedule.count)
        .map(|k| ((schedule.lead_in_secs + k as f64 * schedule.interval_secs) * sr).round() as u64)
        .collect();
    let accent = click_sound(sample_rate, ACCENT_HZ);
    let normal = click_sound(sample_rate, NORMAL_HZ);
    let accent_every = schedule.accent_every.max(1);
    let mut frame: u64 = 0;

    let stream = device.build_output_stream(
        config,
        // REAL-TIME CALLBACK: no allocation, locks, I/O or logging here.
        move |data: &mut [T], info: &cpal::OutputCallbackInfo| {
            let buffer_start = frame;
            let buffer_frames = (data.len() / channels) as u64;
            for (i, out_frame) in data.chunks_exact_mut(channels).enumerate() {
                let f = buffer_start + i as u64;
                let mut value = 0.0f32;
                // At most one click sounds at a time (clicks are far apart).
                if let Some((k, &start)) = click_frames
                    .iter()
                    .enumerate()
                    .find(|&(_, &start)| f >= start && f - start < normal.len() as u64)
                {
                    let accented = (k as u32).is_multiple_of(accent_every);
                    let sound = if accented { &accent } else { &normal };
                    value = sound.get((f - start) as usize).copied().unwrap_or(0.0);
                }
                let sample = T::from_sample(value);
                out_frame.iter_mut().for_each(|s| *s = sample);
            }
            for (k, &start) in click_frames.iter().enumerate() {
                if start >= buffer_start && start < buffer_start + buffer_frames {
                    let playback = offset_instant(
                        &info.timestamp().playback,
                        start - buffer_start,
                        sample_rate,
                    );
                    let _ = clicks_tx.push(ClickTimestamp {
                        index: k as u32,
                        playback,
                    });
                }
            }
            frame += buffer_frames;
        },
        move |err| {
            *error.lock().unwrap_or_else(PoisonError::into_inner) = Some(err.into());
        },
        None,
    )?;
    Ok(stream)
}
