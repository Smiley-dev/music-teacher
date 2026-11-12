# 0002. Audio processing on native Rust threads

- Status: Accepted
- Date: 2026-11-12

## Context

Audio analysis must never stall the UI, and the UI must never cause audio
dropouts. In a browser app this is what an AudioWorklet is for. This app is a
Tauri desktop app, so we control native threads directly and can use the
system's audio APIs (WASAPI, later ASIO).

## Decision

- Capture and playback use `cpal`. Its data callbacks run on real-time
  threads and only move data: convert to `f32`, push into lock-free `rtrb`
  ring buffers, record timestamps.
- All analysis runs on one dedicated `audio-engine` thread that drains the
  rings every ~33 ms.
- The webview receives results through a Tauri IPC `Channel` at ~30 Hz and
  does no signal processing.
- Browser-style input processing (echo cancellation, noise suppression, AGC)
  does not apply because we capture natively. Windows "audio enhancements" on
  a device can still alter the signal in WASAPI shared mode; the docs tell
  users to disable them if readings look wrong.

## Alternatives considered

- **Web Audio + AudioWorklet in the webview**: would need microphone
  permission in WebView2, gives less control over devices (no ASIO, limited
  channel selection), and splits DSP between TypeScript and Rust.
- **Analysis inside the cpal callback**: pitch detection (FFT over 4096
  samples) is too heavy for the real-time callback and would cause dropouts.

## Consequences

- One language (Rust) for all DSP, testable without a UI.
- Data reaches the UI with up to ~33 ms of extra delay. Acceptable for
  display; timing-critical work uses audio-clock timestamps instead.
- cpal streams are not `Send` on every platform, so each stream is owned by
  its own small thread.
