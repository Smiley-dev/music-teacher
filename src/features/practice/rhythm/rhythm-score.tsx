import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Exercise, Judgement, TimingResult } from "@/lib/engine";
import { cn } from "@/lib/utils";

import { ACTIVE_NOTE_CLASS, type RenderedScore, renderScore } from "./render-score";

type RhythmScoreProps = {
  exercise: Exercise;
  /** The symbol to highlight, or null. */
  active: { bar: number; symbol: number } | null;
  /** Timing results to colour the notes with. */
  judgements: Judgement[];
  className?: string;
};

const RESULT_CLASSES: Record<TimingResult, string> = {
  onTime: "vf-onTime",
  early: "vf-early",
  late: "vf-late",
  missed: "vf-missed",
};

/** The exercise in notation. Re-renders on exercise/width change only; the
 * highlight is a class toggle so 30 Hz cursor updates stay cheap. */
export function RhythmScore({ exercise, active, judgements, className }: RhythmScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<RenderedScore | null>(null);
  const highlighted = useRef<SVGElement | undefined>(undefined);
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
      rendered.current = renderScore(el, exercise, width);
      highlighted.current = undefined;
      setError(null);
    } catch (e) {
      rendered.current = null;
      setError(String(e));
    }
  }, [exercise, width, fontsReady]);

  // Colour judged notes. Re-applied after every re-render of the score.
  useEffect(() => {
    const score = rendered.current;
    if (!score) return;
    const all = Object.values(RESULT_CLASSES);
    for (const bar of score.notes) for (const el of bar) el?.classList.remove(...all);
    for (const j of judgements) {
      score.notes[j.bar]?.[j.symbol]?.classList.add(RESULT_CLASSES[j.result]);
    }
  }, [judgements, exercise, width, fontsReady]);

  useEffect(() => {
    const score = rendered.current;
    const next = active ? score?.notes[active.bar]?.[active.symbol] : undefined;
    if (next === highlighted.current) return;
    highlighted.current?.classList.remove(ACTIVE_NOTE_CLASS);
    next?.classList.add(ACTIVE_NOTE_CLASS);
    highlighted.current = next;
    // Keep the current line in view.
    if (next && active && score) {
      const container = containerRef.current;
      const top = score.barTops[active.bar];
      container
        ?.closest("[data-score-scroll]")
        ?.scrollTo({ top: Math.max(0, top - 20), behavior: "smooth" });
    }
  }, [active, exercise, width, fontsReady]);

  return (
    <div data-score-scroll className={cn("max-h-[28rem] overflow-y-auto", className)}>
      {error && <p className="text-sm text-destructive">Could not draw the notation: {error}</p>}
      <div ref={containerRef} className="rhythm-score w-full text-foreground" />
    </div>
  );
}
