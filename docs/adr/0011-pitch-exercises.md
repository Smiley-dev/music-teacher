# 0011. Pitch exercises: theory crate, note judge and pitch sessions

- Status: Accepted
- Date: 2026-11-13

## Context

Practice gets exercises where *which* note is played matters, not when:
note reading, intervals, scales, chords (arpeggiated) and ear training (see
[features/exercise-catalog.md](../features/exercise-catalog.md)). They all
reduce to the same loop: show (or play) a task, listen to the instrument,
and decide note by note whether the right pitch was played. Notes must be
spelled correctly to be drawn on a staff (E♭, not D♯, in a B♭ scale), and
transposing instruments (guitar sounds an octave lower than written) must be
judged on what sounds while notation shows what is written.

## Decision

- **`crates/theory`** (pure, tested, like `rhythm`): spelled pitches
  (`Pitch`: letter, accidental, octave; `transpose` keeps correct spelling),
  `Instrument` presets (clef, written-to-sounding transposition, written
  range used by exercises), the task model and the task generators. A task
  (`PitchTask`) is a list of notes, each with its written pitch, the
  sounding MIDI note and whether it is shown before being played, plus a
  `Prompt` (what to say), the clef, a `Matching` mode and `play_first` (ear
  training). Generation is seeded and deterministic.
- **`NoteJudge`** (in `theory`) turns one pitch reading per engine tick
  (MIDI note of the strongest clear pitch, or none) into decisions on the
  audio clock:
  - a correct note counts after **80 ms** of steady readings
    (`CONFIRM_SECS`), a wrong one only after **250 ms** (`WRONG_SECS`), so
    attack transients (often an octave high) and slides are not punished;
  - wrong notes are counted but do not advance: the player corrects them;
  - the last correct note (or its octave) heard again is ignored, since it
    is usually still ringing; an expected note an octave from the last one
    needs the longer 250 ms;
  - a note already sounding when a task starts is ignored until it stops or
    changes (`ignore`);
  - `Matching::AnyOctave` matches the first note by name and the rest by the
    same octave shift, so a scale or arpeggio can be played in any octave
    but must keep its shape.
- **Readings** come from `Analyzer::pitch_midi()`: the raw McLeod reading of
  the strongest channel each tick, not the display stabilizer (which holds a
  note for 1.2 s).
- **`PitchSession`** (`src-tauri/src/engine/pitch.rs`) runs one exercise:
  task after task until stopped, with a short pause after a solved task and
  the answer shown after a skip. "Hear it" (and ear training's first
  playback) plays the task's notes as tones with `ClickPlayer`; judging
  pauses until the playback plus a 300 ms tail has passed, so a microphone
  hearing the speakers is not judged. To place that on the input's audio
  clock, `ClickPlayer::origin()` now reports the playback instant of the
  output stream's first frame.
- **IPC**: `start_pitch_practice(exercise)` (options come from the saved
  settings), `stop_pitch_practice`, `skip_pitch_task`, `replay_pitch_task`,
  `set_pitch_settings`. State goes out as `EngineEvent::PitchPractice` only
  when it changes (task, stage, progress, last wrong note, heard note,
  score) and is part of the snapshot. Played notes are named as written for
  the instrument, spelled like the task's note of the same name.
- **Settings**: `practice.pitch` holds the instrument (shared by all pitch
  exercises) and each exercise's options (ADR 0004).
- Only one session runs at a time: calibration, rhythm practice and pitch
  practice exclude each other. Leaving a pitch exercise's tab stops it.

## Alternatives considered

- **Judge from `Frame::note` in the UI**: puts music logic in TypeScript,
  and the stabilizer's hold time would hide repeated or quick notes.
- **Onsets to separate notes**: legato playing (slides, hammer-ons) has no
  clear onsets; tasks are generated without immediate repeats instead, so a
  pitch change is enough.
- **MIDI numbers only**: cannot draw notation or name notes correctly
  (spelling depends on the key or interval).
- **One generic "note sequence" exercise configured in the UI**: the
  generators need music rules (spelling, ranges), which belong in Rust.

## Consequences

- New pitch exercises are a generator in `theory`, a `PitchExerciseKind`
  variant with options in settings, and a Practice tab using the shared
  `PitchSessionCard`.
- Monophonic only: chords are played as arpeggios.
- Accuracy depends on pitch detection (ADR 0001): very low notes (bass E1)
  need a clean signal; the 80 ms confirmation adds that much delay before a
  note turns green.
