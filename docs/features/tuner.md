# Tuner

Shows the note being played on the selected input, live.

## What it shows

- **Note** name and octave in scientific pitch notation (A4 = 440 Hz, middle
  C = C4), e.g. `E2` for a guitar's low string.
- **Frequency** in Hz (smoothed) and **cents** offset from the nearest
  equal-tempered note, −50 to +50.
- **Gauge** with a marker: green within ±5 cents ("In tune"), amber within
  ±15, red beyond, labelled "Flat (tune up)" / "Sharp (tune down)".
- Which **input channel** the note came from (the loudest channel with a
  clear pitch).
- Live **waveform** (~43 ms, 256 min/max points) of the channel the note
  comes from, or of the loudest channel when no note is detected, and a
  **level meter** per channel.
- The engine status (opening, reconnecting, no devices, permission denied)
  above the cards when the input is not running.

## How it decides

All logic is in `crates/dsp` (see ADR 0001):

| Step | Where | Value |
| --- | --- | --- |
| Input gain | `engine/analysis.rs` | from Settings, −24…+24 dB |
| Silence gate | `PitchTracker` | RMS ≥ `MIN_RMS` (≈ −50 dBFS) |
| Confidence gate | `PitchTracker` | McLeod clarity ≥ 0.7, 30–4200 Hz |
| Note mapping | `Note::from_frequency` | equal temperament, `A4_HZ = 440` |
| Note switching | `NoteStabilizer` | 2 consecutive agreeing readings |
| Smoothing | `NoteStabilizer` | frequency EMA, weight 0.35 per reading |
| Hold | `NoteStabilizer` | last note stays (dimmed) for 1.2 s |

Readings arrive ~30 times per second; the window is ~80 ms.

## Limitations

- One note at a time (monophonic). Chords give unstable or no readings.
- Right after a pick attack the second harmonic can dominate for a moment;
  the two-reading rule hides most of these octave jumps.
