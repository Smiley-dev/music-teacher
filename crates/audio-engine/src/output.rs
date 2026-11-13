//! Metronome click output with sample-accurate scheduling, plus optional
//! pitched tones (to play an exercise back). Each click's playback time is
//! reported on the audio clock.

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
/// Peak amplitude of a tone (linear); quieter than clicks so both are heard.
const TONE_AMPLITUDE: f32 = 0.3;
/// Tones sound for this fraction of their length, so repeated notes are
/// heard as separate notes.
const TONE_GATE: f64 = 0.9;
/// Tone attack and release, in seconds (avoid clicks at the edges).
const TONE_ATTACK_SECS: f32 = 0.005;
const TONE_RELEASE_SECS: f32 = 0.02;
/// Decay time constant of the plucked-like tone, in seconds.
const TONE_DECAY_SECS: f32 = 0.6;

/// A pitched note to play, relative to the start of the output stream.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Tone {
    pub start_secs: f64,
    pub duration_secs: f64,
    pub frequency: f32,
}

/// When to play clicks, relative to the start of the output stream.
#[derive(Debug, Clone)]
pub struct ClickSchedule {
    /// Silence before the first click, in seconds.
    pub lead_in_secs: f64,
    /// Time between clicks, in seconds.
    pub interval_secs: f64,
    /// One entry per click: `true` = accented (higher pitch).
    pub accents: Vec<bool>,
    /// Tones to play alongside the clicks, sorted by start and not
    /// overlapping. Empty for a plain metronome.
    pub tones: Vec<Tone>,
}

impl ClickSchedule {
    /// `count` clicks, accenting the first of every `accent_every`.
    pub fn regular(lead_in_secs: f64, interval_secs: f64, count: u32, accent_every: u32) -> Self {
        Self {
            lead_in_secs,
            interval_secs,
            accents: (0..count)
                .map(|k| k.is_multiple_of(accent_every.max(1)))
                .collect(),
            tones: Vec::new(),
        }
    }
}

/// Pre-computed click schedule rendered frame by frame. Allocation-free after
/// construction, O(1) per frame (walks the sorted click list with an index).
struct ClickTrack {
    starts: Vec<u64>,
    accents: Vec<bool>,
    accent: Vec<f32>,
    normal: Vec<f32>,
    /// First click that has not finished sounding.
    next: usize,
    tone_starts: Vec<u64>,
    /// Index into `tone_sounds` per tone.
    tone_sound: Vec<usize>,
    /// Rendered tones, one per distinct (frequency, length).
    tone_sounds: Vec<Vec<f32>>,
    tone_next: usize,
    frame: u64,
}

impl ClickTrack {
    fn new(schedule: &ClickSchedule, sample_rate: u32) -> Self {
        let sr = sample_rate as f64;
        Self {
            starts: (0..schedule.accents.len())
                .map(|k| {
                    ((schedule.lead_in_secs + k as f64 * schedule.interval_secs) * sr).round()
                        as u64
                })
                .collect(),
            accents: schedule.accents.clone(),
            accent: click_sound(sample_rate, ACCENT_HZ),
            normal: click_sound(sample_rate, NORMAL_HZ),
            next: 0,
            tone_starts: Vec::new(),
            tone_sound: Vec::new(),
            tone_sounds: Vec::new(),
            tone_next: 0,
            frame: 0,
        }
        .with_tones(&schedule.tones, sample_rate)
    }

    fn with_tones(mut self, tones: &[Tone], sample_rate: u32) -> Self {
        let sr = sample_rate as f64;
        let mut keys: Vec<(u32, usize)> = Vec::new();
        for tone in tones {
            let frames = (tone.duration_secs * TONE_GATE * sr).round() as usize;
            let key = (tone.frequency.to_bits(), frames);
            let index = keys.iter().position(|k| *k == key).unwrap_or_else(|| {
                keys.push(key);
                self.tone_sounds
                    .push(tone_sound(sample_rate, tone.frequency, frames));
                keys.len() - 1
            });
            self.tone_starts.push((tone.start_secs * sr).round() as u64);
            self.tone_sound.push(index);
        }
        self
    }

    /// The tone sample at absolute frame `f` (0 when no tone sounds).
    fn tone_at(&mut self, f: u64) -> f32 {
        while let Some(&start) = self.tone_starts.get(self.tone_next) {
            let len = self.tone_sounds[self.tone_sound[self.tone_next]].len() as u64;
            if f < start + len {
                break;
            }
            self.tone_next += 1;
        }
        match self.tone_starts.get(self.tone_next) {
            Some(&start) if f >= start => {
                let sound = &self.tone_sounds[self.tone_sound[self.tone_next]];
                sound.get((f - start) as usize).copied().unwrap_or(0.0)
            }
            _ => 0.0,
        }
    }

