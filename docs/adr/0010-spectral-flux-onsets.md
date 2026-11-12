# 0010. Spectral-flux onset detection

- Status: Accepted (replaces the energy-rise detector described in ADR 0003)
- Date: 2026-11-13

## Context

Rhythm practice judges every played note from its onset. The first
detector fired when the signal energy rose by 6 dB over the previous 20 ms,
with a 100 ms refractory period. Measured with
`cargo run -p dsp --example onset_accuracy --release` (synthetic plucked
strings with realistic sustain, 32 sixteenths per run), it found only the
first note of every run: a string picked again while still ringing does not
get louder, so the energy never jumps. The 100 ms refractory period also
made sixteenths above 150 BPM impossible to detect.

## Decision

`dsp::OnsetDetector` (same API) now uses log-compressed spectral flux:

- 40 ms Hann window (2048 samples at 48 kHz), hop = window / 4 (~10 ms).
- Flux = mean positive change of `ln(1 + 100·|X|)` over 250 Hz–8 kHz. Below
  250 Hz a low note's fundamental fits less than two cycles in the window and
  its magnitude wobbles, which produced false onsets.
- Onset where the flux is a local peak above `1.5 × mean of the last 20 hops
  + 0.01`, the frame is louder than −45 dBFS, and at least 50 ms after the
  previous onset (a sixteenth at 200 BPM is 75 ms).
- Timing is refined from the frame to ~1 ms: within the last window, the 1 ms
  block whose high-passed energy jumps most over the 4 ms before it.

Measured result (same example):

| Notes | Detected | Mean timing error | False onsets |
| --- | --- | --- | --- |
| High (E4, A4) | 88–100 % at 60–200 BPM | 1–5 ms | 0–4 per 32 notes |
| Low (E2–D3) | 56–100 % at 60–200 BPM | 5–20 ms | 0–8 per 32 notes |

## Alternatives considered

- **Tuning the energy detector**: cannot see a re-pick at constant level.
- **Shorter window (20 ms)**: better time resolution of the flux, but many
  false onsets on low notes (harmonics 82 Hz apart overlap in the window).
- **Longer refinement baseline**: tried (12 ms), clearly worse.
- **Machine-learned onset detectors**: more accurate, but a large dependency
  and model for a small gain at this stage.

## Consequences

- Repeated notes on ringing strings are detected; fast passages up to 200 BPM
  sixteenths work for higher notes.
- Low notes are timed less precisely (their slow waveform makes the attack
  harder to pin down); the Rhythm screen advises higher, clearly picked notes
  and warns at very fast note spacing.
- Calibration uses the same detector, so constant offsets cancel out when the
  user calibrates with the same kind of note.
- Synthetic signals lack real pick noise (which helps); results with real
  instruments still need to be checked.
