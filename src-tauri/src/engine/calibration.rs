//! Latency calibration session: plays clicks, collects onsets, and computes
//! round-trip latency on the audio clock (ADR 0003).

use std::time::{Duration, Instant};

use audio_engine::{ClickPlayer, ClickSchedule, ClickTimestamp, StreamInstant, signed_secs};
use dsp::calibration::{BEATS_PER_BAR, CALIBRATION_BPM, CLICK_COUNT, beat_secs};
use dsp::{LatencyEstimate, OnsetDetector};

use super::analysis::Analyzer;

/// Silence before the first click, in seconds.
const LEAD_IN_SECS: f64 = 1.0;
/// Keep listening this many beats after the last click for late notes.
const TAIL_BEATS: f64 = 1.0;
/// Give up if the session runs this much longer than planned (wall clock;
/// only a safety net, never used for timing).
const TIMEOUT_MARGIN: Duration = Duration::from_secs(5);

pub enum Progress {
    /// Clicks played so far.
    Running {
        beat: u32,
    },
    Finished(Result<LatencyEstimate, Failure>),
}

pub struct Failure {
    pub message: String,
    /// Set when enough audio was heard but too few clicks matched.
    pub matched: Option<usize>,
}

impl Failure {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            matched: None,
        }
    }
}

pub struct CalibrationSession {
    player: ClickPlayer,
    detector: OnsetDetector,
    clicks: Vec<ClickTimestamp>,
    onsets: Vec<StreamInstant>,
    onset_frames: Vec<u64>,
    deadline: Instant,
}

impl CalibrationSession {
    /// Start playing clicks. Onsets are detected from `analyzer`'s input,
    /// starting with the next frame it reads.
    pub fn start(analyzer: &Analyzer) -> Result<Self, String> {
        let beat = beat_secs(CALIBRATION_BPM);
        let player = ClickPlayer::start(ClickSchedule {
            lead_in_secs: LEAD_IN_SECS,
            interval_secs: beat,
            count: CLICK_COUNT,
            accent_every: BEATS_PER_BAR,
        })
        .map_err(|e| format!("could not play the metronome: {e}"))?;
        let planned = LEAD_IN_SECS + beat * (CLICK_COUNT as f64 - 1.0 + TAIL_BEATS);
        Ok(Self {
            player,
            detector: OnsetDetector::new(analyzer.info.sample_rate, analyzer.frames()),
            clicks: Vec::with_capacity(CLICK_COUNT as usize),
            onsets: Vec::new(),
            onset_frames: Vec::new(),
            deadline: Instant::now() + Duration::from_secs_f64(planned) + TIMEOUT_MARGIN,
        })
    }

    /// Call after every `Analyzer::process`.
    pub fn tick(&mut self, analyzer: &Analyzer) -> Progress {
        if let Some(error) = self.player.take_error() {
            return Progress::Finished(Err(Failure::new(format!(
                "the metronome stopped: {error}"
            ))));
        }
        self.player.read_clicks(&mut self.clicks);

        let (mono, _) = analyzer.last_mono();
        self.onset_frames.clear();
        self.detector.push(mono, &mut self.onset_frames);
        self.onsets.extend(
            self.onset_frames
                .iter()
                .filter_map(|&f| analyzer.frame_instant(f)),
        );

        let beat = beat_secs(CALIBRATION_BPM);
        let all_clicked = self.clicks.len() as u32 >= CLICK_COUNT;
        let listened_long_enough = match (self.clicks.last(), analyzer.latest_instant()) {
            (Some(last), Some(now)) => signed_secs(&now, &last.playback) >= beat * TAIL_BEATS,
            _ => false,
        };
        if all_clicked && listened_long_enough {
            return Progress::Finished(self.estimate(beat));
        }
        if Instant::now() > self.deadline {
            return Progress::Finished(Err(Failure::new(
                "timed out waiting for audio; check that the input device is working",
            )));
        }
        Progress::Running {
            beat: self.clicks.len() as u32,
        }
    }

    fn estimate(&self, beat: f64) -> Result<LatencyEstimate, Failure> {
        let reference = self.clicks[0].playback;
        let clicks: Vec<f64> = self
            .clicks
            .iter()
            .map(|c| signed_secs(&c.playback, &reference))
            .collect();
        let onsets: Vec<f64> = self
            .onsets
            .iter()
            .map(|o| signed_secs(o, &reference))
            .collect();
        dsp::estimate_latency(&clicks, &onsets, beat).map_err(|e| {
            let dsp::CalibrationError::TooFewMatches { matched, .. } = e;
            Failure {
                message: e.to_string(),
                matched: Some(matched),
            }
        })
    }
}
