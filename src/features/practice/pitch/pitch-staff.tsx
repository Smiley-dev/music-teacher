import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Clef, Pitch } from "@/lib/engine";
import { cn } from "@/lib/utils";

import { renderStaff } from "./render-staff";

/** How a note of the task is shown. */
export type NoteState =
  /** Shown, not played yet. */
  | "given"
  /** The next note to play (shown). */
  | "next"
  /** Not shown until played. */
  | "hidden"
  /** Played correctly. */
  | "correct"
  /** Shown as the answer after skipping. */
  | "answer";

const STATE_CLASSES: Record<NoteState, string | null> = {
  given: null,
  next: "vf-next",
  hidden: "vf-hidden",
  correct: "vf-correct",
  answer: "vf-answer",
};

type PitchStaffProps = {
  clef: Clef;
  notes: Pitch[];
  /** One per note. */
  states: NoteState[];
  className?: string;
};

/** Notes on a staff. Re-renders only when the notes change; states are class
 * toggles. */
export function PitchStaff({ clef, notes, states, className }: PitchStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elements = useRef<(SVGElement | undefined)[]>([]);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Events carry a fresh copy of the task; draw again only if it differs
  // (`key` stands for `clef` and `notes`).
  const key = JSON.stringify([clef, notes]);
  const drawn = useMemo(() => ({ clef, notes }), [key]);

  useEffect(() => {
    let alive = true;
    document.fonts
      .load("30px Bravura")
      .catch(() => [])
      .finally(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || width === 0 || !fontsReady) return;
    try {
      elements.current = renderStaff(el, drawn.clef, drawn.notes, width);
      setError(null);
    } catch (e) {
      elements.current = [];
      setError(String(e));
    }
  }, [drawn, width, fontsReady]);

  // Re-applied after every redraw; `stateKey` stands for `states`.
  const stateKey = states.join();
  useLayoutEffect(() => {
    const all = Object.values(STATE_CLASSES).filter((c) => c !== null);
    const current = stateKey.split(",") as NoteState[];
    elements.current.forEach((el, i) => {
      el?.classList.remove(...all);
      const cls = STATE_CLASSES[current[i] ?? "given"];
      if (cls) el?.classList.add(cls);
    });
  }, [stateKey, drawn, width, fontsReady]);

  return (
    <div className={cn("flex w-full justify-center", className)}>
      {error && <p className="text-sm text-destructive">Could not draw the notes: {error}</p>}
      <div ref={containerRef} className="pitch-staff text-foreground" />
    </div>
  );
}
