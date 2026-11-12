import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import * as engine from "@/lib/engine";
import type { EngineEvent, EngineSnapshot, Frame, PracticeState } from "@/lib/engine";
import {
  EngineContext,
  type EngineContextValue,
  FrameContext,
  PracticeContext,
} from "./audio-engine-context";

/** Rarely changing state; frames and practice progress live separately. */
type State = Omit<EngineSnapshot, "subscriptionId" | "practice">;

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
  const [practice, setPractice] = useState<PracticeState>({ phase: "idle" });
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
      if (event.type === "practice") {
        setPractice(event.practice);
        return;
      }
      setState((s) => (s ? applyEvent(s, event) : s));
    };

    engine
      .subscribeEngine(onEvent)
      .then(({ subscriptionId: id, practice: initialPractice, ...snapshot }) => {
        subscriptionId = id;
        if (!active) {
          engine.unsubscribeEngine(id).catch(() => {});
          return;
        }
        ready = true;
        const queued = pending.current;
        pending.current = [];
        setState(queued.reduce(applyEvent, snapshot));
        setPractice(
          queued.reduce<PracticeState>(
            (p, e) => (e.type === "practice" ? e.practice : p),
            initialPractice,
          ),
        );
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
      stopRhythmPractice: () => run(engine.stopRhythmPractice()),
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
        <PracticeContext.Provider value={practice}>{children}</PracticeContext.Provider>
      </FrameContext.Provider>
    </EngineContext.Provider>
  );
}
