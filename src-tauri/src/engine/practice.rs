//! Rhythm practice session: count-in plus a metronome over the exercise, and
//! live timing judgement of the notes played on the input (ADR 0006, 0008).
//!
//! Everything is measured on the audio clock. A played note's position is
//! `(onset capture instant − first click playback instant) / beat − count-in
//! − latency`, where latency is the saved round-trip calibration.

use std::time::{Duration, Instant};

use audio_engine::{ClickPlayer, ClickSchedule, ClickTimestamp, StreamInstant, signed_secs};
use dsp::OnsetDetector;
use rhythm::{Exercise, Judgement, MAX_WINDOW_MS, TimingJudge, TimingReport};

use super::analysis::Analyzer;

/// Clicks before the exercise starts (always four, in any time signature).
pub const COUNT_IN_CLICKS: u32 = 4;
/// Silence before the first count-in click, in seconds.
const LEAD_IN_SECS: f64 = 0.3;
/// Wall-clock safety net beyond the planned length (never used for timing).
const TIMEOUT_MARGIN: Duration = Duration::from_secs(5);

/// Click accents: count-in accents its first click, then beat 1 of every bar.
fn accents(beats_per_bar: u32, bars: u32) -> Vec<bool> {
    let count_in = (0..COUNT_IN_CLICKS).map(|k| k == 0);
    let exercise = (0..bars * beats_per_bar).map(|k| k.is_multiple_of(beats_per_bar));
    count_in.chain(exercise).collect()
}

pub enum Progress {
    Running {
        /// Beats from the start of the exercise; negative during the
        /// count-in, `None` until the first click has been scheduled.
        position_beats: Option<f64>,
        /// Notes judged during this tick (hits and misses).
        judged: Vec<Judgement>,
    },
    Finished(TimingReport),
    Failed(String),
}

pub struct RhythmSession {
    player: ClickPlayer,
    detector: OnsetDetector,
    judge: Option<TimingJudge>,
    beat_secs: f64,
    /// Saved latency in beats; subtracted from onsets.
    latency_beats: f64,
    total_beats: u32,
    first_click: Option<StreamInstant>,
    clicks: Vec<ClickTimestamp>,
    onset_frames: Vec<u64>,
    deadline: Instant,
}

impl RhythmSession {
    /// Start the metronome and listen to `analyzer`'s input from its next
    /// frame. `latency_ms` is the saved calibration (`None` = 0).
    pub fn start(
        exercise: &Exercise,
        bpm: u32,
        latency_ms: Option<f64>,
        analyzer: &Analyzer,
    ) -> Result<Self, String> {
        let beats_per_bar = exercise.time_signature.beats_per_bar;
        let bars = exercise.bars.len() as u32;
        let beat_secs = 60.0 / bpm as f64;
        let player = ClickPlayer::start(ClickSchedule {
            lead_in_secs: LEAD_IN_SECS,
            interval_secs: beat_secs,
            accents: accents(beats_per_bar, bars),
        })
        .map_err(|e| format!("could not play the metronome: {e}"))?;
        let total_beats = exercise.total_beats();
        let latency_secs = latency_ms.unwrap_or(0.0) / 1000.0;
        let planned = LEAD_IN_SECS
            + beat_secs * (COUNT_IN_CLICKS + total_beats) as f64
            + latency_secs.max(0.0)
            + MAX_WINDOW_MS / 1000.0;
        Ok(Self {
            player,
            detector: OnsetDetector::new(analyzer.info.sample_rate, analyzer.frames()),
            judge: Some(TimingJudge::new(exercise, bpm as f64)),
            beat_secs,
            latency_beats: latency_secs / beat_secs,
            total_beats,
            first_click: None,
            clicks: Vec::new(),
            onset_frames: Vec::new(),
            deadline: Instant::now() + Duration::from_secs_f64(planned) + TIMEOUT_MARGIN,
        })
    }

    pub fn total_beats(&self) -> u32 {
        self.total_beats
    }

    /// Call after every `Analyzer::process`.
    pub fn tick(&mut self, analyzer: &Analyzer) -> Progress {
        if let Some(error) = self.player.take_error() {
            return Progress::Failed(format!("the metronome stopped: {error}"));
        }
        self.clicks.clear();
        self.player.read_clicks(&mut self.clicks);
        if self.first_click.is_none() {
            self.first_click = self
                .clicks
                .iter()
                .find(|c| c.index == 0)
                .map(|c| c.playback);
        }
        if Instant::now() > self.deadline {
            return Progress::Failed(
                "timed out waiting for audio; check that the input device is working".into(),
            );
        }

        // Always run the detector so its frame numbering stays in step.
        let (mono, _) = analyzer.last_mono();
        self.onset_frames.clear();
        self.detector.push(mono, &mut self.onset_frames);

        let Some(first) = self.first_click else {
            return Progress::Running {
                position_beats: None,
                judged: Vec::new(),
            };
        };
        let to_beats = |instant: &StreamInstant| {
            signed_secs(instant, &first) / self.beat_secs - COUNT_IN_CLICKS as f64
        };
        let Some(judge) = self.judge.as_mut() else {
            return Progress::Failed("practice session already finished".into());
        };

        let mut judged = Vec::new();
        for &frame in &self.onset_frames {
            if let Some(instant) = analyzer.frame_instant(frame) {
                judged.extend(judge.onset(to_beats(&instant) - self.latency_beats));
            }
        }

        let position_beats = analyzer.latest_instant().map(|now| to_beats(&now));
        if let Some(position) = position_beats {
            // A note played on time arrives `latency` later, so only give up
            // on it once that much more audio has been heard.
            judged.extend(judge.advance(position - self.latency_beats));
            let window_beats = MAX_WINDOW_MS / 1000.0 / self.beat_secs;
            let done = self.total_beats as f64 + self.latency_beats.max(0.0) + window_beats;
            if position >= done
                && let Some(judge) = self.judge.take()
            {
                return Progress::Finished(judge.report());
            }
        }
        Progress::Running {
            position_beats,
            judged,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn count_in_then_bar_accents() {
        assert_eq!(
            accents(3, 2),
            vec![
                true, false, false, false, // count-in
                true, false, false, // bar 1
                true, false, false, // bar 2
            ]
        );
    }
}
