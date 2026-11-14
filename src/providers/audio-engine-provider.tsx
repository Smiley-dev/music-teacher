import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import * as engine from "@/lib/engine";
import type {
  EngineEvent,
  EngineSnapshot,
  Frame,
  PitchPracticeState,
  ReadingState,
} from "@/lib/engine";
import {
  EngineContext,
  type EngineContextValue,
  FrameContext,
  PitchPracticeContext,
  PracticeContext,
  type PracticeContextValue,
  ReadingContext,
} from "./audio-engine-context";

/** Practice state plus the judgements collected for the current session. */
function applyPracticeEvent(p: PracticeContextValue, event: EngineEvent): PracticeContextValue {
  if (event.type === "practiceJudged") {
    return { ...p, judgements: [...p.judgements, ...event.judgements] };
  }
  if (event.type !== "practice") return p;
  const next = event.practice;
  if (next.phase === "finished") return { state: next, judgements: next.report.judgements };
  const starting = next.phase === "running" && p.state.phase !== "running";
  return { state: next, judgements: starting ? [] : p.judgements };
}

/** Rarely changing state; frames and practice progress live separately. */
type State = Omit<EngineSnapshot, "subscriptionId" | "practice" | "pitch" | "reading">;

function applyPitchEvent(p: PitchPracticeState, event: EngineEvent): PitchPracticeState {
  return event.type === "pitchPractice" ? event.pitch : p;
}

function applyReadingEvent(r: ReadingState, event: EngineEvent): ReadingState {
  return event.type === "reading" ? event.reading : r;
}

function applyEvent(state: State, event: EngineEvent): State {
  switch (event.type) {
    case "status":
      return { ...state, status: event.status };
    case "settings":
      return { ...state, settings: event.settings };
    case "calibration":
      return { ...state, calibration: event.calibration };
    case "frame":
    case "practice":
    case "practiceJudged":
    case "pitchPractice":
    case "reading":
      return state;
  }
}

/**
 * Subscribes once to the shared audio engine (ADR 0005) and provides its
 * state to every screen. Mounted at the app root so navigation never
 * restarts audio.
 */
export function AudioEngineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [practice, setPractice] = useState<PracticeContextValue>({
    state: { phase: "idle" },
    judgements: [],
  });
  const [pitch, setPitch] = useState<PitchPracticeState>({ phase: "idle" });
  const [reading, setReading] = useState<ReadingState>({ phase: "idle" });
  const [connectError, setConnectError] = useState<string | null>(null);
  // Events that arrive before the snapshot are replayed on top of it.
  const pending = useRef<EngineEvent[]>([]);

  useEffect(() => {
    let active = true;
    let subscriptionId: number | null = null;
    let ready = false;

    const onEvent = (event: EngineEvent) => {
      if (!active) return;
      if (event.type === "frame") {
        setFrame(event.frame);
        return;
      }
      if (event.type === "status" && event.status.state !== "running") setFrame(null);
      if (!ready) {
        pending.current.push(event);
        return;
      }
      if (event.type === "practice" || event.type === "practiceJudged") {
        setPractice((p) => applyPracticeEvent(p, event));
        return;
      }
      if (event.type === "reading") {
        setReading(event.reading);
        return;
      }
      if (event.type === "pitchPractice") {
        setPitch(event.pitch);
        return;
      }
      setState((s) => (s ? applyEvent(s, event) : s));
    };

    engine
      .subscribeEngine(onEvent)
      .then((full) => {
        const { subscriptionId: id, practice: initialPractice, pitch, reading, ...snapshot } = full;
        subscriptionId = id;
        if (!active) {
          engine.unsubscribeEngine(id).catch(() => {});
          return;
        }
        ready = true;
        const queued = pending.current;
        pending.current = [];
        setState(queued.reduce(applyEvent, snapshot));
        const initial: PracticeContextValue = {
          state: initialPractice,
          judgements: initialPractice.phase === "finished" ? initialPractice.report.judgements : [],
        };
        setPractice(queued.reduce(applyPracticeEvent, initial));
        setPitch(queued.reduce(applyPitchEvent, pitch));
        setReading(queued.reduce(applyReadingEvent, reading));
      })
      .catch((e) => active && setConnectError(String(e)));

    return () => {
      active = false;
      if (subscriptionId !== null) engine.unsubscribeEngine(subscriptionId).catch(() => {});
    };
  }, []);

  const value = useMemo<EngineContextValue | null>(() => {
    if (!state) return null;
    // Commands broadcast their results as events, so state updates there.
    const run = async (command: Promise<unknown>) => {
      await command;
    };
    return {
      ...state,
      setInputDevice: (device) => run(engine.setInputDevice(device)),
      setGainDb: (gainDb) => run(engine.setGainDb(gainDb)),
      setLatencyMs: (ms) => run(engine.setLatencyMs(ms)),
      startCalibration: () => run(engine.startCalibration()),
      cancelCalibration: () => run(engine.cancelCalibration()),
      setRhythmSettings: (rhythm) => run(engine.setRhythmSettings(rhythm)),
      startRhythmPractice: (exercise) => run(engine.startRhythmPractice(exercise)),
      listenToRhythm: (exercise) => run(engine.listenToRhythm(exercise)),
      stopRhythmPractice: () => run(engine.stopRhythmPractice()),
      setPitchSettings: (pitch) => run(engine.setPitchSettings(pitch)),
      startPitchPractice: (exercise) => run(engine.startPitchPractice(exercise)),
      stopPitchPractice: () => run(engine.stopPitchPractice()),
      skipPitchTask: () => run(engine.skipPitchTask()),
      replayPitchTask: () => run(engine.replayPitchTask()),
      setReadingSettings: (reading) => run(engine.setReadingSettings(reading)),
      listenToReading: (exercise) => run(engine.listenToReading(exercise)),
      startReadingPractice: (exercise) => run(engine.startReadingPractice(exercise)),
      stopReadingPractice: () => run(engine.stopReadingPractice()),
    };
  }, [state]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        {connectError ? (
          <>
            <AlertTriangle className="size-4 text-destructive" />
            Could not connect to the audio engine: {connectError}
          </>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" />
            Starting audio engine…
          </>
        )}
      </div>
    );
  }

  return (
    <EngineContext.Provider value={value}>
      <FrameContext.Provider value={frame}>
        <PracticeContext.Provider value={practice}>
          <PitchPracticeContext.Provider value={pitch}>
            <ReadingContext.Provider value={reading}>{children}</ReadingContext.Provider>
          </PitchPracticeContext.Provider>
        </PracticeContext.Provider>
      </FrameContext.Provider>
    </EngineContext.Provider>
  );
}
