//! Theory examples: an interval, scale or chord spelled on a chosen root and
//! placed on the instrument's staff, for the Theory section to draw and play
//! (ADR 0013). Unlike the exercises, double sharps and flats are allowed, so
//! every root can be shown (G♯ major has F𝄪).

use std::ops::RangeInclusive;

use serde::{Deserialize, Serialize};

use crate::chord::ChordKind;
use crate::exercise::TheoryError;
use crate::instrument::{Clef, Instrument};
use crate::interval::{Direction, IntervalName};
use crate::key::KeySignature;
use crate::pitch::{Letter, Pitch};
use crate::scale::ScaleKind;

/// Octaves tried for an example's root when placing it on the staff.
const ROOT_OCTAVES: RangeInclusive<i8> = 1..=6;

/// A note name without octave, such as E♭: the root of an example.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteName {
    pub letter: Letter,
    /// -1 flat, 0 natural, 1 sharp.
    pub accidental: i8,
}

impl NoteName {
    fn in_octave(self, octave: i8) -> Pitch {
        Pitch::new(self.letter, self.accidental, octave)
    }
}

/// What to spell.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ExampleRequest {
    /// Two notes: `root`, then the note `interval` up or down from it.
    Interval {
        interval: IntervalName,
        direction: Direction,
        root: NoteName,
    },
    /// The scale from `root` up to its octave (and back down with
    /// `up_and_down`).
    Scale {
        scale: ScaleKind,
        root: NoteName,
        up_and_down: bool,
    },
    /// The chord's notes from the lowest up; `inversion` 0 is root
    /// position, 1 starts on the 3rd, 2 on the 5th, 3 on the 7th.
    Chord {
        chord: ChordKind,
        root: NoteName,
        inversion: u8,
    },
}

impl ExampleRequest {
    fn root(&self) -> NoteName {
        match *self {
            Self::Interval { root, .. } | Self::Scale { root, .. } | Self::Chord { root, .. } => {
                root
            }
        }
    }

    fn validate(&self) -> Result<(), TheoryError> {
        if self.root().accidental.abs() > 1 {
            return Err(TheoryError::Invalid(
                "The root must be a natural, sharp or flat.",
            ));
        }
        if let Self::Chord {
            chord, inversion, ..
        } = *self
            && inversion as usize >= chord.tones().len()
        {
            return Err(TheoryError::Invalid("This chord has no such inversion."));
        }
        Ok(())
    }

    /// The notes with the root in `octave`; `None` if they cannot be spelled.
    fn notes(&self, octave: i8) -> Option<Vec<Pitch>> {
        match *self {
            Self::Interval {
                interval,
                direction,
                root,
            } => {
                let root = root.in_octave(octave);
                let (steps, semitones) = interval.size();
                let sign = match direction {
                    Direction::Up => 1,
                    Direction::Down => -1,
                };
                Some(vec![root, root.transpose(sign * steps, sign * semitones)?])
            }
            Self::Scale {
                scale,
                root,
                up_and_down,
            } => scale.spell(root.in_octave(octave), up_and_down),
            Self::Chord {
                chord,
                root,
                inversion,
            } => chord.spell(root.in_octave(octave), inversion as usize),
        }
    }
}

/// A degree compared with the same degree of the major scale: ♭3 is
/// `{ number: 3, alteration: -1 }`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Degree {
    /// 1 to 7, counted in letters from the root (its octave is 1 again).
    pub number: u8,
    /// Half steps away from that degree of the major scale.
    pub alteration: i8,
}

impl Degree {
    fn of(note: Pitch, root: Pitch) -> Self {
        let steps = note.step() - root.step();
        Self {
            number: (steps.rem_euclid(7) + 1) as u8,
            alteration: (note.midi() - root.midi() - major_semitones(steps)) as i8,
        }
    }
}

/// Half steps from the root to the major scale's note `steps` letters up.
fn major_semitones(steps: i32) -> i32 {
    let degree = steps.rem_euclid(7) as usize;
    let within = match degree {
        0 => 0,
        d => ScaleKind::Major.degrees()[d - 1].1,
    };
    within + 12 * steps.div_euclid(7)
}

