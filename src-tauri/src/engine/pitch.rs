//! Pitch practice session (ADR 0011): tasks one after another (play the note
//! shown, an interval, a scale …), judged from the pitch of the input. A
//! task's notes can be played to the user first ("Hear it", ear training) on
//! the default output device.
//!
//! Time is the input's audio clock: seconds since the newest captured frame
//! of the first tick. Reference playback is placed on the same clock with
//! `ClickPlayer::origin`.

use audio_engine::{ClickPlayer, ClickSchedule, StreamInstant, Tone, signed_secs};
use dsp::StableNote;
use theory::{Heard, Instrument, NoteJudge, PitchExercise, PitchTask};

use super::analysis::Analyzer;
use super::events::{PitchPracticeState, PitchScore, TaskStage};

/// Pause after a solved task before the next one, in seconds.
const NEXT_TASK_SECS: f64 = 1.2;
/// How long a skipped task's answer stays on screen, in seconds.
const REVEAL_SECS: f64 = 3.0;
/// Silence before the first reference note, in seconds.
const REFERENCE_LEAD_IN_SECS: f64 = 0.15;
/// Length of each reference note, in seconds.
const REFERENCE_NOTE_SECS: f64 = 0.7;
/// Judging starts this long after the reference ends, so its fade-out
/// (picked up by a microphone) is not taken for the player, in seconds.
const REFERENCE_TAIL_SECS: f64 = 0.3;
/// Fail if the output has not started this long after asking, in seconds.
const OUTPUT_START_TIMEOUT_SECS: f64 = 3.0;
/// Increment between task seeds (golden ratio, as in SplitMix64).
const SEED_STEP: u64 = 0x9E37_79B9_7F4A_7C15;

/// The task's notes as tones, one after another.
fn reference_tones(task: &PitchTask) -> Vec<Tone> {
    task.notes
        .iter()
        .enumerate()
        .map(|(i, note)| Tone {
            start_secs: REFERENCE_LEAD_IN_SECS + i as f64 * REFERENCE_NOTE_SECS,
            duration_secs: REFERENCE_NOTE_SECS,
            frequency: dsp::note::midi_to_frequency(note.midi),
        })
        .collect()
}

/// Seconds from the output origin until judging may start.
fn reference_secs(task: &PitchTask) -> f64 {
    REFERENCE_LEAD_IN_SECS + task.notes.len() as f64 * REFERENCE_NOTE_SECS + REFERENCE_TAIL_SECS
}

#[derive(Debug, Clone, Copy)]
enum Stage {
    /// Waiting for the first tick, to ignore a note already sounding.
    Ready,
    /// The task's notes are playing. Judging starts at `until` (session
    /// seconds), known once the output has started.
    Listening {
        requested: f64,
        until: Option<f64>,
    },
    Playing,
    Solved {
        since: f64,
    },
    Revealed {
        since: f64,
    },
}

pub struct PitchSession {
    exercise: PitchExercise,
    instrument: Instrument,
    seed: u64,
    task: PitchTask,
    judge: NoteJudge,
    stage: Stage,
    round: u32,
    score: PitchScore,
    wrong: Option<String>,
    heard: Option<String>,
    player: Option<ClickPlayer>,
    /// Audio-clock instant of session time 0.
    start: Option<StreamInstant>,
    /// Session time of the last tick, seconds.
    now: f64,
}

impl PitchSession {
    /// Generate the first task (and play it, for ear training).
    pub fn start(
        exercise: PitchExercise,
        instrument: Instrument,
        seed: u64,
    ) -> Result<Self, String> {
        let task =
            theory::generate(&exercise, instrument, None, seed).map_err(|e| e.to_string())?;
        let mut session = Self {
            judge: NoteJudge::new(&task),
            task,
            exercise,
            instrument,
            seed,
            stage: Stage::Ready,
            round: 1,
            score: PitchScore::default(),
            wrong: None,
            heard: None,
            player: None,
            start: None,
            now: 0.0,
        };
        if session.task.play_first {
            session.play_reference()?;
        }
        Ok(session)
    }

    /// Play the task's notes, then listen again from its first note.
    fn play_reference(&mut self) -> Result<(), String> {
        // Stop a playback still running before starting the new one.
        self.player = None;
        let player = ClickPlayer::start(ClickSchedule {
            lead_in_secs: 0.0,
            interval_secs: 1.0,
            accents: Vec::new(),
            tones: reference_tones(&self.task),
        })
        .map_err(|e| format!("Could not play the notes: {e}."))?;
        self.player = Some(player);
        self.judge = NoteJudge::new(&self.task);
        self.wrong = None;
        self.stage = Stage::Listening {
            requested: self.now,
            until: None,
        };
        Ok(())
    }

