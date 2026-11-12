# 0001. Pitch detection with the McLeod Pitch Method

- Status: Accepted
- Date: 2026-11-12

## Context

The tuner must identify single notes from guitar, bass, keys and voice,
including low notes (bass E1 ≈ 41 Hz, guitar E2 ≈ 82.41 Hz). Plucked strings
have strong harmonics; often the second harmonic is louder than the
fundamental, which makes naive methods report the wrong octave.

## Decision

Use the McLeod Pitch Method (normalized square difference function with
peak picking and quadratic interpolation) via the `pitch-detection` crate,
wrapped in `dsp::PitchTracker`:

- Window: next power of two ≥ 80 ms of samples (4096 at 48 kHz), so at least
  three periods of 41 Hz fit.
- RMS gate ≈ −50 dBFS and clarity threshold 0.7; readings outside 30–4200 Hz
  are dropped.
- `dsp::NoteStabilizer` requires two consecutive agreeing readings before
  switching notes, smooths the frequency, and holds the last note briefly.

## Alternatives considered

- **FFT peak picking**: frequency resolution at low notes is poor without
  huge windows, and it locks onto harmonics. Rejected.
- **YIN**: similar accuracy; the crate's implementation is not FFT-accelerated,
  so it costs more CPU at our window size. McLeod tends to have fewer octave
  errors on plucked strings.
- **Writing our own**: unnecessary while the crate is small, MIT licensed and
  tested.

## Consequences

- Monophonic only; chords are not recognised (that needs a different
  approach, e.g. chroma features).
- ~80 ms window adds that much latency to the note display, which is fine for
  a tuner. Practice timing must use onsets, not pitch (see ADR 0003).
- Behaviour is pinned by unit tests on synthetic harmonic tones.
