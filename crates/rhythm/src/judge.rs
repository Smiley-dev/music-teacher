//! Timing judgement: match played onsets to the notes of an exercise and
//! summarise the result (ADR 0008).
//!
//! All positions are in beats from the start of the exercise on the audio
//! clock, already corrected for the calibrated latency.

use serde::Serialize;

use crate::model::{Exercise, SIXTEENTHS_PER_BEAT};

/// |offset| up to this many ms counts as on time.
pub const ON_TIME_MS: f64 = 40.0;
/// An onset can match a note at most this many ms away...
pub const MAX_WINDOW_MS: f64 = 150.0;
/// ...and never more than this fraction of the gap to a neighbouring note,
/// so fast passages do not steal each other's hits.
pub const WINDOW_GAP_FRACTION: f64 = 0.5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TimingResult {
    OnTime,
    Early,
    Late,
    Missed,
}

/// The result for one played note of the exercise (rests are not judged).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Judgement {
    pub bar: usize,
    pub symbol: usize,
    /// Where the note should start, in beats.
    pub beat: f64,
    pub result: TimingResult,
    /// Played minus expected time in ms (negative = early); `None` if missed.
    pub offset_ms: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingSummary {
    pub notes: usize,
    pub on_time: usize,
    pub early: usize,
    pub late: usize,
    pub missed: usize,
    /// Onsets that matched no note (extra hits, double hits, playing in rests).
    pub extra: usize,
    /// Share of notes played on time, 0..100.
    pub accuracy_percent: f64,
    /// Share of notes that were played at all, 0..100.
    pub hit_percent: f64,
    /// Mean offset of the hit notes in ms (< 0 = rushing, > 0 = dragging).
    pub mean_offset_ms: Option<f64>,
    /// Standard deviation of the offsets in ms (lower = steadier).
    pub spread_ms: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingReport {
    pub judgements: Vec<Judgement>,
    /// Positions (beats) of onsets that matched no note.
    pub extra_beats: Vec<f64>,
    pub summary: TimingSummary,
}

struct Expected {
    bar: usize,
    symbol: usize,
    beat: f64,
    /// Matching window in beats on each side.
    window: f64,
}

/// Judges onsets against an exercise as they arrive.
pub struct TimingJudge {
    notes: Vec<Expected>,
    beat_secs: f64,
    results: Vec<Option<Judgement>>,
    extra_beats: Vec<f64>,
    /// Notes before this index are all judged.
    settled: usize,
}

impl TimingJudge {
    pub fn new(exercise: &Exercise, bpm: f64) -> Self {
        let beat_secs = 60.0 / bpm;
        let bar_beats = exercise.time_signature.beats_per_bar as f64;
        let mut notes: Vec<Expected> = Vec::new();
        for (bar_index, bar) in exercise.bars.iter().enumerate() {
            for (symbol_index, s) in bar.symbols.iter().enumerate() {
                if !s.symbol.rest {
                    notes.push(Expected {
                        bar: bar_index,
                        symbol: symbol_index,
                        beat: bar_index as f64 * bar_beats
                            + s.start as f64 / SIXTEENTHS_PER_BEAT as f64,
                        window: 0.0,
                    });
                }
            }
        }
        let max_window = MAX_WINDOW_MS / 1000.0 / beat_secs;
        for i in 0..notes.len() {
            let gap_before = i
                .checked_sub(1)
                .map_or(f64::INFINITY, |p| notes[i].beat - notes[p].beat);
            let gap_after = notes
                .get(i + 1)
                .map_or(f64::INFINITY, |n| n.beat - notes[i].beat);
            notes[i].window = max_window.min(WINDOW_GAP_FRACTION * gap_before.min(gap_after));
        }
        let results = vec![None; notes.len()];
        Self {
            notes,
            beat_secs,
            results,
            extra_beats: Vec::new(),
            settled: 0,
        }
    }

    pub fn note_count(&self) -> usize {
        self.notes.len()
    }

    /// Record a played onset at `beat`. Returns the judgement if it hit a
    /// note; otherwise it is counted as an extra hit (if inside the exercise).
    pub fn onset(&mut self, beat: f64) -> Option<Judgement> {
        let nearest = (self.settled..self.notes.len())
            .filter(|&i| self.results[i].is_none())
            .filter(|&i| (beat - self.notes[i].beat).abs() <= self.notes[i].window)
            .min_by(|&a, &b| {
                let da = (beat - self.notes[a].beat).abs();
                let db = (beat - self.notes[b].beat).abs();
                da.total_cmp(&db)
            });
        let Some(i) = nearest else {
            let first = self.notes.first().map_or(0.0, |n| n.beat - n.window);
            if beat >= first {
                self.extra_beats.push(beat);
            }
            return None;
        };
        let note = &self.notes[i];
        let offset_ms = (beat - note.beat) * self.beat_secs * 1000.0;
        let result = if offset_ms.abs() <= ON_TIME_MS {
            TimingResult::OnTime
        } else if offset_ms < 0.0 {
            TimingResult::Early
        } else {
            TimingResult::Late
        };
        let judgement = Judgement {
            bar: note.bar,
            symbol: note.symbol,
            beat: note.beat,
            result,
            offset_ms: Some(offset_ms),
        };
        self.results[i] = Some(judgement);
        Some(judgement)
    }

    /// Mark notes whose window ended before `position` (beats) as missed and
    /// return them.
    pub fn advance(&mut self, position: f64) -> Vec<Judgement> {
        let mut missed = Vec::new();
        while let Some(note) = self.notes.get(self.settled) {
            if position <= note.beat + note.window {
                break;
            }
            if self.results[self.settled].is_none() {
                let j = Judgement {
                    bar: note.bar,
                    symbol: note.symbol,
                    beat: note.beat,
                    result: TimingResult::Missed,
                    offset_ms: None,
                };
                self.results[self.settled] = Some(j);
                missed.push(j);
            }
            self.settled += 1;
        }
        missed
    }

    /// Final report; any note not judged yet counts as missed.
    pub fn report(mut self) -> TimingReport {
        self.advance(f64::INFINITY);
        let judgements: Vec<Judgement> = self.results.into_iter().flatten().collect();
        let count = |r| judgements.iter().filter(|j| j.result == r).count();
        let offsets: Vec<f64> = judgements.iter().filter_map(|j| j.offset_ms).collect();
        let notes = judgements.len();
        let percent = |n: usize| {
            if notes == 0 {
                0.0
            } else {
                n as f64 * 100.0 / notes as f64
            }
        };
        let mean =
            (!offsets.is_empty()).then(|| offsets.iter().sum::<f64>() / offsets.len() as f64);
        let spread = mean.map(|m| {
            (offsets.iter().map(|o| (o - m).powi(2)).sum::<f64>() / offsets.len() as f64).sqrt()
        });
        let summary = TimingSummary {
            notes,
            on_time: count(TimingResult::OnTime),
            early: count(TimingResult::Early),
            late: count(TimingResult::Late),
            missed: count(TimingResult::Missed),
            extra: self.extra_beats.len(),
            accuracy_percent: percent(count(TimingResult::OnTime)),
            hit_percent: percent(offsets.len()),
            mean_offset_ms: mean,
            spread_ms: spread,
        };
        TimingReport {
            judgements,
            extra_beats: self.extra_beats,
            summary,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Bar, NoteValue, PlacedSymbol, Symbol, TimeSignature};

    fn sym(value: NoteValue, rest: bool, start: u32) -> PlacedSymbol {
        let symbol = Symbol {
            value,
            dotted: false,
            rest,
        };
        PlacedSymbol {
            symbol,
            start,
            duration: symbol.duration(),
        }
    }

    /// One 4/4 bar: quarter, quarter rest, eighth, eighth, quarter.
    fn exercise() -> Exercise {
        use NoteValue::*;
        Exercise {
            time_signature: TimeSignature::default(),
            bars: vec![Bar {
                symbols: vec![
                    sym(Quarter, false, 0),
                    sym(Quarter, true, 4),
                    sym(Eighth, false, 8),
                    sym(Eighth, false, 10),
                    sym(Quarter, false, 12),
                ],
            }],
        }
    }

    const BPM: f64 = 60.0; // 1 beat = 1 s, so beats = seconds

    #[test]
    fn rests_are_not_judged() {
        assert_eq!(TimingJudge::new(&exercise(), BPM).note_count(), 4);
    }

    #[test]
    fn classifies_on_time_early_late() {
        let mut j = TimingJudge::new(&exercise(), BPM);
        assert_eq!(j.onset(0.010).unwrap().result, TimingResult::OnTime);
        let early = j.onset(2.0 - 0.080).unwrap();
        assert_eq!(early.result, TimingResult::Early);
        assert!((early.offset_ms.unwrap() + 80.0).abs() < 1e-6);
        assert_eq!(j.onset(2.5 + 0.060).unwrap().result, TimingResult::Late);
        let r = j.report();
        assert_eq!(r.summary.missed, 1); // the last quarter
        assert_eq!(
            (r.summary.on_time, r.summary.early, r.summary.late),
            (1, 1, 1)
        );
        assert!((r.summary.accuracy_percent - 25.0).abs() < 1e-9);
        assert!((r.summary.hit_percent - 75.0).abs() < 1e-9);
    }

    #[test]
    fn far_or_double_hits_are_extra() {
        let mut j = TimingJudge::new(&exercise(), BPM);
        assert!(j.onset(0.0).is_some());
        assert!(j.onset(0.05).is_none(), "second hit on the same note");
        assert!(j.onset(1.0).is_none(), "played in the rest");
        let r = j.report();
        assert_eq!(r.summary.extra, 2);
        assert_eq!(r.extra_beats, vec![0.05, 1.0]);
    }

    #[test]
    fn windows_shrink_for_close_notes() {
        // Eighths 0.5 s apart at 60 BPM: window = min(150 ms, 250 ms) = 150 ms.
        // At 240 BPM sixteenths are 62.5 ms apart: window = 31.25 ms.
        let fast = Exercise {
            time_signature: TimeSignature::default(),
            bars: vec![Bar {
                symbols: (0..16)
                    .map(|k| sym(NoteValue::Sixteenth, false, k))
                    .collect(),
            }],
        };
        let mut j = TimingJudge::new(&fast, 240.0);
        // 50 ms late for note 0 is 12.5 ms early for note 1 -> hits note 1.
        let hit = j.onset(0.05 / 0.25).unwrap();
        assert_eq!(hit.symbol, 1);
    }

    #[test]
    fn advance_reports_misses_once() {
        let mut j = TimingJudge::new(&exercise(), BPM);
        assert!(j.advance(0.1).is_empty(), "window still open");
        let missed = j.advance(0.2);
        assert_eq!(missed.len(), 1);
        assert_eq!(missed[0].result, TimingResult::Missed);
        assert!(j.advance(0.3).is_empty());
        // A late onset after the note was settled is extra.
        assert!(j.onset(0.18).is_none());
    }

    #[test]
    fn mean_and_spread() {
        let mut j = TimingJudge::new(&exercise(), BPM);
        j.onset(0.020);
        j.onset(2.0 - 0.020);
        j.onset(2.5 + 0.030);
        j.onset(3.0 + 0.030);
        let s = j.report().summary;
        assert!((s.mean_offset_ms.unwrap() - 15.0).abs() < 1e-6);
        assert!(s.spread_ms.unwrap() > 15.0 && s.spread_ms.unwrap() < 25.0);
        assert_eq!(s.on_time, 4);
        assert!((s.accuracy_percent - 100.0).abs() < 1e-9);
    }

    #[test]
    fn nothing_played() {
        let s = TimingJudge::new(&exercise(), BPM).report().summary;
        assert_eq!((s.missed, s.notes), (4, 4));
        assert_eq!(s.mean_offset_ms, None);
        assert_eq!(s.hit_percent, 0.0);
    }

    #[test]
    fn json_shape() {
        let j = Judgement {
            bar: 0,
            symbol: 2,
            beat: 2.0,
            result: TimingResult::OnTime,
            offset_ms: Some(-3.0),
        };
        assert_eq!(
            serde_json::to_value(j).unwrap(),
            serde_json::json!({"bar": 0, "symbol": 2, "beat": 2.0, "result": "onTime", "offsetMs": -3.0})
        );
    }
}
