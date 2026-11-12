//! Exercise generation: fill each bar exactly with a randomized,
//! memoized backtracking search under readability rules.

use crate::model::{
    Bar, Exercise, MAX_BARS, MIN_BARS, PlacedSymbol, RhythmError, RhythmOptions,
    SIXTEENTHS_PER_BEAT, Symbol, TimeSignature,
};
use crate::rng::Rng;

/// Relative chance of picking a plain note, a dotted value and a rest.
const NOTE_WEIGHT: f64 = 1.0;
const DOTTED_WEIGHT: f64 = 0.5;
const REST_WEIGHT: f64 = 0.35;

fn weight(s: &Symbol) -> f64 {
    let mut w = NOTE_WEIGHT;
    if s.dotted {
        w *= DOTTED_WEIGHT;
    }
    if s.rest {
        w *= REST_WEIGHT;
    }
    w
}

/// Readability rules for placing `s` at sixteenth `pos` of a bar:
/// - a beat or longer starts on a beat;
/// - shorter values stay inside one beat;
/// - undotted short values sit on their own grid (eighths on eighths).
fn fits(s: &Symbol, pos: u32, bar_len: u32) -> bool {
    let dur = s.duration();
    if pos + dur > bar_len {
        return false;
    }
    if dur >= SIXTEENTHS_PER_BEAT {
        return pos.is_multiple_of(SIXTEENTHS_PER_BEAT);
    }
    let same_beat = pos / SIXTEENTHS_PER_BEAT == (pos + dur - 1) / SIXTEENTHS_PER_BEAT;
    same_beat && (s.dotted || pos.is_multiple_of(dur))
}

struct BarFiller<'a> {
    symbols: &'a [Symbol],
    bar_len: u32,
    /// `dead[pos][has_note]`: no completion exists from this state.
    dead: Vec<[bool; 2]>,
}

impl BarFiller<'_> {
    fn fill(
        &mut self,
        pos: u32,
        has_note: bool,
        rng: &mut Rng,
        out: &mut Vec<PlacedSymbol>,
    ) -> bool {
        if pos == self.bar_len {
            return has_note; // never a bar of only rests
        }
        if self.dead[pos as usize][has_note as usize] {
            return false;
        }
        // Weighted random order (Efraimidis–Spirakis keys).
        let mut candidates: Vec<(f64, Symbol)> = self
            .symbols
            .iter()
            .filter(|s| fits(s, pos, self.bar_len))
            .map(|s| (rng.next_unit().powf(1.0 / weight(s)), *s))
            .collect();
        candidates.sort_by(|a, b| b.0.total_cmp(&a.0));

        for (_, symbol) in candidates {
            let duration = symbol.duration();
            out.push(PlacedSymbol {
                symbol,
                start: pos,
                duration,
            });
            if self.fill(pos + duration, has_note || !symbol.rest, rng, out) {
                return true;
            }
            out.pop();
        }
        self.dead[pos as usize][has_note as usize] = true;
        false
    }
}