    /// Render `frames` frames: `write(i, value)` per frame, and
    /// `started(click_index, frame_offset)` for each click starting here.
    fn render(
        &mut self,
        frames: usize,
        mut write: impl FnMut(usize, f32),
        mut started: impl FnMut(u32, u64),
    ) {
        let len = self.normal.len() as u64;
        for i in 0..frames {
            let f = self.frame + i as u64;
            while self.next < self.starts.len() && f >= self.starts[self.next] + len {
                self.next += 1;
            }
            let mut value = 0.0;
            if let Some(&start) = self.starts.get(self.next)
                && f >= start
            {
                if f == start {
                    started(self.next as u32, i as u64);
                }
                let sound = if self.accents[self.next] {
                    &self.accent
                } else {
                    &self.normal
                };
                value = sound.get((f - start) as usize).copied().unwrap_or(0.0);
            }
            value += self.tone_at(f);
            write(i, value);
        }
        self.frame += frames as u64;
    }
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
    /// Receives the playback time of the stream's first frame, once.
    origin_rx: Consumer<StreamInstant>,
    origin: Option<StreamInstant>,
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
                Ok((stream, rings)) => {
                    let _ = ready_tx.send(Ok(rings));
                    let _ = stop_rx.recv();
                    drop(stream);
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                }
            })
            .map_err(|_| AudioError::ThreadDied)?;

        let (clicks, origin_rx) = ready_rx.recv().map_err(|_| AudioError::ThreadDied)??;
        Ok(Self {
            clicks,
            origin_rx,
            origin: None,
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

    /// When the schedule's time 0 plays (the stream's first frame), on the
    /// audio clock. `None` until the output has started. Schedule times
    /// (`lead_in_secs`, `Tone::start_secs`) are relative to this instant.
    pub fn origin(&mut self) -> Option<StreamInstant> {
        if self.origin.is_none() {
            self.origin = self.origin_rx.pop().ok();
        }
        self.origin
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

/// A soft plucked tone of `frames` samples: a few harmonics with a fast
/// attack, exponential decay and a short release at the end.
fn tone_sound(sample_rate: u32, hz: f32, frames: usize) -> Vec<f32> {
    let sr = sample_rate as f32;
    let attack = (sr * TONE_ATTACK_SECS).max(1.0);
    let release = (sr * TONE_RELEASE_SECS).max(1.0).min(frames as f32 / 2.0);
    (0..frames)
        .map(|i| {
            let t = i as f32 / sr;
            let left = (frames - i) as f32;
            let envelope = (i as f32 / attack).min(1.0)
                * (-t / TONE_DECAY_SECS).exp()
                * (left / release).min(1.0);
            let wave = (TAU * hz * t).sin()
                + 0.4 * (TAU * 2.0 * hz * t).sin()
                + 0.15 * (TAU * 3.0 * hz * t).sin();
            TONE_AMPLITUDE * envelope * wave / 1.55
        })
        .collect()
}

/// Ring buffer ends the player reads: click timestamps and the origin.
type Rings = (Consumer<ClickTimestamp>, Consumer<StreamInstant>);

fn open_stream(
    schedule: ClickSchedule,
    error: Arc<Mutex<Option<AudioError>>>,
) -> Result<(cpal::Stream, Rings), AudioError> {
    let device = cpal::default_host()
        .default_output_device()
        .ok_or(AudioError::NoOutputDevice)?;
    let supported = device.default_output_config()?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let (tx, rx) = RingBuffer::new(schedule.accents.len().max(1));
    let (origin_tx, origin_rx) = RingBuffer::new(1);

    use cpal::SampleFormat as F;
    let (d, c, s, e) = (&device, &config, &schedule, error);
    let t = (tx, origin_tx);
    let stream = match format {
        F::F32 => build::<f32>(d, c, s, t, e)?,
        F::F64 => build::<f64>(d, c, s, t, e)?,
        F::I16 => build::<i16>(d, c, s, t, e)?,
        F::I32 => build::<i32>(d, c, s, t, e)?,
        F::U16 => build::<u16>(d, c, s, t, e)?,
        F::U8 => build::<u8>(d, c, s, t, e)?,
        other => return Err(AudioError::UnsupportedFormat(other)),
    };
    stream.play()?;
    Ok((stream, (rx, origin_rx)))
}

fn build<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    schedule: &ClickSchedule,
    (mut clicks_tx, mut origin_tx): (Producer<ClickTimestamp>, Producer<StreamInstant>),
    error: Arc<Mutex<Option<AudioError>>>,
) -> Result<cpal::Stream, AudioError>
where
    T: SizedSample + FromSample<f32>,
{
    let sample_rate = config.sample_rate.0;
    let channels = config.channels as usize;
    // Everything the callback needs is computed up front.
    let mut track = ClickTrack::new(schedule, sample_rate);
    let mut origin_sent = false;

    let stream = device.build_output_stream(
        config,
        // REAL-TIME CALLBACK: no allocation, locks, I/O or logging here.
        move |data: &mut [T], info: &cpal::OutputCallbackInfo| {
            let playback = info.timestamp().playback;
            if !origin_sent {
                // The first buffer starts at schedule time 0.
                origin_sent = origin_tx.push(playback).is_ok();
            }
            track.render(
                data.len() / channels,
                |i, value| {
                    let sample = T::from_sample(value);
                    data[i * channels..(i + 1) * channels].fill(sample);
                },
                |index, offset| {
                    let _ = clicks_tx.push(ClickTimestamp {
                        index,
                        playback: offset_instant(&playback, offset, sample_rate),
                    });
                },
            );
        },
        move |err| {
            *error.lock().unwrap_or_else(PoisonError::into_inner) = Some(err.into());
        },
        None,
    )?;
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    /// Render `total` frames in uneven buffers; return the samples and the
    /// absolute frame at which each click was reported to start.
    fn render_all(schedule: &ClickSchedule, total: usize) -> (Vec<f32>, Vec<(u32, u64)>) {
        let mut track = ClickTrack::new(schedule, SR);
        let mut samples = vec![0.0; total];
        let mut starts = Vec::new();
        let mut done = 0;
        for size in [441, 512, 1000, 127].iter().cycle() {
            if done >= total {
                break;
            }
            let n = (*size).min(total - done);
            let base = done;
            track.render(
                n,
                |i, v| samples[base + i] = v,
                |k, offset| starts.push((k, base as u64 + offset)),
            );
            done += n;
        }
        (samples, starts)
    }

    #[test]
    fn regular_accents() {
        let s = ClickSchedule::regular(0.0, 0.5, 6, 3);
        assert_eq!(s.accents, vec![true, false, false, true, false, false]);
    }

    #[test]
    fn clicks_start_on_exact_frames_and_are_reported_once() {
        let s = ClickSchedule::regular(0.1, 0.25, 8, 4);
        let (samples, starts) = render_all(&s, SR as usize * 3);
        let expected: Vec<(u32, u64)> = (0..8).map(|k| (k, 4_800 + k as u64 * 12_000)).collect();
        assert_eq!(starts, expected);
        assert!(samples[..4_800].iter().all(|&v| v == 0.0), "silent lead-in");
        assert!(
            samples[4_801..4_900].iter().any(|v| v.abs() > 0.1),
            "click sounds"
        );
    }

    #[test]
    fn accented_clicks_use_the_accent_sound() {
        let s = ClickSchedule {
            lead_in_secs: 0.0,
            interval_secs: 0.5,
            accents: vec![true, false],
            tones: Vec::new(),
        };
        let (samples, _) = render_all(&s, SR as usize);
        let accent = click_sound(SR, ACCENT_HZ);
        let normal = click_sound(SR, NORMAL_HZ);
        assert_eq!(&samples[..accent.len()], &accent[..]);
        assert_eq!(&samples[24_000..24_000 + normal.len()], &normal[..]);
    }

    #[test]
    fn tones_play_at_their_start_and_leave_a_gap() {
        let tone = |start_secs| Tone {
            start_secs,
            duration_secs: 0.5,
            frequency: 220.0,
        };
        let s = ClickSchedule {
            lead_in_secs: 0.0,
            interval_secs: 1.0,
            accents: vec![],
            tones: vec![tone(0.25), tone(0.75)],
        };
        let (samples, starts) = render_all(&s, SR as usize * 2);
        assert!(starts.is_empty(), "tones are not reported as clicks");
        let loud = |range: std::ops::Range<usize>| samples[range].iter().any(|v| v.abs() > 0.05);
        assert!(samples[..12_000].iter().all(|&v| v == 0.0), "silent before");
        assert!(loud(12_100..13_000), "first tone");
        // 90% gate: the first tone ends at 0.25 + 0.45 s = frame 33 600.
        assert!(samples[33_700..35_900].iter().all(|&v| v == 0.0), "gap");
        assert!(loud(36_100..37_000), "second tone");
        assert!(samples[..].iter().all(|v| v.abs() <= TONE_AMPLITUDE + 1e-6));
    }
}
