//! Intervals: the first note is shown with an interval name; play both notes.

use serde::{Deserialize, Serialize};

use crate::exercise::{TheoryError, rings_on};
use crate::instrument::Instrument;
use crate::notes::{NoteReadingOptions, note_pool};
use crate::rng::Rng;
use crate::task::{Matching, PitchTask, Prompt};

/// Simple intervals up to an octave. The tritone is spelled as an augmented
/// fourth (C–F♯; F♯–C going down).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IntervalName {
    MinorSecond,
    MajorSecond,
    MinorThird,
    MajorThird,
    PerfectFourth,
    Tritone,
    PerfectFifth,
    MinorSixth,
    MajorSixth,
    MinorSeventh,
    MajorSeventh,
    Octave,
}

impl IntervalName {
    pub const ALL: [Self; 12] = [
        Self::MinorSecond,
        Self::MajorSecond,
        Self::MinorThird,
        Self::MajorThird,
        Self::PerfectFourth,
        Self::Tritone,
        Self::PerfectFifth,
        Self::MinorSixth,
        Self::MajorSixth,
        Self::MinorSeventh,
        Self::MajorSeventh,
        Self::Octave,
    ];

    /// Size as (letter steps, semitones).
    pub fn size(self) -> (i32, i32) {
        match self {
            Self::MinorSecond => (1, 1),
            Self::MajorSecond => (1, 2),
            Self::MinorThird => (2, 3),
            Self::MajorThird => (2, 4),
            Self::PerfectFourth => (3, 5),
            Self::Tritone => (3, 6),
            Self::PerfectFifth => (4, 7),
            Self::MinorSixth => (5, 8),
            Self::MajorSixth => (5, 9),
            Self::MinorSeventh => (6, 10),
            Self::MajorSeventh => (6, 11),
            Self::Octave => (7, 12),
        }
    }
}

/// Which way the second note goes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Up,
    Down,
}

/// Directions to practise.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Directions {
    #[default]
    Up,
    Down,
    Both,
}

impl Directions {
    fn list(self) -> &'static [Direction] {
        match self {
            Self::Up => &[Direction::Up],
            Self::Down => &[Direction::Down],
            Self::Both => &[Direction::Up, Direction::Down],
        }
    }
}

/// Interval choices (saved in settings).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct IntervalOptions {
    pub intervals: Vec<IntervalName>,
    pub directions: Directions,
    /// Show the second note too (reading practice) instead of working it out.
    pub show_both: bool,
}

impl Default for IntervalOptions {
    fn default() -> Self {
        Self {
            intervals: vec![
                IntervalName::MajorSecond,
                IntervalName::MinorThird,
                IntervalName::MajorThird,
                IntervalName::PerfectFourth,
                IntervalName::PerfectFifth,
                IntervalName::Octave,
            ],
            directions: Directions::Up,
            show_both: false,
        }
    }
}

