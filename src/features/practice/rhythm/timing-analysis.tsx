import { AlertTriangle, Lightbulb } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type Judgement,
  FAST_NOTE_GAP_MS,
  MAX_WINDOW_MS,
  MIN_JUDGEABLE_GAP_MS,
  ON_TIME_MS,
  type TimingReport,
  type TimingResult,
  type TimingSummary,
} from "@/lib/engine";
import { cn } from "@/lib/utils";

/** Mean offsets beyond this (ms) are called rushing/dragging. */
const TENDENCY_MS = 15;
/** Spread above this (ms) is called uneven. */
const UNEVEN_SPREAD_MS = 30;

const RESULT_COLOR: Record<TimingResult, string> = {
  onTime: "text-emerald-500",
  early: "text-amber-500",
  late: "text-amber-500",
  missed: "text-red-500",
};

/** Small live counters shown while playing. */
export function LiveTimingCounts({ judgements }: { judgements: Judgement[] }) {
  const count = (r: TimingResult) => judgements.filter((j) => j.result === r).length;
  const items: { label: string; result: TimingResult; value: number }[] = [
    { label: "On time", result: "onTime", value: count("onTime") },
    { label: "Early", result: "early", value: count("early") },
    { label: "Late", result: "late", value: count("late") },
    { label: "Missed", result: "missed", value: count("missed") },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full bg-current", RESULT_COLOR[i.result])} />
          {i.label}
          <span className="font-mono tabular-nums font-semibold">{i.value}</span>
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

const ms = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)} ms`;

function tendency(mean: number | null) {
  if (mean === null) return undefined;
  if (mean < -TENDENCY_MS) return "rushing (ahead of the beat)";
  if (mean > TENDENCY_MS) return "dragging (behind the beat)";
  return "centred on the beat";
}

function tips(s: TimingSummary, calibrated: boolean, minGapMs: number | null): string[] {
  const out: string[] = [];
  if (minGapMs !== null && minGapMs < MIN_JUDGEABLE_GAP_MS) {
    out.push(
      `This exercise was very fast (notes ${Math.round(minGapMs)} ms apart): early/late could not be judged reliably. Lower the tempo for meaningful timing results.`,
    );
  } else if (minGapMs !== null && minGapMs < FAST_NOTE_GAP_MS) {
    out.push(
      `Fast notes (${Math.round(minGapMs)} ms apart) are detected less reliably, especially low ones. Higher notes give more accurate results.`,
    );
  }
  if (!calibrated) {
    out.push(
      "Calibrate your instrument in Settings: without it, every note looks late by your setup's latency.",
    );
  }
  if (s.notes > 0 && s.missed / s.notes > 0.2) {
    out.push(
      "Many notes were not detected. Pick each note clearly, play higher notes (they are detected more reliably than low ones), check the input level in Settings, or raise the gain.",
    );
  }
  if (s.notes > 0 && s.extra / s.notes > 0.15) {
    out.push(
      "Extra hits were detected (double strikes, noise, or notes during rests). Mute the strings between notes; with a microphone, use headphones.",
    );
  }
  if (s.meanOffsetMs !== null && s.meanOffsetMs < -TENDENCY_MS) {
    out.push("You tend to rush. Listen for the click and let each note land on it.");
  }
  if (s.meanOffsetMs !== null && s.meanOffsetMs > TENDENCY_MS) {
    out.push("You tend to drag. Anticipate the click slightly and keep counting.");
  }
  if (s.spreadMs !== null && s.spreadMs > UNEVEN_SPREAD_MS) {
    out.push("Your timing varies a lot from note to note. Try the same exercise at a slower tempo.");
  }
  if (out.length === 0 || (calibrated && s.accuracyPercent >= 90)) {
    out.push("Great timing! Try a faster tempo or a harder level.");
  }
  return out;
}

/** Offset of every note over time: dots in the green band were on time. */
function OffsetChart({ judgements }: { judgements: Judgement[] }) {
  const width = 600;
  const height = 160;
  const pad = 8;
  const n = Math.max(1, judgements.length);
  const x = (i: number) => pad + ((i + 0.5) / n) * (width - 2 * pad);
  // Late is up, early is down.
  const y = (offset: number) =>
    height / 2 - (Math.max(-MAX_WINDOW_MS, Math.min(MAX_WINDOW_MS, offset)) / MAX_WINDOW_MS) * (height / 2 - pad);
  const barStarts = judgements
    .map((j, i) => (i > 0 && j.bar !== judgements[i - 1].bar ? i : null))
    .filter((i): i is number => i !== null);

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground">
        <span>late</span>
        <span>on time</span>
        <span>early</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full rounded-md bg-muted"
        role="img"
        aria-label="Timing offset of each note"
        preserveAspectRatio="none"
      >
        <rect
          x={0}
          width={width}
          y={y(ON_TIME_MS)}
          height={y(-ON_TIME_MS) - y(ON_TIME_MS)}
          className="fill-emerald-500/15"
        />
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} className="stroke-foreground/30" />
        {barStarts.map((i) => (
          <line
            key={i}
            x1={(x(i - 1) + x(i)) / 2}
            x2={(x(i - 1) + x(i)) / 2}
            y1={0}
            y2={height}
            className="stroke-foreground/10"
          />
        ))}
        {judgements.map((j, i) =>
          j.offsetMs === null ? (
            <text
              key={i}
              x={x(i)}
              y={height - 4}
              textAnchor="middle"
              className="fill-red-500 text-[11px] font-bold"
            >
              ×
            </text>
          ) : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(j.offsetMs)}
              r={3.5}
              className={cn("fill-current", RESULT_COLOR[j.result])}
            >
              <title>
                Bar {j.bar + 1}: {ms(j.offsetMs)}
              </title>
            </circle>
          ),
        )}
      </svg>
    </div>
  );
}

export function TimingAnalysis({
  report,
  calibrated,
  minGapMs,
}: {
  report: TimingReport;
  calibrated: boolean;
  /** Shortest gap between notes of the played exercise, ms. */
  minGapMs: number | null;
}) {
  const s = report.summary;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your timing</CardTitle>
        <CardDescription>
          On time = within ±{ON_TIME_MS} ms of the beat. Offsets are corrected by your calibrated
          latency.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!calibrated && (
          <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            Not calibrated: results include your setup's latency.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Accuracy" value={`${Math.round(s.accuracyPercent)}%`} hint="notes on time" />
          <Stat label="Notes played" value={`${Math.round(s.hitPercent)}%`} hint={`${s.notes - s.missed} of ${s.notes}`} />
          <Stat
            label="Average offset"
            value={s.meanOffsetMs === null ? "–" : ms(s.meanOffsetMs)}
            hint={tendency(s.meanOffsetMs)}
          />
          <Stat
            label="Consistency"
            value={s.spreadMs === null ? "–" : `±${Math.round(s.spreadMs)} ms`}
            hint="lower is steadier"
          />
        </div>
        <LiveTimingCounts judgements={report.judgements} />
        {s.extra > 0 && (
          <p className="text-sm text-muted-foreground">
            {s.extra} extra hit{s.extra > 1 ? "s" : ""} that matched no note.
          </p>
        )}
        <OffsetChart judgements={report.judgements} />
        <ul className="flex flex-col gap-2">
          {tips(s, calibrated, minGapMs).map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
              {t}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
