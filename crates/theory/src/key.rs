//! Key signatures: which sharps or flats a scale is written with.

use serde::{Deserialize, Serialize};

use crate::pitch::Pitch;
use crate::scale::ScaleKind;

/// Most sharps or flats in a key signature.
pub const MAX_KEY_ACCIDENTALS: u8 = 7;

/// A key signature, named by the major key that uses it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySignature {
    /// Tonic of the major key with this signature (its octave means
    /// nothing), e.g. B♭ for two flats.
    pub major: Pitch,
    /// Number of sharps (> 0) or flats (< 0).
    pub accidentals: i8,
}

impl KeySignature {
    /// The signature `scale` on `root` is written with: that of its parent
    /// major (D dorian → C major, A minor → C major). Harmonic and melodic
    /// minor use the natural minor's signature; their raised notes are
    /// written as accidentals. `None` for keys beyond seven sharps or flats.
    pub fn of(scale: ScaleKind, root: Pitch) -> Option<Self> {
        let (steps, semitones) = match scale {
            ScaleKind::Major | ScaleKind::MajorPentatonic => (0, 0),
            ScaleKind::NaturalMinor
            | ScaleKind::HarmonicMinor
            | ScaleKind::MelodicMinor
            | ScaleKind::MinorPentatonic => (2, 3),
            ScaleKind::Dorian => (-1, -2),
            ScaleKind::Phrygian => (-2, -4),
            ScaleKind::Lydian => (-3, -5),
            ScaleKind::Mixolydian => (-4, -7),
            ScaleKind::Locrian => (1, 1),
        };
        let major = root.transpose(steps, semitones)?;
        let notes = ScaleKind::Major.notes(major, false)?;
        let sharps = notes[..7].iter().filter(|p| p.accidental == 1).count() as i8;
        let flats = notes[..7].iter().filter(|p| p.accidental == -1).count() as i8;
        if sharps > 0 && flats > 0 {
            return None;
        }
        Some(Self {
            major: Pitch { octave: 4, ..major },
            accidentals: sharps - flats,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::Letter;

    fn sig(scale: ScaleKind, letter: Letter, accidental: i8) -> (String, i8) {
        let k = KeySignature::of(scale, Pitch::new(letter, accidental, 4)).unwrap();
        (k.major.to_string(), k.accidentals)
    }

    #[test]
    fn major_keys() {
        use Letter::*;
        assert_eq!(sig(ScaleKind::Major, C, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::Major, G, 0), ("G4".into(), 1));
        assert_eq!(sig(ScaleKind::Major, F, 0), ("F4".into(), -1));
        assert_eq!(sig(ScaleKind::Major, B, -1), ("Bb4".into(), -2));
        assert_eq!(sig(ScaleKind::Major, F, 1), ("F#4".into(), 6));
        assert_eq!(sig(ScaleKind::Major, C, 1), ("C#4".into(), 7));
    }

    #[test]
    fn minors_and_modes_use_the_parent_major() {
        use Letter::*;
        assert_eq!(sig(ScaleKind::NaturalMinor, A, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::HarmonicMinor, E, 0), ("G4".into(), 1));
        assert_eq!(sig(ScaleKind::MinorPentatonic, D, 0), ("F4".into(), -1));
        assert_eq!(sig(ScaleKind::Dorian, D, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::Phrygian, E, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::Lydian, F, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::Mixolydian, G, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::Locrian, B, 0), ("C4".into(), 0));
        assert_eq!(sig(ScaleKind::Dorian, E, 0), ("D4".into(), 2));
    }

    #[test]
    fn beyond_seven_accidentals() {
        // G# major would need F double sharp.
        let k = KeySignature::of(ScaleKind::Major, Pitch::new(Letter::G, 1, 4));
        assert_eq!(k, None);
    }
}