pub(crate) fn generate(
    options: &IntervalOptions,
    instrument: Instrument,
    previous: Option<&PitchTask>,
    rng: &mut Rng,
) -> Result<PitchTask, TheoryError> {
    if options.intervals.is_empty() {
        return Err(TheoryError::NothingSelected("interval"));
    }
    // Any readable note of the instrument (naturals, sharps and flats) can
    // start an interval; the second note must be in range too.
    let starts = note_pool(
        &NoteReadingOptions {
            ledger_lines: true,
            accidentals: true,
            any_octave: false,
        },
        instrument,
    );
    let mut kinds: Vec<(IntervalName, Direction)> = options
        .intervals
        .iter()
        .flat_map(|&i| options.directions.list().iter().map(move |&d| (i, d)))
        .collect();
    // Each selected interval equally often: pick one, then a start note.
    while !kinds.is_empty() {
        let (interval, direction) = kinds.swap_remove(rng.below(kinds.len()));
        let prompt = Prompt::Interval {
            interval,
            direction,
        };
        let (steps, semitones) = interval.size();
        let sign = if direction == Direction::Up { 1 } else { -1 };
        let pairs: Vec<_> = starts
            .iter()
            .filter_map(|&start| {
                let second = start.transpose(sign * steps, sign * semitones)?;
                let fits = !second.is_double() && instrument.in_range(second);
                let fresh = !rings_on(previous, instrument.sounding(start))
                    && previous.is_none_or(|p| p.prompt != prompt || p.notes[0].written != start);
                (fits && fresh).then_some((start, second))
            })
            .collect();
        if let Some(&(start, second)) = rng.pick(&pairs) {
            return Ok(PitchTask {
                prompt,
                clef: instrument.clef(),
                notes: vec![
                    PitchTask::note(instrument, start, true),
                    PitchTask::note(instrument, second, options.show_both),
                ],
                matching: Matching::AnyOctave,
                play_first: false,
            });
        }
    }
    Err(TheoryError::OutOfRange("interval"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::{Letter, Pitch};

    fn options(intervals: &[IntervalName], directions: Directions) -> IntervalOptions {
        IntervalOptions {
            intervals: intervals.to_vec(),
            directions,
            show_both: false,
        }
    }

    #[test]
    fn sizes_add_up_to_an_octave() {
        use IntervalName::*;
        for (a, b) in [
            (MinorSecond, MajorSeventh),
            (MajorThird, MinorSixth),
            (PerfectFourth, PerfectFifth),
            (MajorSecond, MinorSeventh),
        ] {
            let (sa, ta) = a.size();
            let (sb, tb) = b.size();
            assert_eq!((sa + sb, ta + tb), (7, 12), "{a:?} + {b:?}");
        }
    }

    #[test]
    fn second_note_is_spelled_by_the_interval() {
        let e = Pitch::natural(Letter::E, 4);
        let (steps, semitones) = IntervalName::MajorThird.size();
        assert_eq!(
            e.transpose(steps, semitones),
            Some(Pitch::new(Letter::G, 1, 4))
        );
        let (steps, semitones) = IntervalName::MinorSixth.size();
        let below = e.transpose(-steps, -semitones).unwrap();
        assert_eq!(below, Pitch::new(Letter::G, 1, 3));
        let (steps, semitones) = IntervalName::Tritone.size();
        assert_eq!(
            Pitch::natural(Letter::F, 4).transpose(steps, semitones),
            Some(Pitch::natural(Letter::B, 4))
        );
    }

    #[test]
    fn tasks_have_the_interval_and_stay_in_range() {
        let opts = options(&IntervalName::ALL, Directions::Both);
        let mut rng = Rng::new(11);
        let mut previous: Option<PitchTask> = None;
        for _ in 0..200 {
            let task = generate(&opts, Instrument::Guitar, previous.as_ref(), &mut rng).unwrap();
            let Prompt::Interval {
                interval,
                direction,
            } = task.prompt
            else {
                panic!("not an interval: {:?}", task.prompt);
            };
            let [first, second] = [task.notes[0], task.notes[1]];
            let (steps, semitones) = interval.size();
            let sign = if direction == Direction::Up { 1 } else { -1 };
            assert_eq!(second.midi - first.midi, sign * semitones, "{task:?}");
            assert_eq!(second.written.step() - first.written.step(), sign * steps);
            assert!(!second.written.is_double());
            assert!(Instrument::Guitar.in_range(first.written));
            assert!(Instrument::Guitar.in_range(second.written));
            assert!(first.given && !second.given);
            assert_eq!(task.matching, Matching::AnyOctave);
            if let Some(prev) = &previous {
                let last = prev.notes.last().unwrap().midi;
                assert_ne!((first.midi - last).rem_euclid(12), 0, "still ringing");
            }
            previous = Some(task);
        }
    }

    #[test]
    fn every_selected_interval_and_direction_comes_up() {
        let opts = options(
            &[IntervalName::MinorThird, IntervalName::PerfectFifth],
            Directions::Both,
        );
        let mut rng = Rng::new(5);
        let mut seen = std::collections::HashSet::new();
        for _ in 0..100 {
            let task = generate(&opts, Instrument::Cello, None, &mut rng).unwrap();
            if let Prompt::Interval {
                interval,
                direction,
            } = task.prompt
            {
                seen.insert((interval, direction == Direction::Up));
            }
        }
        assert_eq!(seen.len(), 4);
    }

    #[test]
    fn show_both_and_empty_selection() {
        let mut opts = options(&[IntervalName::Octave], Directions::Down);
        opts.show_both = true;
        let task = generate(&opts, Instrument::Violin, None, &mut Rng::new(1)).unwrap();
        assert!(task.notes[1].given);
        assert_eq!(task.notes[0].midi - task.notes[1].midi, 12);
        let none = options(&[], Directions::Up);
        assert_eq!(
            generate(&none, Instrument::Violin, None, &mut Rng::new(1)),
            Err(TheoryError::NothingSelected("interval"))
        );
    }
}
