//! Spelled pitches: letter, accidental and octave, as written on a staff.

use std::fmt;

use serde::{Deserialize, Serialize};

/// A note letter, C to B.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Letter {
    C,
    D,
    E,
    F,
    G,
    A,
    B,
}

impl Letter {
    pub const ALL: [Self; 7] = [
        Self::C,
        Self::D,
        Self::E,
        Self::F,
        Self::G,
        Self::A,
        Self::B,
    ];

    /// Semitones of the natural note above C.
    pub fn semitones(self) -> i32 {
        [0, 2, 4, 5, 7, 9, 11][self as usize]
    }

    fn symbol(self) -> char {
        ['C', 'D', 'E', 'F', 'G', 'A', 'B'][self as usize]
    }
}

/// A written note in scientific pitch notation (middle C = C4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pitch {
    pub letter: Letter,
    /// In semitones: -2 double flat, -1 flat, 0 natural, 1 sharp, 2 double
    /// sharp.
    pub accidental: i8,
    pub octave: i8,
}

/// How each pitch class is named when spelled with sharps.
const SHARP_SPELLING: [(Letter, i8); 12] = [
    (Letter::C, 0),
    (Letter::C, 1),
    (Letter::D, 0),
    (Letter::D, 1),
    (Letter::E, 0),
    (Letter::F, 0),
    (Letter::F, 1),
    (Letter::G, 0),
    (Letter::G, 1),
    (Letter::A, 0),
    (Letter::A, 1),
    (Letter::B, 0),
];

impl Pitch {
    pub const fn new(letter: Letter, accidental: i8, octave: i8) -> Self {
        Self {
            letter,
            accidental,
            octave,
        }
    }

    pub const fn natural(letter: Letter, octave: i8) -> Self {
        Self::new(letter, 0, octave)
    }

    /// MIDI note number (A4 = 69, middle C = 60).
    pub fn midi(self) -> i32 {
        (self.octave as i32 + 1) * 12 + self.letter.semitones() + self.accidental as i32
    }

    /// Diatonic position, 7 per octave (C0 = 0). Pitches with the same step
    /// sit on the same staff line or space, whatever their accidental.
    pub fn step(self) -> i32 {
        self.octave as i32 * 7 + self.letter as i32
    }

    /// The natural note at diatonic `step`.
    pub fn natural_at(step: i32) -> Self {
        Self::natural(
            Letter::ALL[step.rem_euclid(7) as usize],
            step.div_euclid(7) as i8,
        )
    }

    /// `midi` spelled with sharps (C, C#, D …): how a heard note is named.
    pub fn from_midi(midi: i32) -> Self {
        let (letter, accidental) = SHARP_SPELLING[midi.rem_euclid(12) as usize];
        Self::new(letter, accidental, (midi.div_euclid(12) - 1) as i8)
    }

    /// `midi` spelled with flats (C, Db, D …), as for a melody going down.
    pub fn from_midi_flat(midi: i32) -> Self {
        let sharp = Self::from_midi(midi);
        if sharp.accidental == 0 {
            return sharp;
        }
        let up = Self::natural_at(sharp.step() + 1);
        Self {
            accidental: (midi - up.midi()) as i8,
            ..up
        }
    }

    /// Move `steps` letters and `semitones` (both negative = down), spelled
    /// correctly: C4 moved by a major third (2 steps, 4 semitones) is E4,
    /// never F♭4. `None` if that would need more than a double accidental.
    pub fn transpose(self, steps: i32, semitones: i32) -> Option<Self> {
        let natural = Self::natural_at(self.step() + steps);
        let accidental = self.midi() + semitones - natural.midi();
        (accidental.abs() <= 2).then_some(Self {
            accidental: accidental as i8,
            ..natural
        })
    }

    /// Needs a double sharp or double flat.
    pub fn is_double(self) -> bool {
        self.accidental.abs() > 1
    }
}

impl fmt::Display for Pitch {
    /// ASCII spelling: `C#4`, `Bb3`, `F##4`, `Ebb5`.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let accidental = match self.accidental {
            -2 => "bb",
            -1 => "b",
            1 => "#",
            2 => "##",
            _ => "",
        };
        write!(f, "{}{accidental}{}", self.letter.symbol(), self.octave)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Letter::*;

    #[test]
    fn midi_numbers() {
        assert_eq!(Pitch::natural(C, 4).midi(), 60);
        assert_eq!(Pitch::natural(A, 4).midi(), 69);
        assert_eq!(Pitch::natural(E, 2).midi(), 40);
        assert_eq!(Pitch::new(B, 1, 3).midi(), 60, "B#3 = C4");
        assert_eq!(Pitch::new(C, -1, 4).midi(), 59, "Cb4 = B3");
    }

    #[test]
    fn steps_and_naturals() {
        let e4 = Pitch::natural(E, 4);
        assert_eq!(e4.step(), 30);
        assert_eq!(Pitch::natural_at(30), e4);
        assert_eq!(Pitch::natural_at(e4.step() - 3), Pitch::natural(B, 3));
        assert_eq!(Pitch::new(F, 1, 4).step(), Pitch::natural(F, 4).step());
    }

    #[test]
    fn transposition_keeps_spelling() {
        let c4 = Pitch::natural(C, 4);
        assert_eq!(c4.transpose(2, 4), Some(Pitch::natural(E, 4)));
        assert_eq!(c4.transpose(2, 3), Some(Pitch::new(E, -1, 4)));
        assert_eq!(c4.transpose(-2, -4), Some(Pitch::new(A, -1, 3)));
        let fs = Pitch::new(F, 1, 4);
        assert_eq!(fs.transpose(2, 4), Some(Pitch::new(A, 1, 4)));
        let b = Pitch::natural(B, 3);
        assert_eq!(b.transpose(1, 2), Some(Pitch::new(C, 1, 4)));
        // G# + major 7th = F## (double sharp).
        let gs = Pitch::new(G, 1, 3);
        let fx = gs.transpose(6, 11).unwrap();
        assert_eq!(fx, Pitch::new(F, 2, 4));
        assert!(fx.is_double());
        assert_eq!(Pitch::new(C, -2, 4).transpose(0, -1), None);
    }

    #[test]
    fn heard_notes_are_spelled_with_sharps() {
        assert_eq!(Pitch::from_midi(61), Pitch::new(C, 1, 4));
        assert_eq!(Pitch::from_midi(40), Pitch::natural(E, 2));
        assert_eq!(Pitch::from_midi(70).to_string(), "A#4");
        assert_eq!(Pitch::from_midi_flat(70).to_string(), "Bb4");
        assert_eq!(Pitch::from_midi_flat(61).to_string(), "Db4");
        assert_eq!(Pitch::from_midi_flat(64).to_string(), "E4");
        for midi in 40..90 {
            assert_eq!(Pitch::from_midi_flat(midi).midi(), midi);
        }
    }

    #[test]
    fn display_and_json() {
        assert_eq!(Pitch::new(B, -1, 3).to_string(), "Bb3");
        assert_eq!(Pitch::new(F, 2, 4).to_string(), "F##4");
        assert_eq!(
            serde_json::to_value(Pitch::new(C, 1, 4)).unwrap(),
            serde_json::json!({"letter": "c", "accidental": 1, "octave": 4})
        );
    }
}
