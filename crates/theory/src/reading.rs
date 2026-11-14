//! Sight reading: a short melody in standard notation to play from the page.
//! The rhythm comes from `rhythm::generate`; the pitches walk over a scale
//! with the chosen interval sizes, starting on the tonic and ending on it
//! when possible (ADR 0012).

use rhythm::{Difficulty, Exercise, MIN_BARS, NoteValue, RhythmOptions, TimeSignature};
use serde::{Deserialize, Serialize};

use crate::exercise::TheoryError;
use crate::instrument::{Clef, Instrument};
use crate::key::{KeySignature, MAX_KEY_ACCIDENTALS};
use crate::pitch::{Letter, Pitch};
use crate::rng::Rng;
use crate::scale::ScaleKind;
use crate::task::name_like;

/// Longest melody, in bars.
pub const MAX_READING_BARS: u32 = 16;
/// Melodies tried before giving up: a walk can get stuck at the edge of the
/// range when only a few interval sizes are allowed.
const MAX_ATTEMPTS: u32 = 50;

/// Distance between two neighbouring notes, counted in letters (C–E is a
/// third, whether major or minor).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IntervalSize {
    /// The same note again.
    Unison,
    Second,
    Third,
    Fourth,
    Fifth,
    Sixth,
    Seventh,
    Octave,
}

impl IntervalSize {
    pub const ALL: [Self; 8] = [
        Self::Unison,
        Self::Second,
        Self::Third,
        Self::Fourth,
        Self::Fifth,
        Self::Sixth,
        Self::Seventh,
        Self::Octave,
    ];

    /// Letter steps: 0 (unison) to 7 (octave).
    pub fn steps(self) -> i32 {
        self as i32
    }
}

/// Sight reading choices (saved in settings).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReadingOptions {
    /// Scales (and modes) melodies are written in.
    pub scales: Vec<ScaleKind>,
    /// Most sharps or flats in the key signature (0 = C major and its
    /// modes only).
    pub max_accidentals: u8,
    /// Allowed distances between neighbouring notes.
    pub intervals: Vec<IntervalSize>,
    /// Note and rest lengths.
    pub rhythm: RhythmOptions,
    pub time_signature: TimeSignature,
    pub bars: u32,
    /// Notes on ledger lines (up to the instrument's range), not only the
    /// staff.
    pub ledger_lines: bool,
}

impl Default for ReadingOptions {
    fn default() -> Self {
        Self {
            scales: vec![ScaleKind::Major],
            max_accidentals: 1,
            intervals: vec![IntervalSize::Second, IntervalSize::Third],
            rhythm: Difficulty::Easy.preset().unwrap_or(RhythmOptions {
                values: vec![NoteValue::Quarter],
                dotted: false,
                rests: false,
            }),
            time_signature: TimeSignature::default(),
            bars: 4,
            ledger_lines: false,
        }
    }
}

/// A played note of the melody: where it is in the rhythm, and its pitch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingNote {
    pub bar: usize,
    /// Index of the (non-rest) symbol within its bar.
    pub symbol: usize,
    /// As written for the instrument.
    pub written: Pitch,
    /// Sounding MIDI note to play.
    pub midi: i32,
}

/// A melody to read and play.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingExercise {
    pub rhythm: Exercise,
    pub clef: Clef,
    pub key: KeySignature,
    /// What the melody is in, e.g. D dorian.
    pub scale: ScaleKind,
    /// The scale's root (its octave means nothing).
    pub root: Pitch,
    /// Every played note in order; rests have none.
    pub notes: Vec<ReadingNote>,
}

impl ReadingExercise {
    /// Check an exercise received from outside (the UI): a valid rhythm and
    /// one pitch per played note, in order.
    pub fn validate(&self) -> Result<(), TheoryError> {
        self.rhythm.validate()?;
        let slots = played_slots(&self.rhythm);
        let matches = slots.len() == self.notes.len()
            && slots.iter().zip(&self.notes).all(|(&(bar, symbol), n)| {
                n.bar == bar
                    && n.symbol == symbol
                    && (0..128).contains(&n.midi)
                    && (n.midi - n.written.midi()).rem_euclid(12) == 0
            });
        if matches {
            Ok(())
        } else {
            Err(TheoryError::Malformed)
        }
    }

    /// Sounding MIDI notes, in order.
    pub fn midi_notes(&self) -> Vec<i32> {
        self.notes.iter().map(|n| n.midi).collect()
    }

    /// How to name a played (sounding) note: as written, spelled like the
    /// melody's note of the same name if there is one, otherwise with sharps.
    pub fn name_of(&self, midi: i32) -> Pitch {
        name_like(self.notes.iter().map(|n| (n.written, n.midi)), midi)
    }
}

