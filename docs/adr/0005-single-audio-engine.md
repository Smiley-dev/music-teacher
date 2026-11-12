# 0005. One shared audio engine with a single event stream

- Status: Accepted
- Date: 2026-11-12

## Context

Tuner, Settings and later Practice all need the live input. If each screen
opened its own stream, switching screens would restart the device (audible
gaps, reconnect races) and calibration could not run while showing another
view.

## Decision

- `AudioEngine` (in `src-tauri/src/engine/`) is created once at startup and
  stored in Tauri state. It owns the input stream, gain, device selection,
  reconnect loop, analysis and calibration session, all driven by one
  `audio-engine` thread. Other code talks to it through methods that send
  commands to that thread.
- The UI subscribes once with `subscribe_engine(channel)` from
  `AudioEngineProvider`, mounted at the root, and gets a snapshot back.
  Events are a tagged union: `status`, `frame` (meters, waveform, note),
  `calibration` and `settings`. `unsubscribe_engine(id)` removes a
  subscriber.
- Screens read from React context (`useEngine`, `useSettings`, `useLatency`)
  and never call device commands on mount/unmount.

## Alternatives considered

- **Per-screen hooks that start/stop monitoring** (the original prototype):
  simple, but restarts audio on navigation.
- **Separate Tauri events per data type (`emit`)**: global broadcast, string
  event names, no backpressure signal. A `Channel` per subscriber is typed and
  ordered, and a failed send tells us the subscriber is gone.

## Consequences

- Navigation is free: no audio restarts.
- The engine always runs while the app is open (it is cheap: ~30 analyses per
  second). A future "pause when hidden" can live inside the engine.
- Every new feature that needs audio data adds fields/variants to
  `EngineEvent` rather than opening its own stream.
