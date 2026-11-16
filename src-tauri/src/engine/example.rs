//! Theory examples played on the default output (ADR 0013): the notes one
//! after another as soft tones, at the pitch the user's instrument would
//! sound. Nothing is judged, so no input device is needed. The engine drops
//! the player once it has finished, and before any session or calibration
//! starts so it never mixes with clicks or judging.

use audio_engine::{ClickPlayer, ClickSchedule, Tone};
use theory::TheoryExample;

/// Silence before the first note, in seconds.
const LEAD_IN_SECS: f64 = 0.1;
/// Length of each note, in seconds (shorter than a pitch exercise's
/// reference so a whole scale is quick to hear).
const NOTE_SECS: f64 = 0.6;

/// The example's notes as tones, one after another.
fn tones(example: &TheoryExample) -> Vec<Tone> {
    example
        .notes
        .iter()
        .enumerate()
        .map(|(i, note)| Tone {
            start_secs: LEAD_IN_SECS + i as f64 * NOTE_SECS,
            duration_secs: NOTE_SECS,
            frequency: dsp::note::midi_to_frequency(note.midi),
        })
        .collect()
}

/// Start playing `example`; dropping the player stops it.
pub fn play(example: &TheoryExample) -> Result<ClickPlayer, String> {
    ClickPlayer::start(ClickSchedule {
        lead_in_secs: 0.0,
        interval_secs: 1.0,
        accents: Vec::new(),
        tones: tones(example),
    })
    .map_err(|e| {
        format!(
            "Could not play the notes: {e}. Check that speakers or headphones are connected \
             and set as the default output device."
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use theory::{
        ExampleRequest, Instrument, IntervalName, Letter, NoteName, ScaleKind, spell_example,
    };

    #[test]
    fn notes_play_in_turn_at_the_sounding_pitch() {
        let request = ExampleRequest::Interval {
            interval: IntervalName::PerfectFifth,
            direction: theory::Direction::Up,
            root: NoteName {
                letter: Letter::A,
                accidental: 0,
            },
        };
        let example = spell_example(&request, Instrument::Guitar).unwrap();
        let tones = tones(&example);
        assert_eq!(tones.len(), 2);
        for (tone, note) in tones.iter().zip(&example.notes) {
            let expected = dsp::note::midi_to_frequency(note.midi);
            assert!((tone.frequency - expected).abs() < 1e-3);
        }
        // Guitar sounds an octave below the written note.
        let written = example.notes[0].written.midi();
        assert_eq!(example.notes[0].midi, written - 12);
        assert!((tones[0].start_secs - LEAD_IN_SECS).abs() < 1e-9);
        assert!((tones[1].start_secs - tones[0].start_secs - NOTE_SECS).abs() < 1e-9);
    }

    #[test]
    fn a_scale_is_one_tone_per_note() {
        let request = ExampleRequest::Scale {
            scale: ScaleKind::Major,
            root: NoteName {
                letter: Letter::C,
                accidental: 0,
            },
            up_and_down: true,
        };
        let example = spell_example(&request, Instrument::KeyboardTreble).unwrap();
        assert_eq!(tones(&example).len(), 15);
    }
}