/// (bar, symbol) of every played (non-rest) symbol, in order.
fn played_slots(rhythm: &Exercise) -> Vec<(usize, usize)> {
    rhythm
        .bars
        .iter()
        .enumerate()
        .flat_map(|(b, bar)| {
            bar.symbols
                .iter()
                .enumerate()
                .filter(|(_, s)| !s.symbol.rest)
                .map(move |(i, _)| (b, i))
        })
        .collect()
}

/// The scale's notes inside the reading range, low to high.
fn scale_pool(
    scale: ScaleKind,
    root: Pitch,
    instrument: Instrument,
    ledger_lines: bool,
) -> Vec<Pitch> {
    let (low, high) = instrument.written_range();
    let (mut from, mut to) = (low.step(), high.step());
    if !ledger_lines {
        let (bottom, top) = instrument.clef().staff_range();
        from = from.max(bottom);
        to = to.min(top);
    }
    let base = Pitch { octave: 4, ..root };
    let degrees = std::iter::once(&(0, 0)).chain(scale.degrees());
    let mut pool: Vec<Pitch> = (-5..=5)
        .flat_map(|octave| {
            degrees
                .clone()
                .filter_map(move |&(s, t)| base.transpose(s + 7 * octave, t + 12 * octave))
        })
        .filter(|p| !p.is_double() && (from..=to).contains(&p.step()) && instrument.in_range(*p))
        .collect();
    pool.sort_by_key(|p| p.midi());
    pool.dedup();
    pool
}

/// A melody of `length` notes over `pool`: starts on a tonic, moves by the
/// allowed sizes (each size equally likely), ends on a tonic if it can.
fn walk(
    pool: &[Pitch],
    root: Pitch,
    length: usize,
    sizes: &[IntervalSize],
    rng: &mut Rng,
) -> Option<Vec<Pitch>> {
    let is_tonic = |p: &Pitch| (p.midi() - root.midi()).rem_euclid(12) == 0;
    let tonics: Vec<usize> = (0..pool.len()).filter(|&i| is_tonic(&pool[i])).collect();
    let mut at = *rng.pick(&tonics)?;
    let mut melody = vec![pool[at]];
    while melody.len() < length {
        let by_size: Vec<Vec<usize>> = sizes
            .iter()
            .map(|size| {
                (0..pool.len())
                    .filter(|&j| {
                        let distance = (pool[j].step() - pool[at].step()).abs();
                        distance == size.steps() && (size.steps() > 0 || j == at)
                    })
                    .collect::<Vec<usize>>()
            })
            .filter(|c| !c.is_empty())
            .collect();
        let last = melody.len() + 1 == length;
        let to_tonic: Vec<usize> = by_size
            .iter()
            .flatten()
            .copied()
            .filter(|&j| is_tonic(&pool[j]))
            .collect();
        at = if last && !to_tonic.is_empty() {
            *rng.pick(&to_tonic)?
        } else {
            let group = rng.pick(&by_size)?;
            *rng.pick(group)?
        };
        melody.push(pool[at]);
    }
    Some(melody)
}

/// Roots a key can start on: naturals, sharps and flats, never E♯, B♯, C♭
/// or F♭.
fn roots() -> Vec<Pitch> {
    Letter::ALL
        .iter()
        .flat_map(|&letter| [-1, 0, 1].map(|a| Pitch::new(letter, a, 4)))
        .filter(|p| {
            !matches!(
                (p.letter, p.accidental),
                (Letter::E | Letter::B, 1) | (Letter::C | Letter::F, -1)
            )
        })
        .collect()
}

/// A key a melody can be in: scale, root, signature and the notes in range.
type KeyChoice = (ScaleKind, Pitch, KeySignature, Vec<Pitch>);

