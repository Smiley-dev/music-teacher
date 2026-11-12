# Practice

**Status: coming soon.** The menu entry shows a placeholder screen.

## What it will use

- **Shared audio engine** (ADR 0005): subscribe through the existing
  `AudioEngineProvider` hooks; never open a separate stream. New data Practice
  needs (e.g. onsets with timestamps during exercises) is added as fields or
  variants of `EngineEvent`.
- **Latency calibration**: `useLatency()` returns the saved round-trip latency
  in ms (or `null` if not calibrated); on the Rust side
  `AudioEngine::latency()`. Practice subtracts it from detected onset times
  before comparing with the beat grid.
- **Audio-clock timing** (ADR 0003): beats and onsets are compared as
  `StreamInstant`s, the same way calibration does, reusing `ClickPlayer` and
  `OnsetDetector`.
- **Note detection**: the same `PitchTracker` / `NoteStabilizer` as the Tuner.
