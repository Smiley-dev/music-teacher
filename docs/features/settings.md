# Settings

Three cards: input device, input volume, instrument calibration. All values
are persisted by the backend (ADR 0004) and restored at startup.

## Input device

- Lists every input device on every available host (currently WASAPI),
  grouped by host. The Windows default is marked.
- Choosing a device saves it and makes the engine release the old stream
  before opening the new one.
- On startup the saved device is reopened. With no saved device (first run)
  the Windows default input is used. If the saved device is missing, it is
  shown as "(not connected)" and reopened as soon as it is plugged in; pick
  another device to switch.
- States shown to the user:
  - **No devices**: "No input devices found", with a refresh button. The
    engine retries automatically.
  - **Permission denied** (Windows microphone privacy blocks desktop apps):
    explanation and a button that opens `ms-settings:privacy-microphone`.
  - **Device unplugged/reset while in use**: amber "reconnecting" state; the
    engine reopens the device every 750 ms and resumes by itself.
- Not applicable on desktop: browser input processing (echo cancellation,
  noise suppression, AGC). If a device has Windows "audio enhancements"
  enabled, disable them in the Sound control panel for accurate readings.

## Input volume

- Gain slider, −24 dB to +24 dB in 0.5 dB steps (default 0 dB, with a reset
  button), applied on the engine thread to the samples before any analysis
  (meters, waveform, pitch, onsets). Changes apply instantly without
  restarting the stream and are saved.
- Live level meter per channel next to it, with peak hold and a clip
  indicator. **Clip** lights if the raw input reaches −0.5 dBFS (the
  interface itself is clipping: turn its gain knob down) or the signal after
  gain reaches 0 dBFS (lower the slider).

## Instrument calibration (latency)

Measures how late the user's playing reaches the app, so Practice can correct
timing.

### Procedure

Requires a running input device (the button is disabled otherwise).
Changing the device or losing it during calibration stops the session.

1. Press **Start calibration**. Use headphones if you use a microphone, so
   the click does not leak into the input.
2. After a 1 s lead-in, 16 clicks play on the default output device: 4 bars
   of 4/4 at 90 BPM, the first beat of each bar accented. A beat counter
   shows bar and beat.
3. Play any note on each click.
4. One beat after the last click, the result is computed.

### Math (`dsp::calibration`)

- Click times: output callback `playback` instant + sample offset of the
  click's first sample.
- Onset times: `OnsetDetector` finds energy rises (5 ms hops, RMS above
  −45 dBFS and ≥ 6 dB above the previous 20 ms, 100 ms refractory period),
  refined to the first sample above half the hop's peak; converted with the
  input buffer's `capture` instant + sample offset. Both instants use the same
  clock (QPC on Windows).
- Each click is matched to the nearest unused onset within ±40% of a beat
  (±267 ms at 90 BPM). Unmatched clicks are skipped.
- Offsets `onset − click` → median `m`, MAD → keep offsets within
  `max(3 × 1.4826 × MAD, 15 ms)` of `m` → latency = mean of kept offsets.
- Fewer than 8 kept matches: "Couldn't calibrate, try again" with the count.
- Onsets are detected on the gained mono signal (per frame, the sample with
  the largest magnitude across channels), so any input channel works.
- A wall-clock timeout (planned duration + 5 s) only guards against a stalled
  stream; it is never used for timing.

The value is **round-trip latency**: output latency + input latency + the
user's reaction offset. That is intended; it is the correction Practice
needs.

### Result

- Shown as milliseconds plus "matched N of 16 clicks".
- Editable via a number input (saved as a manual value) and resettable (no
  calibration).
- Persisted in `settings.json` as `latency: { ms, matched, total, source }`.
- Read by other features through `useLatency()` (TypeScript) or
  `AudioEngine::latency()` (Rust).
