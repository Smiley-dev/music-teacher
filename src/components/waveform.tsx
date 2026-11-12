import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type WaveformProps = {
  /** [min, max] pairs, -1..1, as sent in `Frame.waveform`. */
  points: number[];
  className?: string;
};

/** Draws the latest waveform frame on a canvas (cheap at 30 fps). */
export function Waveform({ points, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    const style = getComputedStyle(canvas);
    const mid = height / 2;

    // Centre line.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = style.color;
    ctx.fillRect(0, mid, width, Math.max(1, dpr));
    ctx.globalAlpha = 1;

    const buckets = points.length / 2;
    if (buckets < 1) return;
    const barWidth = width / buckets;
    for (let i = 0; i < buckets; i++) {
      const lo = Math.max(-1, Math.min(1, points[2 * i]));
      const hi = Math.max(-1, Math.min(1, points[2 * i + 1]));
      const top = mid - hi * mid;
      const bottom = mid - lo * mid;
      ctx.fillRect(i * barWidth, top, Math.max(barWidth, dpr), Math.max(bottom - top, dpr));
    }
  }, [points]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("h-24 w-full rounded-md bg-muted text-emerald-500", className)}
      aria-label="Live waveform"
      role="img"
    />
  );
}