/// One note of an example.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExampleNote {
    pub written: Pitch,
    /// The MIDI note that sounds when it is played on the instrument.
    pub midi: i32,
    /// Its degree from the root; `None` in an interval (named by the
    /// request instead).
    pub degree: Option<Degree>,
    /// Letters from the previous note (negative = down; 0 for the first).
    pub steps: i32,
    /// Half steps from the previous note (negative = down; 0 for the
    /// first).
    pub semitones: i32,
}

/// An interval, scale or chord ready to draw and play.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TheoryExample {
    pub clef: Clef,
    pub notes: Vec<ExampleNote>,
    /// The key signature a scale is written with (its parent major's, ADR
    /// 0012); `None` for intervals and chords, and for keys beyond seven
    /// sharps or flats.
    pub key: Option<KeySignature>,
}

/// Spell `request` and place it on `instrument`'s staff. Of the octaves the
/// root could be in, the one that keeps every note in the instrument's
/// range wins, then the one with the fewest ledger lines, then the one
/// nearest the middle of the staff (the lower one on a tie).
pub fn spell_example(
    request: &ExampleRequest,
    instrument: Instrument,
) -> Result<TheoryExample, TheoryError> {
    request.validate()?;
    let (octave, pitches) = ROOT_OCTAVES
        .filter_map(|octave| Some((octave, request.notes(octave)?)))
        .min_by_key(|(_, pitches)| placement_cost(pitches, instrument))
        .ok_or(TheoryError::Unspellable)?;
    let root = request.root().in_octave(octave);
    let with_degrees = !matches!(request, ExampleRequest::Interval { .. });
    let notes = pitches
        .iter()
        .enumerate()
        .map(|(i, &written)| {
            let previous = if i == 0 { written } else { pitches[i - 1] };
            ExampleNote {
                written,
                midi: instrument.sounding(written),
                degree: with_degrees.then(|| Degree::of(written, root)),
                steps: written.step() - previous.step(),
                semitones: written.midi() - previous.midi(),
            }
        })
        .collect();
    let key = match *request {
        ExampleRequest::Scale { scale, .. } => KeySignature::of(scale, root),
        _ => None,
    };
    Ok(TheoryExample {
        clef: instrument.clef(),
        notes,
        key,
    })
}

/// Lower is better: notes outside the instrument's range, then letter steps
/// beyond the staff (ledger lines), then how far the notes' centre is from
/// the middle line.
fn placement_cost(notes: &[Pitch], instrument: Instrument) -> (usize, i32, i32) {
    let clef = instrument.clef();
    let (low, high) = clef.staff_range();
    let (bottom, top) = clef.staff_lines();
    let outside = notes.iter().filter(|p| !instrument.in_range(**p)).count();
    let ledger = notes
        .iter()
        .map(|p| (low - p.step()).max(0) + (p.step() - high).max(0))
        .sum();
    // Twice each note's distance from the middle line, so it stays whole.
    let centre = notes
        .iter()
        .map(|p| 2 * p.step() - (bottom + top))
        .sum::<i32>()
        .abs();
    (outside, ledger, centre)
}

#[cfg(test)]
mod tests {
    use super::*;
    use Letter::*;

    fn name(letter: Letter, accidental: i8) -> NoteName {
        NoteName { letter, accidental }
    }

    fn scale(scale: ScaleKind, root: NoteName, up_and_down: bool) -> ExampleRequest {
        ExampleRequest::Scale {
            scale,
            root,
            up_and_down,
        }
    }

    fn chord(chord: ChordKind, root: NoteName, inversion: u8) -> ExampleRequest {
        ExampleRequest::Chord {
            chord,
            root,
            inversion,
        }
    }

    fn interval(interval: IntervalName, direction: Direction, root: NoteName) -> ExampleRequest {
        ExampleRequest::Interval {
            interval,
            direction,
            root,
        }
    }

    fn written(e: &TheoryExample) -> Vec<String> {
        e.notes.iter().map(|n| n.written.to_string()).collect()
    }