/// Generate `bars` bars of rhythm. The same inputs and `seed` always give
/// the same exercise.
pub fn generate(
    options: &RhythmOptions,
    time_signature: TimeSignature,
    bars: u32,
    seed: u64,
) -> Result<Exercise, RhythmError> {
    let time_signature = TimeSignature::new(time_signature.beats_per_bar)?;
    if !(MIN_BARS..=MAX_BARS).contains(&bars) {
        return Err(RhythmError::InvalidBars(bars));
    }
    if options.values.is_empty() {
        return Err(RhythmError::NoNoteValues);
    }
    let bar_len = time_signature.bar_sixteenths();
    let symbols: Vec<Symbol> = options
        .symbols()
        .into_iter()
        .filter(|s| s.duration() <= bar_len)
        .collect();

    let mut filler = BarFiller {
        symbols: &symbols,
        bar_len,
        dead: vec![[false; 2]; bar_len as usize + 1],
    };
    let mut rng = Rng::new(seed);
    let mut out = Vec::with_capacity(bars as usize);
    for _ in 0..bars {
        let mut bar = Vec::new();
        if !filler.fill(0, false, &mut rng, &mut bar) {
            return Err(RhythmError::CannotFillBar);
        }
        out.push(Bar { symbols: bar });
    }
    Ok(Exercise {
        time_signature,
        bars: out,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Difficulty, NoteValue::*};

    fn ts(beats: u32) -> TimeSignature {
        TimeSignature::new(beats).unwrap()
    }

    fn preset(d: Difficulty) -> RhythmOptions {
        d.preset().unwrap()
    }

    fn all_symbols(e: &Exercise) -> impl Iterator<Item = &PlacedSymbol> {
        e.bars.iter().flat_map(|b| b.symbols.iter())
    }

    #[test]
    fn bars_are_filled_exactly_and_follow_placement_rules() {
        for difficulty in [Difficulty::Easy, Difficulty::Medium, Difficulty::Hard] {
            for beats in TimeSignature::SUPPORTED_BEATS {
                for seed in 0..50 {
                    let e = generate(&preset(difficulty), ts(beats), 8, seed).unwrap();
                    assert_eq!(e.bars.len(), 8);
                    e.validate().unwrap();
                    for bar in &e.bars {
                        assert!(bar.symbols.iter().any(|s| !s.symbol.rest), "all-rest bar");
                        for s in &bar.symbols {
                            assert!(fits(&s.symbol, s.start, beats * 4), "{s:?} in {beats}/4");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn easy_uses_only_whole_half_quarter() {
        let e = generate(&preset(Difficulty::Easy), ts(4), 64, 7).unwrap();
        assert!(all_symbols(&e).all(|s| {
            [Whole, Half, Quarter].contains(&s.symbol.value) && !s.symbol.dotted && !s.symbol.rest
        }));
    }

    #[test]
    fn medium_adds_eighths_and_sixteenths() {
        let e = generate(&preset(Difficulty::Medium), ts(4), 64, 7).unwrap();
        assert!(all_symbols(&e).any(|s| s.symbol.value == Eighth));
        assert!(all_symbols(&e).any(|s| s.symbol.value == Sixteenth));
        assert!(all_symbols(&e).all(|s| !s.symbol.dotted && !s.symbol.rest));
    }

    #[test]
    fn hard_uses_dotted_values_and_rests() {
        let e = generate(&preset(Difficulty::Hard), ts(4), 64, 7).unwrap();
        assert!(all_symbols(&e).any(|s| s.symbol.dotted));
        assert!(all_symbols(&e).any(|s| s.symbol.rest));
        assert!(all_symbols(&e).any(|s| s.symbol.rest && s.symbol.dotted));
    }

    #[test]
    fn whole_notes_only_in_four_four() {
        for beats in [2, 3] {
            let e = generate(&preset(Difficulty::Hard), ts(beats), 64, 3).unwrap();
            assert!(all_symbols(&e).all(|s| s.duration <= beats * 4));
        }
    }

    #[test]
    fn deterministic_per_seed() {
        let o = preset(Difficulty::Hard);
        assert_eq!(
            generate(&o, ts(4), 16, 42).unwrap(),
            generate(&o, ts(4), 16, 42).unwrap()
        );
        assert_ne!(
            generate(&o, ts(4), 16, 42).unwrap(),
            generate(&o, ts(4), 16, 43).unwrap()
        );
    }

    #[test]
    fn custom_selection() {
        let only_eighths = RhythmOptions {
            values: vec![Eighth],
            dotted: false,
            rests: true,
        };
        let e = generate(&only_eighths, ts(3), 16, 1).unwrap();
        assert!(all_symbols(&e).all(|s| s.symbol.value == Eighth));
        assert!(e.bars.iter().all(|b| b.symbols.len() == 6));
    }

    #[test]
    fn errors() {
        let easy = preset(Difficulty::Easy);
        assert_eq!(
            generate(&easy, ts(4), 0, 1),
            Err(RhythmError::InvalidBars(0))
        );
        assert_eq!(
            generate(&easy, ts(4), 65, 1),
            Err(RhythmError::InvalidBars(65))
        );
        assert_eq!(
            generate(&easy, TimeSignature { beats_per_bar: 5 }, 4, 1),
            Err(RhythmError::UnsupportedTimeSignature(5))
        );
        let none = RhythmOptions {
            values: vec![],
            dotted: true,
            rests: true,
        };
        assert_eq!(generate(&none, ts(4), 4, 1), Err(RhythmError::NoNoteValues));
        let halves = RhythmOptions {
            values: vec![Half],
            dotted: false,
            rests: false,
        };
        assert_eq!(
            generate(&halves, ts(3), 4, 1),
            Err(RhythmError::CannotFillBar)
        );
        assert!(generate(&halves, ts(4), 4, 1).is_ok());
        // Dotted halves fill 3/4 exactly.
        let dotted_halves = RhythmOptions {
            dotted: true,
            ..halves
        };
        assert!(generate(&dotted_halves, ts(3), 4, 1).is_ok());
    }

    #[test]
    fn validate_rejects_tampered_exercise() {
        let mut e = generate(&preset(Difficulty::Medium), ts(4), 4, 9).unwrap();
        e.bars[2].symbols.pop();
        assert_eq!(e.validate(), Err(RhythmError::MalformedBar(2)));
    }
}
