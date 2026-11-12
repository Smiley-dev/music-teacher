import { Channel, invoke } from "@tauri-apps/api/core";

export type InputDeviceInfo = {
  name: string;
  host: string;
  isDefault: boolean;
  channels: number | null;
  sampleRate: number | null;
  sampleFormat: string | null;
};

export type MonitorInfo = {
  channels: number;
  sampleRate: number;
  sampleFormat: string;
};

export type Note = {
  /** e.g. "A" or "C#" */
  name: string;
  /** Scientific pitch octave (middle C = C4). */
  octave: number;
  /** MIDI note number (A4 = 69). */
  midi: number;
  /** Deviation from the exact note, -50..+50. */
  cents: number;
};

export type PitchReading = {
  frequency: number;
  /** Confidence 0..1 */
  clarity: number;
  note: Note;
};

export type MonitorEvent =
  | { type: "levels"; peaks: number[]; pitches: (PitchReading | null)[] }
  | { type: "reconnecting"; message: string }
  | { type: "reconnected"; info: MonitorInfo };

/** Stable id used as the <Select> value and for remembering the last device. */
export const deviceKey = (d: Pick<InputDeviceInfo, "host" | "name">) =>
  `${d.host}::${d.name}`;

export const listInputDevices = () =>
  invoke<InputDeviceInfo[]>("list_input_devices");

export function startMonitoring(
  device: Pick<InputDeviceInfo, "host" | "name">,
  onEvent: (event: MonitorEvent) => void,
) {
  const channel = new Channel<MonitorEvent>();
  channel.onmessage = onEvent;
  return invoke<MonitorInfo>("start_monitoring", {
    host: device.host,
    name: device.name,
    onEvent: channel,
  });
}

export const stopMonitoring = () => invoke<void>("stop_monitoring");

/** Exact equal-tempered frequency of a MIDI note (A4 = 440 Hz). */
export const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Cents between a frequency and a MIDI note. */
export const centsFrom = (frequency: number, midi: number) =>
  1200 * Math.log2(frequency / midiToFrequency(midi));

/** Linear amplitude (1.0 = full scale) to dBFS. */
export const toDb = (linear: number) => 20 * Math.log10(Math.max(linear, 1e-6));
