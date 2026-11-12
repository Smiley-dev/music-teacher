use serde::Serialize;

const NOTE_NAMES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/// The nearest equal-tempered note to a frequency (A4 = 440 Hz).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    /// Note name without octave, e.g. "A" or "C#".
    pub name: &'static str,
    /// Scientific pitch octave (middle C = C4).
    pub octave: i32,
    /// MIDI note number (A4 = 69).
    pub midi: i32,
    /// Deviation from the exact note frequency, -50..=+50 cents.
    pub cents: f32,
}

impl Note {
    pub const A4_HZ: f32 = 440.0;

    pub fn from_frequency(frequency: f32) -> Option<Self> {
        if !(frequency.is_finite() && frequency > 0.0) {
            return None;
        }
        let midi_exact = 69.0 + 12.0 * (frequency / Self::A4_HZ).log2();
        let midi = midi_exact.round();
        let cents = (midi_exact - midi) * 100.0;
        let midi = midi as i32;
        Some(Self {
            name: NOTE_NAMES[midi.rem_euclid(12) as usize],
            octave: midi.div_euclid(12) - 1,
            midi,
            cents,
        })
    }

    /// Exact frequency of this note (ignoring `cents`).
    pub fn frequency(&self) -> f32 {
        midi_to_frequency(self.midi)
    }
}

/// Exact equal-tempered frequency of a MIDI note.
pub fn midi_to_frequency(midi: i32) -> f32 {
    Note::A4_HZ * 2f32.powf((midi - 69) as f32 / 12.0)
}

/// Cents between `frequency` and the exact frequency of `midi`
/// (positive = sharp).
pub fn cents_from(frequency: f32, midi: i32) -> f32 {
    1200.0 * (frequency / midi_to_frequency(midi)).log2()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a4() {
        let n = Note::from_frequency(440.0).unwrap();
        assert_eq!((n.name, n.octave, n.midi), ("A", 4, 69));
        assert!(n.cents.abs() < 0.01);
    }

    #[test]
    fn guitar_and_bass_strings() {
        for (hz, name, octave) in [
            (41.20, "E", 1), // bass low E
            (82.41, "E", 2), // guitar low E
            (110.0, "A", 2),
            (146.83, "D", 3),
            (196.0, "G", 3),
            (246.94, "B", 3),
            (329.63, "E", 4), // guitar high E
            (261.63, "C", 4), // middle C
        ] {
            let n = Note::from_frequency(hz).unwrap();
            assert_eq!((n.name, n.octave), (name, octave), "{hz} Hz");
            assert!(n.cents.abs() < 1.0, "{hz} Hz is {} cents off", n.cents);
        }
    }

    #[test]
    fn cents_sign() {
        let sharp = Note::from_frequency(445.0).unwrap();
        assert_eq!(sharp.name, "A");
        assert!(sharp.cents > 15.0 && sharp.cents < 25.0);
        let flat = Note::from_frequency(435.0).unwrap();
        assert_eq!(flat.name, "A");
        assert!(flat.cents < -15.0 && flat.cents > -25.0);
    }

    #[test]
    fn cents_from_exact_note() {
        assert!(cents_from(440.0, 69).abs() < 0.01);
        assert!((cents_from(880.0, 69) - 1200.0).abs() < 0.01);
        assert!((cents_from(midi_to_frequency(40), 40)).abs() < 0.01);
        assert!((midi_to_frequency(40) - 82.41).abs() < 0.01); // E2
    }

    #[test]
    fn rejects_invalid() {
        assert!(Note::from_frequency(0.0).is_none());
        assert!(Note::from_frequency(f32::NAN).is_none());
    }
}
