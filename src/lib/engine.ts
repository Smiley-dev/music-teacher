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

// ---- rhythm (crates/rhythm) ----

export type NoteValue = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

/** Longest to shortest; must match `NoteValue::ALL`. */
export const NOTE_VALUES: readonly NoteValue[] = [
  "whole",
  "half",
  "quarter",
  "eighth",
  "sixteenth",
];

/** A note or rest (unplaced), as stored for written rhythms. */
export type Symbol = { value: NoteValue; dotted: boolean; rest: boolean };

/** Length in sixteenths; mirrors `Symbol::duration` (used to enable buttons only,
 * the engine validates). */
export const SIXTEENTHS: Record<NoteValue, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  sixteenth: 1,
};
export const symbolDuration = (s: Symbol) => (s.dotted ? SIXTEENTHS[s.value] * 1.5 : SIXTEENTHS[s.value]);

/** Must match `MAX_WRITTEN_SYMBOLS` in `crates/rhythm`. */
export const MAX_WRITTEN_SYMBOLS = 1024;

/** A note or rest placed in a bar. Positions and lengths are in sixteenths. */
export type PlacedSymbol = {
  value: NoteValue;
  dotted: boolean;
  rest: boolean;
  /** Start from the beginning of the bar, in sixteenths. */
  start: number;
  duration: number;
};

export type TimeSignature = { beatsPerBar: number };

/** Must match `TimeSignature::SUPPORTED_BEATS`. */
export const SUPPORTED_BEATS_PER_BAR = [2, 3, 4] as const;

export type Exercise = {
  timeSignature: TimeSignature;
  bars: { symbols: PlacedSymbol[] }[];
};

export type Difficulty = "easy" | "medium" | "hard" | "custom";

/** Custom exercises: generated from selected values, or written by the user. */
export type CustomMode = "random" | "written";

/** An exercise that may still be unfinished (written rhythms while editing). */
export type ExerciseDraft = {
  exercise: Exercise;
  /** Sixteenths missing in the last bar (0 = all bars full). */
  remaining: number;
  /** Playable: at least one bar, all full, at least one note. */
  complete: boolean;
  /** Shortest distance between two played notes, beats (null if < 2 notes). */
  minNoteGapBeats: number | null;
};

export type RhythmOptions = {
  values: NoteValue[];
  dotted: boolean;
  rests: boolean;
};

/** Must match `MIN_BARS` / `MAX_BARS` in `crates/rhythm`. */
export const MIN_BARS = 1;
export const MAX_BARS = 64;
/** Must match `MIN_BPM` / `MAX_BPM` in `src-tauri/src/settings.rs`. */
export const MIN_BPM = 40;
export const MAX_BPM = 200;

export type RhythmPracticeSettings = {
  bpm: number;
  difficulty: Difficulty;
  /** Used when `difficulty` is "custom". */
  custom: RhythmOptions;
  customMode: CustomMode;
  /** The user's own rhythm, in order. */
  written: Symbol[];
  timeSignature: TimeSignature;
  bars: number;
};

export type TimingResult = "onTime" | "early" | "late" | "missed";

/** Must match `ON_TIME_MS` / `MAX_WINDOW_MS` in `crates/rhythm/src/judge.rs`. */
export const ON_TIME_MS = 40;
export const MAX_WINDOW_MS = 150;
/** Must match `FAST_NOTE_GAP_MS` / `MIN_JUDGEABLE_GAP_MS` in `judge.rs`. */
export const FAST_NOTE_GAP_MS = 100;
export const MIN_JUDGEABLE_GAP_MS = 2 * ON_TIME_MS;

/** Result for one played note of the exercise (rests are not judged). */
export type Judgement = {
  bar: number;
  symbol: number;
  /** Expected start, beats from the exercise start. */
  beat: number;
  result: TimingResult;
  /** Played minus expected, ms (negative = early); null if missed. */
  offsetMs: number | null;
};

export type TimingSummary = {
  notes: number;
  onTime: number;
  early: number;
  late: number;
  missed: number;
  extra: number;
  accuracyPercent: number;
  hitPercent: number;
  /** < 0 rushing, > 0 dragging */
  meanOffsetMs: number | null;
  spreadMs: number | null;
};

export type TimingReport = {
  judgements: Judgement[];
  extraBeats: number[];
  summary: TimingSummary;
};

/** What a rhythm session does: judge the user, or play the exercise back. */
export type SessionMode = { kind: "practice" } | { kind: "listen"; note: string };

export type PracticeState =
  | { phase: "idle" }
  | {
      phase: "running";
      mode: SessionMode;
      /** Beats from the exercise start; negative during the count-in, null before the first click. */
      positionBeats: number | null;
      countInBeats: number;
      totalBeats: number;
    }
  | { phase: "finished"; report: TimingReport }
  | { phase: "failed"; message: string };

// ---- theory (crates/theory) ----

export type Letter = "c" | "d" | "e" | "f" | "g" | "a" | "b";

/** A written note. `accidental`: -2 double flat … 2 double sharp. Middle C = c4. */
export type Pitch = { letter: Letter; accidental: number; octave: number };

export type Clef = "treble" | "bass" | "alto";

export type Instrument =
  | "guitar"
  | "bassGuitar"
  | "keyboardTreble"
  | "keyboardBass"
  | "violin"
  | "viola"
  | "cello"
  | "doubleBass";

/** Display order; must match `Instrument::ALL`. */
export const INSTRUMENTS: readonly Instrument[] = [
  "guitar",
  "bassGuitar",
  "keyboardTreble",
  "keyboardBass",
  "violin",
  "viola",
  "cello",
  "doubleBass",
];

/** Exact pitch, or any octave as long as the shape stays the same. */
export type Matching = "exact" | "anyOctave";

