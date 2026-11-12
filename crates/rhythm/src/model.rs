use serde::{Deserialize, Serialize};

/// Sixteenths in one beat (the beat is a quarter note).
pub const SIXTEENTHS_PER_BEAT: u32 = 4;
/// Allowed exercise length in bars.
pub const MIN_BARS: u32 = 1;
pub const MAX_BARS: u32 = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NoteValue {
    Whole,
    Half,
    Quarter,
    Eighth,
    Sixteenth,
}

impl NoteValue {
    pub const ALL: [Self; 5] = [
        Self::Whole,
        Self::Half,
        Self::Quarter,
        Self::Eighth,
        Self::Sixteenth,
    ];

    pub fn sixteenths(self) -> u32 {
        match self {
            Self::Whole => 16,
            Self::Half => 8,
            Self::Quarter => 4,
            Self::Eighth => 2,
            Self::Sixteenth => 1,
        }
    }
}

/// A note or rest of some length.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Symbol {
    pub value: NoteValue,
    /// Dotted = 1.5x the length. Never on a sixteenth (would need 32nds).
    pub dotted: bool,
    pub rest: bool,
}

impl Symbol {
    pub fn duration(&self) -> u32 {
        let base = self.value.sixteenths();
        if self.dotted { base * 3 / 2 } else { base }
    }

    pub fn is_valid(&self) -> bool {
        !(self.dotted && self.value == NoteValue::Sixteenth)
    }
}

/// `beats_per_bar`/4. Supported: 2/4, 3/4, 4/4.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSignature {
    pub beats_per_bar: u32,
}

impl TimeSignature {
    pub const SUPPORTED_BEATS: [u32; 3] = [2, 3, 4];

    pub fn new(beats_per_bar: u32) -> Result<Self, RhythmError> {
        if Self::SUPPORTED_BEATS.contains(&beats_per_bar) {
            Ok(Self { beats_per_bar })
        } else {
            Err(RhythmError::UnsupportedTimeSignature(beats_per_bar))
        }
    }

    pub fn bar_sixteenths(&self) -> u32 {
        self.beats_per_bar * SIXTEENTHS_PER_BEAT
    }
}

impl Default for TimeSignature {
    fn default() -> Self {
        Self { beats_per_bar: 4 }
    }
}

/// Which symbols an exercise may contain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RhythmOptions {
    pub values: Vec<NoteValue>,
    /// Also use dotted versions of the selected values.
    pub dotted: bool,
    /// Also use rests of the selected values.
    pub rests: bool,
}

impl RhythmOptions {
    /// Every symbol allowed by these options (notes, plus dotted and rest
    /// variants), deduplicated and in a fixed order.
    pub fn symbols(&self) -> Vec<Symbol> {
        let mut out = Vec::new();
        for value in NoteValue::ALL {
            if !self.values.contains(&value) {
                continue;
            }
            for rest in [false, true] {
                for dotted in [false, true] {
                    let s = Symbol {
                        value,
                        dotted,
                        rest,
                    };
                    if s.is_valid() && (!dotted || self.dotted) && (!rest || self.rests) {
                        out.push(s);
                    }
                }
            }
        }
        out
    }
}

/// How a custom exercise is made.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CustomMode {
    /// Randomly generated from the selected note values.
    #[default]
    Random,
    /// Written note by note by the user.
    Written,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Difficulty {
    /// Whole, half and quarter notes.
    #[default]
    Easy,
    /// Adds eighth and sixteenth notes.
    Medium,
    /// Every value, dotted values and rests.
    Hard,
    /// The user's own selection.
    Custom,
}

impl Difficulty {
    /// The options of a preset, or `None` for `Custom`.
    pub fn preset(self) -> Option<RhythmOptions> {
        use NoteValue::*;
        match self {
            Self::Easy => Some(RhythmOptions {
                values: vec![Whole, Half, Quarter],
                dotted: false,
                rests: false,
            }),
            Self::Medium => Some(RhythmOptions {
                values: NoteValue::ALL.to_vec(),
                dotted: false,
                rests: false,
            }),
            Self::Hard => Some(RhythmOptions {
                values: NoteValue::ALL.to_vec(),
                dotted: true,
                rests: true,
            }),
            Self::Custom => None,
        }
    }
}

