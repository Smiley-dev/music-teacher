import { createContext, useContext } from "react";

import type {
  CalibrationState,
  DeviceId,
  EngineStatus,
  Exercise,
  Frame,
  Judgement,
  PracticeState,
  RhythmPracticeSettings,
  Settings,
} from "@/lib/engine";

export type EngineContextValue = {
  status: EngineStatus;
  settings: Settings;
  calibration: CalibrationState;
  setInputDevice: (device: DeviceId) => Promise<void>;
  setGainDb: (gainDb: number) => Promise<void>;
  /** `null` resets the calibration. */
  setLatencyMs: (ms: number | null) => Promise<void>;
  startCalibration: () => Promise<void>;
  cancelCalibration: () => Promise<void>;
  setRhythmSettings: (rhythm: RhythmPracticeSettings) => Promise<void>;
  startRhythmPractice: (exercise: Exercise) => Promise<void>;
  /** Play the exercise back so the user can hear it. */
  listenToRhythm: (exercise: Exercise) => Promise<void>;
  stopRhythmPractice: () => Promise<void>;
};

/** Rarely changing engine state and actions. */
export const EngineContext = createContext<EngineContextValue | null>(null);
/** Latest analysis frame (~30 updates/s); kept separate so only components
 * that draw live data re-render that often. */
export const FrameContext = createContext<Frame | null>(null);
export type PracticeContextValue = {
  state: PracticeState;
  /** Notes judged in the current (or last finished) session, in order. */
  judgements: Judgement[];
};

/** Practice session state; updates ~30 times/s while a session runs. */
export const PracticeContext = createContext<PracticeContextValue>({
  state: { phase: "idle" },
  judgements: [],
});

export function useEngine(): EngineContextValue {
  const value = useContext(EngineContext);
  if (!value) throw new Error("useEngine must be used inside <AudioEngineProvider>");
  return value;
}

/** The latest analysis frame, or `null` while no stream is running. */
export function useFrame(): Frame | null {
  return useContext(FrameContext);
}

/** The current practice session state (position on the audio clock). */
export function usePractice(): PracticeState {
  return useContext(PracticeContext).state;
}

/** Timing judgements of the current or last session, live while playing. */
export function usePracticeJudgements(): Judgement[] {
  return useContext(PracticeContext).judgements;
}

export function useSettings(): Settings {
  return useEngine().settings;
}

/**
 * Saved round-trip latency in ms (output + input + reaction offset,
 * ADR 0003), or `null` if not calibrated. Practice subtracts this from
 * detected onset times.
 */
export function useLatency(): number | null {
  return useEngine().settings.latency?.ms ?? null;
}