    /// Call after every `Analyzer::process`, with the note being displayed.
    pub fn tick(
        &mut self,
        analyzer: &Analyzer,
        display: Option<&StableNote>,
    ) -> Result<(), String> {
        if let Some(error) = self.player.as_ref().and_then(|p| p.take_error()) {
            return Err(format!("The output device stopped: {error}."));
        }
        let Some(latest) = analyzer.latest_instant() else {
            return Ok(());
        };
        let start = *self.start.get_or_insert(latest);
        self.now = signed_secs(&latest, &start);
        let now = self.now;
        let midi = analyzer.pitch_midi();
        self.heard = display
            .filter(|n| n.active)
            .map(|n| self.task.name_of(n.midi).to_string());

        match self.stage {
            Stage::Ready => {
                self.judge.ignore(now, midi);
                self.stage = Stage::Playing;
            }
            Stage::Listening { requested, until } => {
                let wait = reference_secs(&self.task);
                let until = until.or_else(|| {
                    let origin = self.player.as_mut()?.origin()?;
                    Some(signed_secs(&origin, &start) + wait)
                });
                match until {
                    Some(t) if now >= t => {
                        self.player = None;
                        self.judge.ignore(now, midi);
                        self.stage = Stage::Playing;
                    }
                    Some(t) => {
                        self.stage = Stage::Listening {
                            requested,
                            until: Some(t),
                        }
                    }
                    None if now - requested > OUTPUT_START_TIMEOUT_SECS => {
                        return Err(
                            "The output device did not start playing. Check the default \
                             output device in the Windows sound settings."
                                .into(),
                        );
                    }
                    None => {}
                }
            }
            Stage::Playing => match self.judge.hear(now, midi) {
                Some(Heard::Correct { .. }) => {
                    self.wrong = None;
                    if self.judge.is_done() {
                        self.score.solved += 1;
                        if self.judge.mistakes() == 0 {
                            self.score.clean += 1;
                        }
                        self.stage = Stage::Solved { since: now };
                    }
                }
                Some(Heard::Wrong { midi, .. }) => {
                    self.score.wrong_notes += 1;
                    self.wrong = Some(self.task.name_of(midi).to_string());
                }
                None => {}
            },
            Stage::Solved { since } if now - since >= NEXT_TASK_SECS => self.next_task(midi)?,
            Stage::Revealed { since } if now - since >= REVEAL_SECS => self.next_task(midi)?,
            Stage::Solved { .. } | Stage::Revealed { .. } => {}
        }
        Ok(())
    }

    fn next_task(&mut self, midi: Option<i32>) -> Result<(), String> {
        self.seed = self.seed.wrapping_add(SEED_STEP);
        self.task = theory::generate(&self.exercise, self.instrument, Some(&self.task), self.seed)
            .map_err(|e| e.to_string())?;
        self.judge = NoteJudge::new(&self.task);
        self.round += 1;
        self.wrong = None;
        if self.task.play_first {
            return self.play_reference();
        }
        // The last note of the previous task may still ring.
        self.judge.ignore(self.now, midi);
        self.stage = Stage::Playing;
        Ok(())
    }

    /// Give up on the current task: show the answer, then move on.
    pub fn skip(&mut self) {
        if matches!(
            self.stage,
            Stage::Ready | Stage::Listening { .. } | Stage::Playing
        ) {
            self.player = None;
            self.score.skipped += 1;
            self.wrong = None;
            self.stage = Stage::Revealed { since: self.now };
        }
    }

    /// Play the current task's notes (again). Restarts the task.
    pub fn replay(&mut self) -> Result<(), String> {
        match self.stage {
            Stage::Solved { .. } | Stage::Revealed { .. } => Ok(()),
            _ => self.play_reference(),
        }
    }

    pub fn state(&self) -> PitchPracticeState {
        PitchPracticeState::Running {
            exercise: self.exercise.kind(),
            task: self.task.clone(),
            stage: match self.stage {
                Stage::Ready | Stage::Playing => TaskStage::Playing,
                Stage::Listening { .. } => TaskStage::Listening,
                Stage::Solved { .. } => TaskStage::Solved,
                Stage::Revealed { .. } => TaskStage::Revealed,
            },
            progress: self.judge.progress(),
            wrong: self.wrong.clone(),
            heard: self.heard.clone(),
            round: self.round,
            score: self.score,
        }
    }

    /// The state once the user stops: the score, if anything was played.
    pub fn finish(self) -> PitchPracticeState {
        if self.score.solved + self.score.skipped == 0 {
            return PitchPracticeState::Idle;
        }
        PitchPracticeState::Finished {
            exercise: self.exercise.kind(),
            score: self.score,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use theory::{Instrument, NoteReadingOptions};

    #[test]
    fn reference_plays_each_note_in_turn() {
        let exercise = PitchExercise::Notes(NoteReadingOptions::default());
        let task = theory::generate(&exercise, Instrument::KeyboardTreble, None, 3).unwrap();
        let tones = reference_tones(&task);
        assert_eq!(tones.len(), 1);
        let expected = dsp::note::midi_to_frequency(task.notes[0].midi);
        assert!((tones[0].frequency - expected).abs() < 1e-3);
        assert!((tones[0].start_secs - REFERENCE_LEAD_IN_SECS).abs() < 1e-9);
        let end = tones[0].start_secs + tones[0].duration_secs;
        assert!(
            reference_secs(&task) > end,
            "judging waits for the fade-out"
        );
    }
}
