//! Rhythm practice session: count-in plus a metronome over the exercise, with
//! the playback position measured on the audio clock (ADR 0006).

use std::time::{Duration, Instant};

use audio_engine::{ClickPlayer, ClickSchedule, ClickTimestamp, StreamInstant, signed_secs};
use rhythm::Exercise;

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
    /// Position in beats from the start of the exercise; negative during the
    /// count-in, `None` until the first click has been scheduled.
    Running {
        position_beats: Option<f64>,
    },
    Finished,
    Failed(String),
}

pub struct RhythmSession {
    player: ClickPlayer,
    beat_secs: f64,
    total_beats: u32,
    first_click: Option<StreamInstant>,
    clicks: Vec<ClickTimestamp>,
    deadline: Instant,
}

impl RhythmSession {
    pub fn start(exercise: &Exercise, bpm: u32) -> Result<Self, String> {
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
        let planned = LEAD_IN_SECS + beat_secs * (COUNT_IN_CLICKS + total_beats) as f64;
        Ok(Self {
            player,
            beat_secs,
            total_beats,
            first_click: None,
            clicks: Vec::new(),
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

        let position_beats = match (self.first_click, analyzer.latest_instant()) {
            (Some(first), Some(now)) => {
                Some(signed_secs(&now, &first) / self.beat_secs - COUNT_IN_CLICKS as f64)
            }
            _ => None,
        };
        match position_beats {
            Some(p) if p >= self.total_beats as f64 => Progress::Finished,
            _ => Progress::Running { position_beats },
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
