# 0006. Rhythm exercises generated in Rust, played as engine sessions

- Status: Accepted
- Date: 2026-11-13

## Context

Practice gets subsections, starting with rhythm practice: a generated
exercise (note lengths only) shown in notation, a metronome at a chosen
tempo with a 4-click count-in, and difficulty levels (easy, medium, hard,
custom). A later step will judge the user's timing against the exercise, so
the exercise and the metronome must share one timeline on the audio clock.

## Decision

- A new pure crate, `crates/rhythm`, owns note values, time signatures,
  difficulty presets and the exercise generator. It has no devices, threads
  or Tauri, and is unit tested like `dsp`. Generation is deterministic for a
  given seed (own SplitMix64 PRNG, no dependency).
- Durations are integers in sixteenths (the shortest value). Bars are filled
  exactly with a randomized backtracking search under readability rules
  (values of a beat or longer start on a beat; shorter values stay inside one
  beat; undotted eighths and sixteenths sit on their own grid), so notes
  never cross bar lines and no ties are needed.
- The frontend asks the engine to generate (`generate_rhythm_exercise`),
  renders the result, and sends the same exercise back to
  `start_rhythm_practice`. The engine validates it and owns the session.
- `RhythmSession` in `src-tauri/src/engine/practice.rs` plays count-in plus
  one click per beat with `ClickPlayer`, and reports the position in beats on
  the audio clock: `(latest input capture instant − first click playback
  instant) / beat − count-in`. Practice therefore needs a running input
  device, which it needs anyway for the upcoming timing judgement.
- Only one click session (calibration or practice) runs at a time.
- `ClickPlayer` takes an explicit accent pattern and walks clicks with an
  index, so long sessions cost O(1) per sample in the real-time callback.
- Rhythm practice settings (tempo, difficulty, custom selection, time
  signature, bars) are persisted in `Settings.practice.rhythm` (ADR 0004).

## Alternatives considered

- **Generate in TypeScript**: simpler to wire up, but puts music logic in the
  UI (against the coding rules) and the future scorer in Rust would need a
  second copy.
- **UI-driven metronome (Web Audio or timers)**: drifts from the audio clock
  and could not be matched with input onsets later.
- **Free placement without readability rules**: produces valid but hard to
  read rhythms (e.g. a quarter note starting on the last sixteenth of a beat).

## Consequences

- Timing judgement can be added inside `RhythmSession` using
  `OnsetDetector` and the saved latency without changing the UI contract.
- The cursor position updates at the engine tick (~30 Hz), which is fine for
  highlighting the current note.
- Some custom selections cannot fill a bar (e.g. only half notes in 3/4); the
  generator reports `CannotFillBar` and the UI explains it.
