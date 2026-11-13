//! Instruments: how their music is written (clef, transposition) and the range
//! exercises use.

use serde::{Deserialize, Serialize};

use crate::pitch::{Letter, Pitch};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Clef {
    Treble,
    Bass,
    Alto,
}

impl Clef {
    /// Bottom and top staff line, as diatonic steps (`Pitch::step`).
    pub fn staff_lines(self) -> (i32, i32) {
        let (bottom, top) = match self {
            Self::Treble => (Pitch::natural(Letter::E, 4), Pitch::natural(Letter::F, 5)),
            Self::Bass => (Pitch::natural(Letter::G, 2), Pitch::natural(Letter::A, 3)),
            Self::Alto => (Pitch::natural(Letter::F, 3), Pitch::natural(Letter::G, 4)),
        };
        (bottom.step(), top.step())
    }

    /// Steps readable without ledger lines: the staff plus the space just
    /// below and above it.
    pub fn staff_range(self) -> (i32, i32) {
        let (bottom, top) = self.staff_lines();
        (bottom - 1, top + 1)
    }
}

/// The instrument the user plays. Shared by every pitch exercise.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Instrument {
    #[default]
    Guitar,
    BassGuitar,
    KeyboardTreble,
    KeyboardBass,
    Violin,
    Viola,
    Cello,
    DoubleBass,
}

impl Instrument {
    pub const ALL: [Self; 8] = [
        Self::Guitar,
        Self::BassGuitar,
        Self::KeyboardTreble,
        Self::KeyboardBass,
        Self::Violin,
        Self::Viola,
        Self::Cello,
        Self::DoubleBass,
    ];

    pub fn clef(self) -> Clef {
        match self {
            Self::Guitar | Self::KeyboardTreble | Self::Violin => Clef::Treble,
            Self::BassGuitar | Self::KeyboardBass | Self::Cello | Self::DoubleBass => Clef::Bass,
            Self::Viola => Clef::Alto,
        }
    }

    /// Semitones from written to sounding pitch. Guitar, bass guitar and
    /// double bass sound an octave lower than written.
    pub fn transposition(self) -> i32 {
        match self {
            Self::Guitar | Self::BassGuitar | Self::DoubleBass => -12,
            _ => 0,
        }
    }

    /// Lowest and highest written note used in exercises: the low open
    /// string (or a comfortable keyboard range) up to about the first
    /// positions, as naturals.
    pub fn written_range(self) -> (Pitch, Pitch) {
        use Letter::*;
        let (low, high) = match self {
            // Sounds E2 (low E string) .. C5 (8th fret, high E string).
            Self::Guitar => ((E, 3), (C, 6)),
            // Sounds E1 .. D3 (7th fret, G string).
            Self::BassGuitar | Self::DoubleBass => ((E, 2), (D, 4)),
            Self::KeyboardTreble => ((C, 4), (C, 6)),
            Self::KeyboardBass => ((C, 2), (C, 4)),
            // Open G string .. 4th finger on the E string, first position.
            Self::Violin => ((G, 3), (B, 5)),
            Self::Viola => ((C, 3), (D, 5)),
            Self::Cello => ((C, 2), (D, 4)),
        };
        (Pitch::natural(low.0, low.1), Pitch::natural(high.0, high.1))
    }

    /// Whether `written` lies inside `written_range` (by sound, so B#/Cb
    /// edge cases are handled by their actual pitch).
    pub fn in_range(self, written: Pitch) -> bool {
        let (low, high) = self.written_range();
        (low.midi()..=high.midi()).contains(&written.midi())
    }

    /// The MIDI note that sounds when `written` is played.
    pub fn sounding(self, written: Pitch) -> i32 {
        written.midi() + self.transposition()
    }

    /// The written note for a sounding `midi`, spelled with sharps (to name
    /// a note the user played).
    pub fn written_for(self, midi: i32) -> Pitch {
        Pitch::from_midi(midi - self.transposition())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guitar_sounds_an_octave_lower() {
        let g = Instrument::Guitar;
        let (low, _) = g.written_range();
        assert_eq!(g.sounding(low), 40, "low E string = E2");
        assert_eq!(g.written_for(40), low);
        assert_eq!(
            Instrument::KeyboardTreble.sounding(Pitch::natural(Letter::C, 4)),
            60
        );
        assert_eq!(
            Instrument::BassGuitar.sounding(Instrument::BassGuitar.written_range().0),
            28
        );
    }

    #[test]
    fn ranges_reach_the_staff() {
        for instrument in Instrument::ALL {
            let (low, high) = instrument.written_range();
            let (bottom, top) = instrument.clef().staff_lines();
            assert!(low.step() <= bottom && high.step() >= top, "{instrument:?}");
        }
    }

    #[test]
    fn staff_lines() {
        let (bottom, top) = Clef::Treble.staff_lines();
        assert_eq!(top - bottom, 8, "five lines span eight steps");
        assert_eq!(
            Clef::Alto.staff_lines().0 + 4,
            Pitch::natural(Letter::C, 4).step()
        );
    }

    #[test]
    fn range_check_uses_the_sound() {
        let g = Instrument::Guitar;
        assert!(g.in_range(Pitch::natural(Letter::E, 3)));
        assert!(
            !g.in_range(Pitch::new(Letter::E, -1, 3)),
            "below the low string"
        );
        assert!(g.in_range(Pitch::new(Letter::F, 1, 3)));
    }
}
