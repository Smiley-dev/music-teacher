//! Sight reading at your own pace (ADR 0012): play the melody's notes in
//! order, judged by pitch (`NoteJudge`, exact pitch); no metronome. Onsets
//! let a repeated note count again.
//!
//! Time is the input's audio clock: seconds since the newest captured frame
//! of the first tick.

use audio_engine::{StreamInstant, signed_secs};
use dsp::{OnsetDetector, StableNote};
use theory::{Heard, Matching, NoteJudge, ReadingExercise};

use super::analysis::Analyzer;
use super::events::ReadingState;

pub struct ReadingSession {
    exercise: ReadingExercise,
    judge: NoteJudge,
    detector: OnsetDetector,
    onset_frames: Vec<u64>,
    /// Audio-clock instant of session time 0, set on the first tick.
    start: Option<StreamInstant>,
    wrong: Option<String>,
    heard: Option<String>,
}

impl ReadingSession {
    /// Listen to `analyzer`'s input from its next frame.
    pub fn start(exercise: ReadingExercise, analyzer: &Analyzer) -> Self {
        Self {
            judge: NoteJudge::from_midi(exercise.midi_notes(), Matching::Exact),
            exercise,
            detector: OnsetDetector::new(analyzer.info.sample_rate, analyzer.frames()),
            onset_frames: Vec::new(),
            start: None,
            wrong: None,
            heard: None,
        }
    }

    /// Call after every `Analyzer::process`, with the note being displayed.
    /// Returns the new state (`Finished` once every note was played).
    pub fn tick(&mut self, analyzer: &Analyzer, display: Option<&StableNote>) -> ReadingState {
        // Always run the detector so its frame numbering stays in step.
        let (mono, _) = analyzer.last_mono();
        self.onset_frames.clear();
        self.detector.push(mono, &mut self.onset_frames);

        let Some(latest) = analyzer.latest_instant() else {
            return self.state();
        };
        let midi = analyzer.pitch_midi();
        let now = match self.start {
            Some(start) => signed_secs(&latest, &start),
            None => {
                // A note already sounding when the session starts does not
                // count until it is played again.
                self.start = Some(latest);
                self.judge.ignore(0.0, midi);
                return self.state();
            }
        };
        self.heard = display
            .filter(|n| n.active)
            .map(|n| self.exercise.name_of(n.midi).to_string());
        if !self.onset_frames.is_empty() {
            self.judge.onset();
        }
        match self.judge.hear(now, midi) {
            Some(Heard::Correct { .. }) => {
                self.wrong = None;
                if self.judge.is_done() {
                    return ReadingState::Finished {
                        notes: self.exercise.notes.len(),
                        mistakes: self.judge.mistakes(),
                        seconds: now,
                    };
                }
            }
            Some(Heard::Wrong { midi, .. }) => {
                self.wrong = Some(self.exercise.name_of(midi).to_string());
            }
            None => {}
        }
        self.state()
    }

    pub fn state(&self) -> ReadingState {
        ReadingState::Running {
            progress: self.judge.progress(),
            total: self.exercise.notes.len(),
            wrong: self.wrong.clone(),
            heard: self.heard.clone(),
            mistakes: self.judge.mistakes(),
        }
    }
}
