# 0008. Judging rhythm practice timing from input onsets

- Status: Accepted
- Date: 2026-11-13

## Context

Rhythm practice must listen to the instrument and tell the player, note by
note, whether they played on time, and summarise how they did. ADR 0006 set
up the session on the audio clock; ADR 0003 measured round-trip latency for
exactly this purpose.

## Decision

- `RhythmSession` runs `dsp::OnsetDetector` on the gained mono input (same
  as calibration). Each onset becomes a position in beats:
  `(capture instant − first click playback instant) / beat − count-in −
  latency`, using the saved calibration (0 if not calibrated).
- `rhythm::TimingJudge` (pure, tested) matches onsets to the exercise's
  played notes (rests are not judged):
  - An onset hits the nearest unjudged note whose window contains it. The
    window is `min(150 ms, 50% of the gap to the neighbouring note)`, so fast
    passages do not steal each other's hits.
  - |offset| ≤ 40 ms is **on time**, otherwise **early** or **late**.
  - A note whose window has passed (plus latency) without a hit is
    **missed**. Onsets matching nothing (double hits, playing in rests) are
    **extra**.
- Judgements stream to the UI as `practiceJudged` events while playing, so
  the score is coloured live. At the end, `PracticeState::Finished` carries a
  `TimingReport`: every judgement, extra-hit positions, and a summary
  (counts, accuracy %, hit %, mean offset = rushing/dragging, spread =
  steadiness).
- The session ends once the last note's window has passed, after the last
  bar. Stopping early discards the analysis.

## Alternatives considered

- **Judge in the UI from raw onsets**: puts timing logic in TypeScript and
  depends on IPC delays.
- **Pitch-based detection**: slower (80 ms window) and unreliable on attacks;
  rhythm only needs onsets.
- **Fixed windows**: a 150 ms window is wider than a sixteenth at fast tempos
  and would assign hits to the wrong note.

## Consequences

- Accuracy depends on calibration; the UI warns when there is none.
- A noisy input (or click bleed into a microphone) produces extra hits; the
  same headphones advice as calibration applies.
- Thresholds are constants in `crates/rhythm/src/judge.rs` and can become
  settings later (e.g. stricter windows on Hard).
