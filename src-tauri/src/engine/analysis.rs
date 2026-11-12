//! Per-tick analysis of everything captured since the last tick.

use std::collections::VecDeque;

use audio_engine::{BufferTimestamp, InputStream, StreamInfo, StreamInstant, offset_instant};
use dsp::{ChannelMeter, NoteStabilizer, PitchTracker, SampleHistory};

use super::events::Frame;

/// Samples kept per channel for the waveform (~43 ms at 48 kHz).
const WAVEFORM_SAMPLES: usize = 2048;
/// Number of min/max buckets sent to the UI.
const WAVEFORM_POINTS: usize = 256;
/// Buffer timestamps kept for mapping frames to audio-clock time.
const TIMESTAMP_HISTORY: usize = 512;

/// Analysis state for one open input stream.
pub struct Analyzer {
    pub info: StreamInfo,
    trackers: Vec<PitchTracker>,
    meters: Vec<ChannelMeter>,
    histories: Vec<SampleHistory>,
    stabilizer: NoteStabilizer,
    timestamps: VecDeque<BufferTimestamp>,
    /// Frames consumed so far (same numbering as `BufferTimestamp::frame`).
    frames: u64,
    samples: Vec<f32>,
    new_timestamps: Vec<BufferTimestamp>,
    /// Gained mono signal of the last tick, for onset detection.
    mono: Vec<f32>,
    mono_start: u64,
    waveform: Vec<f32>,
}

impl Analyzer {
    pub fn new(info: StreamInfo) -> Self {
        let channels = info.channels as usize;
        Self {
            trackers: (0..channels)
                .map(|_| PitchTracker::new(info.sample_rate))
                .collect(),
            meters: vec![ChannelMeter::default(); channels],
            histories: vec![SampleHistory::new(WAVEFORM_SAMPLES); channels],
            stabilizer: NoteStabilizer::new(),
            timestamps: VecDeque::with_capacity(TIMESTAMP_HISTORY),
            frames: 0,
            samples: Vec::new(),
            new_timestamps: Vec::new(),
            mono: Vec::new(),
            mono_start: 0,
            waveform: Vec::new(),
            info,
        }
    }

    /// Read new audio from `input`, apply `gain` (linear) and analyse it.
    /// `now` is display time in seconds (meter/note hold timing only).
    pub fn process(&mut self, input: &mut InputStream, gain: f32, now: f64) -> Frame {
        let channels = self.trackers.len();
        input.read_samples(&mut self.samples);
        self.new_timestamps.clear();
        input.read_timestamps(&mut self.new_timestamps);
        for t in self.new_timestamps.drain(..) {
            if self.timestamps.len() == TIMESTAMP_HISTORY {
                self.timestamps.pop_front();
            }
            self.timestamps.push_back(t);
        }

        self.mono_start = self.frames;
        self.frames += (self.samples.len() / channels.max(1)) as u64;
        self.mono.clear();

        let mut raw_peaks = vec![0.0f32; channels];
        let mut peaks = vec![0.0f32; channels];
        for frame in self.samples.chunks_exact_mut(channels) {
            let mut loudest = 0.0f32;
            for (ch, s) in frame.iter_mut().enumerate() {
                raw_peaks[ch] = raw_peaks[ch].max(s.abs());
                *s *= gain;
                peaks[ch] = peaks[ch].max(s.abs());
                if s.abs() > loudest.abs() {
                    loudest = *s;
                }
            }
            self.mono.push(loudest);
        }

        let mut pitches = Vec::with_capacity(channels);
        for (ch, (tracker, history)) in self
            .trackers
            .iter_mut()
            .zip(self.histories.iter_mut())
            .enumerate()
        {
            let channel = self.samples.iter().skip(ch).step_by(channels).copied();
            tracker.push(channel.clone());
            history.push(channel);
            pitches.push(tracker.detect());
        }

        let meters: Vec<_> = self
            .meters
            .iter_mut()
            .enumerate()
            .map(|(ch, m)| m.update(peaks[ch], raw_peaks[ch], now))
            .collect();

        // Strongest channel with a pitch drives the note display.
        let strongest = pitches
            .iter()
            .enumerate()
            .filter_map(|(ch, p)| p.as_ref().map(|p| (p, ch)))
            .max_by(|a, b| peaks[a.1].total_cmp(&peaks[b.1]));
        let note = self.stabilizer.update(strongest, now).cloned();

        let waveform_channel = note.as_ref().map(|n| n.channel).unwrap_or_else(|| {
            (0..channels)
                .max_by(|&a, &b| meters[a].db.total_cmp(&meters[b].db))
                .unwrap_or(0)
        });
        if let Some(history) = self.histories.get(waveform_channel) {
            history.min_max(WAVEFORM_POINTS, &mut self.waveform);
        }

        Frame {
            meters,
            waveform: self.waveform.clone(),
            waveform_channel,
            note,
        }
    }

    /// Frames consumed so far; the next `process` starts at this frame index.
    pub fn frames(&self) -> u64 {
        self.frames
    }

    /// The gained mono signal (loudest sample per frame) read by the last
    /// `process` call, and the frame index of its first sample.
    pub fn last_mono(&self) -> (&[f32], u64) {
        (&self.mono, self.mono_start)
    }

    /// Audio-clock time at which `frame` was captured.
    pub fn frame_instant(&self, frame: u64) -> Option<StreamInstant> {
        let t = self.timestamps.iter().rev().find(|t| t.frame <= frame)?;
        Some(offset_instant(
            &t.capture,
            frame - t.frame,
            self.info.sample_rate,
        ))
    }

    /// Audio-clock time of the newest captured frame.
    pub fn latest_instant(&self) -> Option<StreamInstant> {
        self.frame_instant(self.frames.checked_sub(1)?)
    }
}