    fn degrees(e: &TheoryExample) -> Vec<(u8, i8)> {
        e.notes
            .iter()
            .map(|n| {
                let d = n.degree.unwrap();
                (d.number, d.alteration)
            })
            .collect()
    }

    #[test]
    fn major_scale_on_the_treble_staff() {
        let e = spell_example(
            &scale(ScaleKind::Major, name(C, 0), false),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(e.clef, Clef::Treble);
        assert_eq!(
            written(&e),
            ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
        );
        let half_steps: Vec<i32> = e.notes.iter().map(|n| n.semitones).collect();
        assert_eq!(half_steps, [0, 2, 2, 1, 2, 2, 2, 1]);
        let letters: Vec<i32> = e.notes.iter().map(|n| n.steps).collect();
        assert_eq!(letters, [0, 1, 1, 1, 1, 1, 1, 1]);
        assert_eq!(
            degrees(&e),
            [
                (1, 0),
                (2, 0),
                (3, 0),
                (4, 0),
                (5, 0),
                (6, 0),
                (7, 0),
                (1, 0)
            ],
            "the octave is degree 1 again"
        );
        assert_eq!(
            e.key,
            Some(KeySignature {
                major: Pitch::natural(C, 4),
                accidentals: 0
            })
        );
    }

    #[test]
    fn minor_scale_degrees_and_key() {
        let e = spell_example(
            &scale(ScaleKind::NaturalMinor, name(E, -1), false),
            Instrument::Violin,
        )
        .unwrap();
        assert_eq!(
            written(&e),
            ["Eb4", "F4", "Gb4", "Ab4", "Bb4", "Cb5", "Db5", "Eb5"]
        );
        assert_eq!(
            degrees(&e),
            [
                (1, 0),
                (2, 0),
                (3, -1),
                (4, 0),
                (5, 0),
                (6, -1),
                (7, -1),
                (1, 0)
            ]
        );
        let key = e.key.unwrap();
        assert_eq!(
            (key.major.to_string(), key.accidentals),
            ("Gb4".into(), -6),
            "relative major G♭: six flats"
        );
    }

    #[test]
    fn melodic_minor_comes_down_as_natural_minor() {
        let e = spell_example(
            &scale(ScaleKind::MelodicMinor, name(A, 0), true),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(
            written(&e),
            [
                "A4", "B4", "C5", "D5", "E5", "F#5", "G#5", "A5", "G5", "F5", "E5", "D5", "C5",
                "B4", "A4"
            ]
        );
        assert_eq!(e.notes[8].semitones, -2, "G♯ is not used going down");
    }

    #[test]
    fn double_sharps_are_shown() {
        let e = spell_example(
            &scale(ScaleKind::Major, name(G, 1), false),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(e.notes[6].written.to_string(), "F##5");
        assert_eq!(e.key, None, "beyond seven sharps");
    }

    #[test]
    fn chords_from_the_lowest_note() {
        let first = spell_example(
            &chord(ChordKind::Major, name(C, 0), 1),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(written(&first), ["E4", "G4", "C5"]);
        assert_eq!(degrees(&first), [(3, 0), (5, 0), (1, 0)]);
        assert_eq!(first.key, None);

        let dim7 = spell_example(
            &chord(ChordKind::Diminished7, name(B, 0), 0),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(written(&dim7), ["B4", "D5", "F5", "Ab5"]);
        assert_eq!(degrees(&dim7), [(1, 0), (3, -1), (5, -1), (7, -2)]);
        let half_steps: Vec<i32> = dim7.notes.iter().map(|n| n.semitones).collect();
        assert_eq!(half_steps, [0, 3, 3, 3]);

        let third = spell_example(
            &chord(ChordKind::Dominant7, name(C, 0), 3),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(written(&third), ["Bb4", "C5", "E5", "G5"]);
        assert_eq!(degrees(&third), [(7, -1), (1, 0), (3, 0), (5, 0)]);
    }

    #[test]
    fn intervals_up_and_down() {
        let up = spell_example(
            &interval(IntervalName::MajorThird, Direction::Up, name(E, -1)),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(written(&up), ["Eb4", "G4"]);
        assert_eq!((up.notes[1].steps, up.notes[1].semitones), (2, 4));
        assert!(up.notes.iter().all(|n| n.degree.is_none()));

        let down = spell_example(
            &interval(IntervalName::MinorSixth, Direction::Down, name(C, 1)),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(written(&down), ["C#5", "E#4"]);
        assert_eq!((down.notes[1].steps, down.notes[1].semitones), (-5, -8));

        let tritone = spell_example(
            &interval(IntervalName::Tritone, Direction::Up, name(C, 0)),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(
            written(&tritone),
            ["C5", "F#5"],
            "an augmented 4th, without ledger lines"
        );
    }

    #[test]
    fn placed_and_sounding_for_the_instrument() {
        let c_major = scale(ScaleKind::Major, name(C, 0), false);
        let bass = spell_example(&c_major, Instrument::BassGuitar).unwrap();
        assert_eq!(bass.clef, Clef::Bass);
        assert_eq!(bass.notes[0].written.to_string(), "C3");
        assert_eq!(bass.notes[0].midi, 36, "bass guitar sounds an octave lower");

        let guitar = spell_example(&c_major, Instrument::Guitar).unwrap();
        assert_eq!(guitar.notes[0].written.to_string(), "C4");
        assert_eq!(guitar.notes[0].midi, 48);

        let viola = spell_example(&c_major, Instrument::Viola).unwrap();
        assert_eq!(viola.clef, Clef::Alto);
        assert!(
            viola
                .notes
                .iter()
                .all(|n| Instrument::Viola.in_range(n.written))
        );
    }

    #[test]
    fn rejects_requests_that_do_not_exist() {
        let g = Instrument::Guitar;
        assert!(matches!(
            spell_example(&scale(ScaleKind::Major, name(C, 2), false), g),
            Err(TheoryError::Invalid(_))
        ));
        assert!(matches!(
            spell_example(&chord(ChordKind::Major, name(C, 0), 3), g),
            Err(TheoryError::Invalid(_))
        ));
        assert!(spell_example(&chord(ChordKind::Minor7, name(C, 0), 3), g).is_ok());
    }

    #[test]
    fn json_shapes() {
        let parsed: ExampleRequest = serde_json::from_value(serde_json::json!({
            "kind": "scale",
            "scale": "harmonicMinor",
            "root": {"letter": "a", "accidental": 0},
            "upAndDown": true
        }))
        .unwrap();
        assert_eq!(parsed, scale(ScaleKind::HarmonicMinor, name(A, 0), true));
        let parsed: ExampleRequest = serde_json::from_value(serde_json::json!({
            "kind": "chord",
            "chord": "dominant7",
            "root": {"letter": "g", "accidental": 0},
            "inversion": 1
        }))
        .unwrap();
        assert_eq!(parsed, chord(ChordKind::Dominant7, name(G, 0), 1));
        let parsed: ExampleRequest = serde_json::from_value(serde_json::json!({
            "kind": "interval",
            "interval": "perfectFifth",
            "direction": "down",
            "root": {"letter": "b", "accidental": -1}
        }))
        .unwrap();
        assert_eq!(
            parsed,
            interval(IntervalName::PerfectFifth, Direction::Down, name(B, -1))
        );

        let e = spell_example(
            &interval(IntervalName::MajorThird, Direction::Up, name(E, -1)),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({
                "clef": "treble",
                "notes": [
                    {
                        "written": {"letter": "e", "accidental": -1, "octave": 4},
                        "midi": 63, "degree": null, "steps": 0, "semitones": 0
                    },
                    {
                        "written": {"letter": "g", "accidental": 0, "octave": 4},
                        "midi": 67, "degree": null, "steps": 2, "semitones": 4
                    }
                ],
                "key": null
            })
        );
        let s = spell_example(
            &scale(ScaleKind::Dorian, name(D, 0), false),
            Instrument::KeyboardTreble,
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(s.notes[2].degree).unwrap(),
            serde_json::json!({"number": 3, "alteration": -1})
        );
        assert_eq!(
            serde_json::to_value(s.key).unwrap(),
            serde_json::json!({"major": {"letter": "c", "accidental": 0, "octave": 4}, "accidentals": 0})
        );
    }
}
