import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import * as engine from "@/lib/engine";
import type { EngineEvent, EngineSnapshot, Frame } from "@/lib/engine";
import { EngineContext, type EngineContextValue, FrameContext } from "./audio-engine-context";

type State = Omit<EngineSnapshot, "subscriptionId">;

function applyEvent(state: State, event: EngineEvent): State {
  switch (event.type) {
    case "status":
      return { ...state, status: event.status };
    case "settings":
      return { ...state, settings: event.settings };
    case "calibration":
      return { ...state, calibration: event.calibration };
    case "frame":
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
      setState((s) => (s ? applyEvent(s, event) : s));
    };

    engine
      .subscribeEngine(onEvent)
      .then(({ subscriptionId: id, ...snapshot }) => {
        subscriptionId = id;
        if (!active) {
          engine.unsubscribeEngine(id).catch(() => {});
          return;
        }
        ready = true;
        setState(pending.current.reduce(applyEvent, snapshot));
        pending.current = [];
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
      <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
    </EngineContext.Provider>
  );
}