/// A new random melody for `instrument`. Deterministic for a given `seed`.
pub fn generate_reading(
    options: &ReadingOptions,
    instrument: Instrument,
    seed: u64,
) -> Result<ReadingExercise, TheoryError> {
    if options.scales.is_empty() {
        return Err(TheoryError::NothingSelected("scale"));
    }
    if options.intervals.is_empty() {
        return Err(TheoryError::NothingSelected("interval"));
    }
    let mut rng = Rng::new(seed);
    let bars = options.bars.clamp(MIN_BARS, MAX_READING_BARS);
    let rhythm = rhythm::generate(
        &options.rhythm,
        options.time_signature,
        bars,
        rng.next_u64(),
    )?;
    let slots = played_slots(&rhythm);
    let max_accidentals = options.max_accidentals.min(MAX_KEY_ACCIDENTALS) as i8;

    // Keys (scale + root) that fit the options, grouped by scale so each
    // selected scale is equally likely.
    let by_scale: Vec<Vec<KeyChoice>> = options
        .scales
        .iter()
        .map(|&scale| {
            roots()
                .into_iter()
                .filter_map(|root| {
                    let key = KeySignature::of(scale, root)?;
                    if key.accidentals.abs() > max_accidentals {
                        return None;
                    }
                    scale.notes(root, false)?;
                    let pool = scale_pool(scale, root, instrument, options.ledger_lines);
                    (pool.len() >= 3).then_some((scale, root, key, pool))
                })
                .collect::<Vec<_>>()
        })
        .filter(|keys| !keys.is_empty())
        .collect();
    if by_scale.is_empty() {
        return Err(TheoryError::OutOfRange("key"));
    }
    for _ in 0..MAX_ATTEMPTS {
        let keys = &by_scale[rng.below(by_scale.len())];
        let (scale, root, key, pool) = &keys[rng.below(keys.len())];
        let Some(melody) = walk(pool, *root, slots.len(), &options.intervals, &mut rng) else {
            continue;
        };
        let notes = slots
            .iter()
            .zip(melody)
            .map(|(&(bar, symbol), written)| ReadingNote {
                bar,
                symbol,
                written,
                midi: instrument.sounding(written),
            })
            .collect();
        return Ok(ReadingExercise {
            rhythm,
            clef: instrument.clef(),
            key: *key,
            scale: *scale,
            root: *root,
            notes,
        });
    }
    Err(TheoryError::OutOfRange("melody"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> ReadingOptions {
        ReadingOptions::default()
    }

    #[test]
    fn default_melodies_for_every_instrument() {
        for instrument in Instrument::ALL {
            for seed in 0..20 {
                let e = generate_reading(&options(), instrument, seed).unwrap();
                e.validate().unwrap();
                assert_eq!(e.clef, instrument.clef());
                assert!(e.key.accidentals.abs() <= 1);
                assert_eq!(e.notes.len(), played_slots(&e.rhythm).len());
                let first = e.notes[0].written;
                assert_eq!(
                    (first.midi() - e.root.midi()).rem_euclid(12),
                    0,
                    "starts on the tonic"
                );
                let (bottom, top) = instrument.clef().staff_range();
                for n in &e.notes {
                    assert!((bottom..=top).contains(&n.written.step()), "on the staff");
                    assert_eq!(n.midi, instrument.sounding(n.written));
                }
                for w in e.notes.windows(2) {
                    let d = (w[1].written.step() - w[0].written.step()).abs();
                    assert!(d == 1 || d == 2, "2nds and 3rds only: {w:?}");
                }
            }
        }
    }

    #[test]
    fn same_seed_same_melody() {
        let a = generate_reading(&options(), Instrument::Violin, 9).unwrap();
        let b = generate_reading(&options(), Instrument::Violin, 9).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn notes_belong_to_the_scale() {
        let opts = ReadingOptions {
            scales: vec![ScaleKind::HarmonicMinor, ScaleKind::Dorian],
            max_accidentals: 3,
            intervals: IntervalSize::ALL.to_vec(),
            ledger_lines: true,
            bars: 8,
            ..options()
        };
        for seed in 0..30 {
            let e = generate_reading(&opts, Instrument::Guitar, seed).unwrap();
            let scale = e.scale.notes(e.root, false).unwrap();
            for n in &e.notes {
                assert!(
                    scale
                        .iter()
                        .any(|s| s.letter == n.written.letter
                            && s.accidental == n.written.accidental),
                    "{} not in {} {:?}",
                    n.written,
                    e.root,
                    e.scale
                );
                assert!(Instrument::Guitar.in_range(n.written));
            }
        }
    }

    #[test]
    fn no_accidentals_means_c_major_and_its_modes() {
        let opts = ReadingOptions {
            scales: vec![ScaleKind::Major, ScaleKind::Dorian],
            max_accidentals: 0,
            ..options()
        };
        for seed in 0..20 {
            let e = generate_reading(&opts, Instrument::KeyboardTreble, seed).unwrap();
            assert_eq!(e.key.accidentals, 0);
            let root = e.root.to_string();
            assert!(root == "C4" || root == "D4", "{root}");
            assert!(e.notes.iter().all(|n| n.written.accidental == 0));
        }
    }

    #[test]
    fn octaves_only_still_works() {
        let opts = ReadingOptions {
            intervals: vec![IntervalSize::Octave],
            ..options()
        };
        let e = generate_reading(&opts, Instrument::KeyboardTreble, 1).unwrap();
        for w in e.notes.windows(2) {
            assert_eq!((w[1].midi - w[0].midi).abs(), 12);
        }
    }

    #[test]
    fn errors_and_validation() {
        let none = ReadingOptions {
            intervals: vec![],
            ..options()
        };
        assert_eq!(
            generate_reading(&none, Instrument::Guitar, 1),
            Err(TheoryError::NothingSelected("interval"))
        );
        let mut e = generate_reading(&options(), Instrument::Guitar, 2).unwrap();
        e.notes.pop();
        assert_eq!(e.validate(), Err(TheoryError::Malformed));
        let no_values = ReadingOptions {
            rhythm: RhythmOptions {
                values: vec![],
                dotted: false,
                rests: false,
            },
            ..options()
        };
        assert!(matches!(
            generate_reading(&no_values, Instrument::Guitar, 1),
            Err(TheoryError::Rhythm(_))
        ));
    }
}
