# 0003. Latency calibration on the audio clock

- Status: Accepted
- Date: 2026-11-12

## Context

Practice will judge whether the user plays in time. Between a sound being
scheduled and the user's answer arriving in the app there is output latency,
the user's reaction offset and input latency. We need one number to subtract,
measured on the user's actual setup.

## Decision

- Play 16 clicks (4 bars of 4/4 at 90 BPM, constants in
  `dsp::calibration`) on the default output device with `ClickPlayer`. Each
  click is rendered at an exact sample position; its time is the output
  callback's `playback` `StreamInstant` plus the sample offset.
- Detect when the user's notes start with `dsp::OnsetDetector` (energy rise
  above the gate, ~5 ms hops, refined to the first strong sample). Onset time
  = the input buffer's `capture` `StreamInstant` plus the sample offset.
  Pitch detection is not used; onsets are faster and more precise.
- On WASAPI both instants come from the same performance counter (QPC), so
  `onset − click` is meaningful.
- Match each click to the nearest unused onset within ±40% of a beat. Take the
  median of the offsets, drop values more than `max(3 × 1.4826 × MAD, 15 ms)`
  from it, and average the rest. Fewer than 8 remaining matches is a failed
  calibration, reported as such.

The stored value is the **round-trip latency** (output + input + the user's
reaction offset). That is intended: it is exactly the correction Practice
needs.

## Alternatives considered

- **UI timers (`setTimeout`, `performance.now`)**: jitter of several to tens
  of milliseconds and unrelated to when sound actually plays or arrives.
- **Loopback measurement (output cable into input)**: measures hardware
  latency only, needs a cable, and ignores the human offset Practice needs.
- **Plain mean**: one missed or double-hit note ruins it; median + MAD filter
  is robust.

## Consequences

- `cpal`'s WASAPI `playback` time is an estimate that excludes the last bit of
  hardware latency; that remainder is included in the measured round trip, so
  it is still corrected.
- With a microphone, the click can leak into the input and be detected as an
  onset. Users are told to use headphones.
- Other hosts (ASIO, CoreAudio) also provide stream instants from a common
  clock, but must be verified when added.