export type TaskNote = {
  /** As written for the instrument. */
  written: Pitch;
  /** Sounding MIDI note to play. */
  midi: number;
  /** Shown before it is played (otherwise revealed once played). */
  given: boolean;
};

export type IntervalName =
  | "minorSecond"
  | "majorSecond"
  | "minorThird"
  | "majorThird"
  | "perfectFourth"
  | "tritone"
  | "perfectFifth"
  | "minorSixth"
  | "majorSixth"
  | "minorSeventh"
  | "majorSeventh"
  | "octave";

/** Smallest to largest; must match `IntervalName::ALL`. */
export const INTERVAL_NAMES: readonly IntervalName[] = [
  "minorSecond",
  "majorSecond",
  "minorThird",
  "majorThird",
  "perfectFourth",
  "tritone",
  "perfectFifth",
  "minorSixth",
  "majorSixth",
  "minorSeventh",
  "majorSeventh",
  "octave",
];

export type Direction = "up" | "down";

/** Interval directions to practise. */
export type Directions = "up" | "down" | "both";

export type ScaleKind =
  | "major"
  | "naturalMinor"
  | "harmonicMinor"
  | "melodicMinor"
  | "majorPentatonic"
  | "minorPentatonic"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian";

/** Display order; must match `ScaleKind::ALL`. */
export const SCALE_KINDS: readonly ScaleKind[] = [
  "major",
  "naturalMinor",
  "harmonicMinor",
  "melodicMinor",
  "majorPentatonic",
  "minorPentatonic",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "locrian",
];

/** What a task asks for. */
export type Prompt =
  | { kind: "note" }
  | { kind: "interval"; interval: IntervalName; direction: Direction }
  | { kind: "scale"; root: Pitch; scale: ScaleKind; upAndDown: boolean };

export type PitchTask = {
  prompt: Prompt;
  clef: Clef;
  notes: TaskNote[];
  matching: Matching;
  /** The notes are played to the user first (ear training). */
  playFirst: boolean;
};

export type NoteReadingOptions = {
  ledgerLines: boolean;
  accidentals: boolean;
  anyOctave: boolean;
};

export type IntervalOptions = {
  intervals: IntervalName[];
  directions: Directions;
  /** Show the second note too (reading practice). */
  showBoth: boolean;
};

export type ScaleOptions = {
  scales: ScaleKind[];
  /** Up to the octave and back down, instead of up only. */
  upAndDown: boolean;
  /** Show every note (reading practice), not only the root. */
  showNotes: boolean;
};

/** Pitch exercises; one Practice tab each. */
export type PitchExerciseKind = "notes" | "intervals" | "scales";

export type PitchPracticeSettings = {
  instrument: Instrument;
  notes: NoteReadingOptions;
  intervals: IntervalOptions;
  scales: ScaleOptions;
};

export type TaskStage = "listening" | "playing" | "solved" | "revealed";

export type PitchScore = {
  solved: number;
  /** Solved without a wrong note. */
  clean: number;
  skipped: number;
  wrongNotes: number;
};

export type PitchPracticeState =
  | { phase: "idle" }
  | {
      phase: "running";
      exercise: PitchExerciseKind;
      task: PitchTask;
      stage: TaskStage;
      /** Notes of the task played correctly so far. */
      progress: number;
      /** Last wrong note of this task, as written (e.g. "D#4"). */
      wrong: string | null;
      /** The note heard right now, as written. */
      heard: string | null;
      /** Current task number, from 1. */
      round: number;
      score: PitchScore;
    }
  | { phase: "finished"; exercise: PitchExerciseKind; score: PitchScore }
  | { phase: "failed"; message: string };

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
  practice: { rhythm: RhythmPracticeSettings; pitch: PitchPracticeSettings };
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
  | { type: "practice"; practice: PracticeState }
  | { type: "practiceJudged"; judgements: Judgement[] }
  | { type: "pitchPractice"; pitch: PitchPracticeState }
  | { type: "settings"; settings: Settings };

export type EngineSnapshot = {
  subscriptionId: number;
  status: EngineStatus;
  settings: Settings;
  calibration: CalibrationState;
  practice: PracticeState;
  pitch: PitchPracticeState;
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

export const setRhythmSettings = (rhythm: RhythmPracticeSettings) =>
  invoke<Settings>("set_rhythm_settings", { rhythm });

/** The exercise for the saved settings: a new random one, or the written rhythm. */
export const generateRhythmExercise = () => invoke<ExerciseDraft>("generate_rhythm_exercise");

export const startRhythmPractice = (exercise: Exercise) =>
  invoke<void>("start_rhythm_practice", { exercise });

/** Play the exercise back as tones on a random note (with count-in and metronome). */
export const listenToRhythm = (exercise: Exercise) =>
  invoke<void>("listen_to_rhythm", { exercise });

export const stopRhythmPractice = () => invoke<void>("stop_rhythm_practice");

export const setPitchSettings = (pitch: PitchPracticeSettings) =>
  invoke<Settings>("set_pitch_settings", { pitch });

/** Start a pitch exercise with its saved options; tasks follow until stopped. */
export const startPitchPractice = (exercise: PitchExerciseKind) =>
  invoke<void>("start_pitch_practice", { exercise });

export const stopPitchPractice = () => invoke<void>("stop_pitch_practice");

/** Show the current task's answer and move on. */
export const skipPitchTask = () => invoke<void>("skip_pitch_task");

/** Play the current task's notes (again); the task restarts. */
export const replayPitchTask = () => invoke<void>("replay_pitch_task");

export const openMicrophonePrivacySettings = () =>
  invoke<void>("open_microphone_privacy_settings");
