//! User-written rhythms: a plain sequence of symbols laid out into bars
//! (ADR 0009). Bars fill in order; a symbol may not cross a bar line.

use serde::Serialize;

use crate::model::{Bar, Exercise, MAX_BARS, PlacedSymbol, RhythmError, Symbol, TimeSignature};

/// Most symbols a written rhythm may hold (64 bars of 4/4 sixteenths).
pub const MAX_WRITTEN_SYMBOLS: usize = 1024;

/// A written rhythm laid out into bars. The last bar may be incomplete
/// while the user is still writing.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseDraft {
    pub exercise: Exercise,
    /// Sixteenths still missing in the last bar (0 = every bar is full).
    pub remaining: u32,
    /// True when the exercise can be played: at least one bar, all full,
    /// and at least one note (not only rests).
    pub complete: bool,
    /// `Exercise::min_note_gap_beats`, for tempo-dependent accuracy warnings.
    pub min_note_gap_beats: Option<f64>,
}

impl ExerciseDraft {
    /// A finished, generated exercise.
    pub fn from_complete(exercise: Exercise) -> Self {
        Self {
            min_note_gap_beats: exercise.min_note_gap_beats(),
            exercise,
            remaining: 0,
            complete: true,
        }
    }
}

/// Lay `symbols` out into bars of `time_signature`.
///
/// Fails with `DoesNotFit(index)` if a symbol would cross a bar line,
/// `InvalidSymbol(index)` for a dotted sixteenth, and `InvalidBars` if the
/// rhythm needs more than `MAX_BARS` bars.
pub fn layout(
    symbols: &[Symbol],
    time_signature: TimeSignature,
) -> Result<ExerciseDraft, RhythmError> {
    let time_signature = TimeSignature::new(time_signature.beats_per_bar)?;
    let bar_len = time_signature.bar_sixteenths();
    let mut bars: Vec<Bar> = Vec::new();
    let mut pos = bar_len; // forces a new bar for the first symbol

    for (index, symbol) in symbols.iter().enumerate() {
        if !symbol.is_valid() {
            return Err(RhythmError::InvalidSymbol(index));
        }
        let duration = symbol.duration();
        if pos == bar_len {
            bars.push(Bar {
                symbols: Vec::new(),
            });
            pos = 0;
        }
        if pos + duration > bar_len {
            return Err(RhythmError::DoesNotFit(index));
        }
        if let Some(bar) = bars.last_mut() {
            bar.symbols.push(PlacedSymbol {
                symbol: *symbol,
                start: pos,
                duration,
            });
        }
        pos += duration;
    }
    if bars.len() as u32 > MAX_BARS {
        return Err(RhythmError::InvalidBars(bars.len() as u32));
    }

    let remaining = if bars.is_empty() {
        bar_len
    } else {
        bar_len - pos
    };
    let has_note = symbols.iter().any(|s| !s.rest);
    let exercise = Exercise {
        time_signature,
        bars,
    };
    Ok(ExerciseDraft {
        complete: !exercise.bars.is_empty() && remaining == 0 && has_note,
        min_note_gap_beats: exercise.min_note_gap_beats(),
        remaining,
        exercise,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::NoteValue::*;
    use crate::model::{NoteValue, SIXTEENTHS_PER_BEAT};

    fn note(value: NoteValue) -> Symbol {
        Symbol {
            value,
            dotted: false,
            rest: false,
        }
    }

    fn rest(value: NoteValue) -> Symbol {
        Symbol {
            rest: true,
            ..note(value)
        }
    }

    fn ts(beats: u32) -> TimeSignature {
        TimeSignature::new(beats).unwrap()
    }

    #[test]
    fn empty_is_incomplete() {
        let d = layout(&[], ts(4)).unwrap();
        assert!(d.exercise.bars.is_empty());
        assert!(!d.complete);
        assert_eq!(d.remaining, 16);
    }

    #[test]
    fn fills_bars_in_order() {
        let symbols = [
            note(Half),
            note(Quarter),
            rest(Quarter),
            note(Whole),
            note(Eighth),
        ];
        let d = layout(&symbols, ts(4)).unwrap();
        assert_eq!(d.exercise.bars.len(), 3);
        assert_eq!(d.exercise.bars[0].symbols.len(), 3);
        assert_eq!(d.exercise.bars[0].symbols[2].start, 12);
        assert_eq!(d.exercise.bars[2].symbols[0].start, 0);
        assert_eq!(d.remaining, 14);
        assert!(!d.complete);
    }

    #[test]
    fn complete_rhythm_validates() {
        let dotted = Symbol {
            dotted: true,
            ..note(Quarter)
        };
        let d = layout(&[dotted, note(Eighth), note(Half)], ts(4)).unwrap();
        assert!(d.complete);
        assert_eq!(d.remaining, 0);
        d.exercise.validate().unwrap();
        assert_eq!(d.exercise.total_beats(), 4);
    }

    #[test]
    fn rejects_crossing_a_bar_line() {
        // 3/4: half + half would cross the bar line.
        assert_eq!(
            layout(&[note(Half), note(Half)], ts(3)),
            Err(RhythmError::DoesNotFit(1))
        );
        assert_eq!(
            layout(&[note(Whole)], ts(3)),
            Err(RhythmError::DoesNotFit(0))
        );
    }

    #[test]
    fn rests_only_is_not_playable() {
        let d = layout(&[rest(Whole)], ts(4)).unwrap();
        assert_eq!(d.remaining, 0);
        assert!(!d.complete);
    }

    #[test]
    fn rejects_dotted_sixteenth_and_too_many_bars() {
        let bad = Symbol {
            dotted: true,
            ..note(Sixteenth)
        };
        assert_eq!(layout(&[bad], ts(4)), Err(RhythmError::InvalidSymbol(0)));
        let many = vec![note(Half); (MAX_BARS as usize + 1) * 2];
        assert!(matches!(
            layout(&many, ts(4)),
            Err(RhythmError::InvalidBars(_))
        ));
        assert_eq!(SIXTEENTHS_PER_BEAT, 4);
    }

    #[test]
    fn json_shape() {
        let d = layout(&[note(Quarter)], ts(2)).unwrap();
        let v = serde_json::to_value(&d).unwrap();
        assert_eq!(v["remaining"], 4);
        assert_eq!(v["complete"], false);
        assert_eq!(v["exercise"]["timeSignature"]["beatsPerBar"], 2);
        assert!(v["minNoteGapBeats"].is_null());
    }
}
