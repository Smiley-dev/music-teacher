# 0004. Settings persisted as JSON by the Rust backend

- Status: Accepted
- Date: 2026-11-12

## Context

The selected input device, input gain and latency calibration must survive
restarts. The audio engine (Rust) needs them at startup, before any UI has
loaded, to reopen the last device with the right gain.

## Decision

`src-tauri/src/settings.rs` owns a `Settings` struct (`inputDevice`, `gainDb`,
`latency`) serialized with `serde_json` to `settings.json` in Tauri's app
config directory. It is loaded once at startup (missing or invalid file →
defaults, with a log line) and written atomically (temp file + rename) on
every change. The UI reads it with `get_settings` and changes it only through
commands (`set_input_device`, `set_gain_db`, `set_latency_ms`, calibration).

## Alternatives considered

- **`localStorage` in the webview**: not available to Rust at startup, and
  can be cleared with webview data.
- **`tauri-plugin-store`**: works, but adds a plugin and JS-side ownership
  for something the backend already needs to own.
- **SQLite**: overkill for a handful of values. Revisit when Practice stores
  history.

## Consequences

- One source of truth on the Rust side; the UI mirrors it via the provider.
- The file is human-readable, which helps support and debugging.
- Schema changes must stay backwards compatible (`#[serde(default)]` on every
  field) or include a migration.
