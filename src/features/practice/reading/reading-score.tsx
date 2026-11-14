import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ReadingExercise } from "@/lib/engine";
import { cn } from "@/lib/utils";

import { type RenderedReading, renderReading } from "./render-reading";

/** A note of the melody: bar and symbol index. */
export type Slot = { bar: number; symbol: number };

export const slotKey = (s: Slot) => `${s.bar}:${s.symbol}`;

/** CSS classes for note states (styled under `.reading-score` in index.css). */
export const NOTE_CLASSES = {
  active: "vf-active",
  correct: "vf-correct",
  onTime: "vf-onTime",
  early: "vf-early",
  late: "vf-late",
  missed: "vf-missed",
  wrongPitch: "vf-wrongPitch",
} as const;

const ALL_CLASSES = Object.values(NOTE_CLASSES);

type ReadingScoreProps = {
  exercise: ReadingExercise;
  /** Class per note (`slotKey`), e.g. correct or a timing result. */
  classes: ReadonlyMap<string, string>;
  /** The note being played or to play next; highlighted and kept in view. */
  active: Slot | null;
  className?: string;
};

/** The melody in notation. Re-renders on exercise/width change only; note
 * states are class toggles so 30 Hz cursor updates stay cheap. */
export function ReadingScore({ exercise, classes, active, className }: ReadingScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<RenderedReading | null>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const el = containerRef.current;
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
      rendered.current = renderReading(el, exercise, width);
      setError(null);
    } catch (e) {
      rendered.current = null;
      setError(String(e));
    }
  }, [exercise, width, fontsReady]);

  // Note states, re-applied after every redraw.
  useLayoutEffect(() => {
    const score = rendered.current;
    if (!score) return;
    score.notes.forEach((bar, b) =>
      bar.forEach((el, s) => {
        if (!el) return;
        el.classList.remove(...ALL_CLASSES);
        const cls = classes.get(slotKey({ bar: b, symbol: s }));
        if (cls) el.classList.add(cls);
        if (active && active.bar === b && active.symbol === s) {
          el.classList.add(NOTE_CLASSES.active);
        }
      }),
    );
  }, [classes, active, exercise, width, fontsReady]);

  // Keep the active note's line in view.
  const activeBar = active?.bar ?? null;
  useEffect(() => {
    const score = rendered.current;
    if (activeBar === null || !score) return;
    const top = score.barTops[activeBar];
    containerRef.current
      ?.closest("[data-score-scroll]")
      ?.scrollTo({ top: Math.max(0, (top ?? 0) - 20), behavior: "smooth" });
  }, [activeBar]);

  return (
    <div data-score-scroll className={cn("max-h-[30rem] overflow-y-auto", className)}>
      {error && <p className="text-sm text-destructive">Could not draw the notation: {error}</p>}
      <div ref={containerRef} className="reading-score w-full text-foreground" />
    </div>
  );
}