/// A symbol at a position within its bar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacedSymbol {
    #[serde(flatten)]
    pub symbol: Symbol,
    /// Start in sixteenths from the start of the bar.
    pub start: u32,
    /// Length in sixteenths (`symbol.duration()`, included for the UI).
    pub duration: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bar {
    pub symbols: Vec<PlacedSymbol>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Exercise {
    pub time_signature: TimeSignature,
    pub bars: Vec<Bar>,
}

impl Exercise {
    pub fn total_beats(&self) -> u32 {
        self.bars.len() as u32 * self.time_signature.beats_per_bar
    }

    /// Shortest distance between the starts of two consecutive played notes
    /// (rests in between count towards the distance), in beats. `None` with
    /// fewer than two notes.
    pub fn min_note_gap_beats(&self) -> Option<f64> {
        let bar_len = self.time_signature.bar_sixteenths();
        let starts: Vec<u32> = self
            .bars
            .iter()
            .enumerate()
            .flat_map(|(b, bar)| {
                bar.symbols
                    .iter()
                    .filter(|s| !s.symbol.rest)
                    .map(move |s| b as u32 * bar_len + s.start)
            })
            .collect();
        starts
            .windows(2)
            .map(|w| w[1] - w[0])
            .min()
            .map(|gap| gap as f64 / SIXTEENTHS_PER_BEAT as f64)
    }

    /// Check an exercise received from outside (e.g. the UI): supported
    /// time signature, bar count in range, and every bar filled exactly by
    /// consecutive valid symbols.
    pub fn validate(&self) -> Result<(), RhythmError> {
        TimeSignature::new(self.time_signature.beats_per_bar)?;
        let bars = self.bars.len() as u32;
        if !(MIN_BARS..=MAX_BARS).contains(&bars) {
            return Err(RhythmError::InvalidBars(bars));
        }
        let bar_len = self.time_signature.bar_sixteenths();
        for (index, bar) in self.bars.iter().enumerate() {
            let mut pos = 0;
            for placed in &bar.symbols {
                if !placed.symbol.is_valid()
                    || placed.start != pos
                    || placed.duration != placed.symbol.duration()
                {
                    return Err(RhythmError::MalformedBar(index));
                }
                pos += placed.duration;
            }
            if pos != bar_len {
                return Err(RhythmError::MalformedBar(index));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RhythmError {
    #[error("the number of bars must be between {MIN_BARS} and {MAX_BARS}, got {0}")]
    InvalidBars(u32),
    #[error("{0}/4 time is not supported (use 2/4, 3/4 or 4/4)")]
    UnsupportedTimeSignature(u32),
    #[error("select at least one note value")]
    NoNoteValues,
    #[error("the selected note values cannot fill a bar of this time signature")]
    CannotFillBar,
    #[error("bar {0} is malformed")]
    MalformedBar(usize),
    #[error("symbol {} does not fit in its bar (it would cross the bar line)", .0 + 1)]
    DoesNotFit(usize),
    #[error("symbol {} is not a valid note length", .0 + 1)]
    InvalidSymbol(usize),
}

#[cfg(test)]
mod tests {
    use super::*;
    use NoteValue::*;

    #[test]
    fn durations() {
        let s = |value, dotted| Symbol {
            value,
            dotted,
            rest: false,
        };
        assert_eq!(s(Whole, false).duration(), 16);
        assert_eq!(s(Half, true).duration(), 12);
        assert_eq!(s(Quarter, true).duration(), 6);
        assert_eq!(s(Eighth, true).duration(), 3);
        assert!(!s(Sixteenth, true).is_valid());
    }

    #[test]
    fn presets() {
        let easy = Difficulty::Easy.preset().unwrap();
        assert_eq!(easy.values, vec![Whole, Half, Quarter]);
        assert!(!easy.dotted && !easy.rests);
        let medium = Difficulty::Medium.preset().unwrap();
        assert!(medium.values.contains(&Eighth) && medium.values.contains(&Sixteenth));
        assert!(!medium.dotted && !medium.rests);
        let hard = Difficulty::Hard.preset().unwrap();
        assert_eq!(hard.values.len(), 5);
        assert!(hard.dotted && hard.rests);
        assert!(Difficulty::Custom.preset().is_none());
    }

    #[test]
    fn hard_symbols_cover_every_length_except_dotted_sixteenth() {
        let symbols = Difficulty::Hard.preset().unwrap().symbols();
        // 5 notes + 4 dotted notes, and the same as rests.
        assert_eq!(symbols.len(), 18);
        assert!(symbols.iter().all(Symbol::is_valid));
    }

    #[test]
    fn min_note_gap() {
        let placed = |value, rest, start| {
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
        };
        let exercise = |symbols: Vec<PlacedSymbol>| Exercise {
            time_signature: TimeSignature::default(),
            bars: vec![Bar { symbols }],
        };
        // half, eighth, sixteenth rest, sixteenth, quarter
        let e = exercise(vec![
            placed(Half, false, 0),
            placed(Eighth, false, 8),
            placed(Sixteenth, true, 10),
            placed(Sixteenth, false, 11),
            placed(Quarter, false, 12),
        ]);
        assert_eq!(e.min_note_gap_beats(), Some(0.25)); // 11 -> 12
        let single = exercise(vec![placed(Whole, false, 0)]);
        assert_eq!(single.min_note_gap_beats(), None);
        // Across a bar line: quarter at beat 3 of bar 1, then bar 2 beat 1.
        let two = Exercise {
            time_signature: TimeSignature::default(),
            bars: vec![
                Bar {
                    symbols: vec![
                        placed(Half, true, 0),
                        placed(Quarter, true, 8),
                        placed(Quarter, false, 12),
                    ],
                },
                Bar {
                    symbols: vec![placed(Whole, false, 0)],
                },
            ],
        };
        assert_eq!(two.min_note_gap_beats(), Some(1.0));
    }

    #[test]
    fn time_signatures() {
        assert_eq!(TimeSignature::new(3).unwrap().bar_sixteenths(), 12);
        assert_eq!(
            TimeSignature::new(5),
            Err(RhythmError::UnsupportedTimeSignature(5))
        );
    }

    #[test]
    fn json_shape() {
        let placed = PlacedSymbol {
            symbol: Symbol {
                value: Eighth,
                dotted: true,
                rest: false,
            },
            start: 0,
            duration: 3,
        };
        assert_eq!(
            serde_json::to_value(placed).unwrap(),
            serde_json::json!({"value": "eighth", "dotted": true, "rest": false, "start": 0, "duration": 3})
        );
        assert_eq!(
            serde_json::to_value(TimeSignature::default()).unwrap(),
            serde_json::json!({"beatsPerBar": 4})
        );
        assert_eq!(
            serde_json::to_value(Difficulty::Custom).unwrap(),
            serde_json::json!("custom")
        );
    }
}
