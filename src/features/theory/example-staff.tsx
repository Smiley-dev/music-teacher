import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { type ExampleScore, renderExample } from "./render-example";

type ExampleStaffProps = {
  score: ExampleScore;
  /** What the example shows, for screen readers. */
  label: string;
  className?: string;
};

/** A Theory example in notation. Redraws when the score or the width changes. */
export function ExampleStaff({ score, label, className }: ExampleStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Scores are usually written inline; draw again only if one differs.
  const key = JSON.stringify(score);
  const drawn = useMemo(() => score, [key]);

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
      renderExample(el, drawn, width);
      setError(null);
    } catch (e) {
      el.replaceChildren();
      setError(String(e));
    }
  }, [drawn, width, fontsReady]);

  return (
    <div className={cn("flex w-full justify-center", className)}>
      {error && <p className="text-sm text-destructive">Could not draw the example: {error}</p>}
      <div ref={containerRef} role="img" aria-label={label} className="theory-staff text-foreground" />
    </div>
  );
}
