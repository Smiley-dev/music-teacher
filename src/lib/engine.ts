/**
 * Typed IPC with the Rust audio engine. The only module that calls `invoke`
 * or creates Tauri channels. Types mirror `src-tauri/src/engine/events.rs`,
 * `src-tauri/src/settings.rs` and `crates/audio-engine` field for field.
 */
import { Channel, invoke } from "@tauri-apps/api/core";

// ---- audio-engine ----

export type DeviceId = { host: string; name: string };

export type InputDeviceInfo = {
  id: DeviceId;
  isDefault: boolean;
  channels: number | null;
  sampleRate: number | null;
  sampleFormat: string | null;
};

export type ErrorKind = "permissionDenied" | "noDevices" | "deviceLost" | "other";

export type StreamInfo = {
  channels: number;
  sampleRate: number;
  sampleFormat: string;
};

// ---- dsp ----

export type MeterReading = {
  /** Bar level, dBFS (floored at -120). */
  db: number;
  /** Peak-hold marker, dBFS. */
  holdDb: number;
  hasSignal: boolean;
  clipping: boolean;
};

export type StableNote = {
  /** e.g. "A" or "C#" */
  name: string;
  /** Scientific pitch octave (middle C = C4). */
  octave: number;
  midi: number;
  /** Smoothed frequency in Hz. */
  frequency: number;
  /** Deviation from the exact note, -50..+50. */
  cents: number;
  /** 0-based input channel. */
  channel: number;
  /** False once the note stopped sounding (shown dimmed). */
  active: boolean;
};

// ---- settings ----

/** Must match `MIN_GAIN_DB` / `MAX_GAIN_DB` in `src-tauri/src/settings.rs`. */
export const MIN_GAIN_DB = -24;
export const MAX_GAIN_DB = 24;
/** Must match `MAX_ABS_LATENCY_MS` in `src-tauri/src/settings.rs`. */
export const MAX_ABS_LATENCY_MS = 2000;

export type LatencySource = "measured" | "manual";

/** Round-trip latency: output + input + reaction offset (ADR 0003). */
export type LatencyCalibration = {
  ms: number;
  source: LatencySource;
  matched: number | null;
  totalClicks: number | null;
};

export type Settings = {
  /** null = system default device */
  inputDevice: DeviceId | null;
  gainDb: number;
  latency: LatencyCalibration | null;
};

// ---- engine ----

export type EngineState = "starting" | "running" | "reconnecting" | "error";

export type EngineError = { kind: ErrorKind; message: string };

export type EngineStatus = {
  state: EngineState;
  device: DeviceId | null;
  stream: StreamInfo | null;
  error: EngineError | null;
};

export type Frame = {
  meters: MeterReading[];
  /** [min, max] pairs of recent samples of `waveformChannel`, -1..1. */
  waveform: number[];
  waveformChannel: number;
  note: StableNote | null;
};

export type CalibrationState =
  | { phase: "idle" }
  | { phase: "running"; beat: number; beatsPerBar: number; totalClicks: number }
  | { phase: "done"; latency: LatencyCalibration; rejected: number }
  | { phase: "failed"; message: string; matched: number | null; totalClicks: number };

export type EngineEvent =
  | { type: "status"; status: EngineStatus }
  | { type: "frame"; frame: Frame }
  | { type: "calibration"; calibration: CalibrationState }
  | { type: "settings"; settings: Settings };

export type EngineSnapshot = {
  subscriptionId: number;
  status: EngineStatus;
  settings: Settings;
  calibration: CalibrationState;
};

// ---- commands ----

export const sameDevice = (a: DeviceId | null, b: DeviceId | null) =>
  a !== null && b !== null && a.host === b.host && a.name === b.name;

export const listInputDevices = () => invoke<InputDeviceInfo[]>("list_input_devices");

export function subscribeEngine(onEvent: (event: EngineEvent) => void) {
  const channel = new Channel<EngineEvent>();
  channel.onmessage = onEvent;
  return invoke<EngineSnapshot>("subscribe_engine", { onEvent: channel });
}

export const unsubscribeEngine = (subscriptionId: number) =>
  invoke<void>("unsubscribe_engine", { subscriptionId });

export const setInputDevice = (device: DeviceId) =>
  invoke<Settings>("set_input_device", { device });

export const setGainDb = (gainDb: number) => invoke<Settings>("set_gain_db", { gainDb });

/** `null` resets (no calibration). */
export const setLatencyMs = (ms: number | null) => invoke<Settings>("set_latency_ms", { ms });

export const startCalibration = () => invoke<void>("start_calibration");

export const cancelCalibration = () => invoke<void>("cancel_calibration");

export const openMicrophonePrivacySettings = () =>
  invoke<void>("open_microphone_privacy_settings");
