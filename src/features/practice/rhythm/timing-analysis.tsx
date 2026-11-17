import { AlertTriangle } from "lucide-react";

import { Display, Panel, PanelLabel, Readout, StatusStrip, Tip, type Tone } from "@/components/rack";
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

const pad = (n: number) => String(n).padStart(2, "0");

/** Live timing read-outs while playing (one tile each, to sit in a row with
 * other read-outs). */
export function LiveTimingCounts({ judgements }: { judgements: Judgement[] }) {
  const count = (r: TimingResult) => judgements.filter((j) => j.result === r).length;
  const items: { label: string; value: number; tone: Tone }[] = [
    { label: "On time", value: count("onTime"), tone: "ok" },
    { label: "Early/late", value: count("early") + count("late"), tone: "warn" },
    { label: "Missed", value: count("missed"), tone: "bad" },
  ];
  return (
    <>
      {items.map((i) => (
        <Readout
          key={i.label}
          label={i.label}
          value={pad(i.value)}
          tone={i.tone}
          className="flex-[1_1_5rem] text-center"
        />
      ))}
    </>
  );
}

const ms = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}`;

function tendency(mean: number | null) {
  if (mean === null) return null;
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
    <Display className="flex gap-2 p-2.5 sm:px-2.5 sm:py-2.5">
      <div className="flex flex-col justify-between py-1 font-mono text-[10px] text-muted-foreground uppercase">
        <span>late</span>
        <span>on time</span>
        <span>early</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        aria-label="Timing offset of each note"
        preserveAspectRatio="none"
      >
        <rect
          x={0}
          width={width}
          y={y(ON_TIME_MS)}
          height={y(-ON_TIME_MS) - y(ON_TIME_MS)}
          className="fill-emerald-500/10"
        />
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} className="stroke-border" />
        {barStarts.map((i) => (
          <line
            key={i}
            x1={(x(i - 1) + x(i)) / 2}
            x2={(x(i - 1) + x(i)) / 2}
            y1={0}
            y2={height}
            strokeDasharray="3 4"
            className="stroke-border"
          />
        ))}
        {judgements.map((j, i) =>
          j.offsetMs === null ? (
            <text
              key={i}
              x={x(i)}
              y={height / 2 + 4}
              textAnchor="middle"
              className="fill-red-500 text-[13px] font-bold"
            >
              ×
            </text>
          ) : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(j.offsetMs)}
              r={4.5}
              className={cn("fill-current", RESULT_COLOR[j.result])}
            >
              <title>
                Bar {j.bar + 1}: {ms(j.offsetMs)} ms
              </title>
            </circle>
          ),
        )}
      </svg>
    </Display>
  );
}

/** After playing with the metronome: how the timing went, with a chart of
 * every note's offset and tips. */
export function TimingAnalysis({
  report,
  calibrated,
  minGapMs,
  className,
}: {
  report: TimingReport;
  calibrated: boolean;
  /** Shortest gap between notes of the played exercise, ms. */
  minGapMs: number | null;
  className?: string;
}) {
  const s = report.summary;
  const trend = tendency(s.meanOffsetMs);
  return (
    <Panel aria-label="Timing" className={cn("flex flex-col gap-3.5", className)}>
      <PanelLabel>Timing</PanelLabel>
      {!calibrated && (
        <StatusStrip tone="warn">
          <AlertTriangle className="size-4 shrink-0" />
          Not calibrated: results include your setup's latency.
        </StatusStrip>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
        <Readout
          size="lg"
          label="Accuracy"
          value={`${Math.round(s.accuracyPercent)}%`}
          tone={s.accuracyPercent >= 75 ? "ok" : "warn"}
          className="p-3"
        />
        <Readout
          size="lg"
          label="Notes played"
          value={`${Math.round(s.hitPercent)}%`}
          tone="signal"
          className="p-3"
        />
        <Readout
          size="lg"
          label="Avg offset"
          value={s.meanOffsetMs === null ? "–" : ms(s.meanOffsetMs)}
          unit={s.meanOffsetMs === null ? undefined : "MS"}
          className="p-3"
        />
        <Readout
          size="lg"
          label="Consistency"
          value={s.spreadMs === null ? "–" : `±${Math.round(s.spreadMs)}`}
          unit={s.spreadMs === null ? undefined : "MS"}
          className="p-3"
        />
        <Readout size="lg" label="Extra hits" value={s.extra} className="p-3" />
      </div>
      <p className="text-xs text-muted-foreground">
        On time = within ±{ON_TIME_MS} ms of the beat, corrected by your calibrated latency.{" "}
        {s.notes - s.missed} of {s.notes} notes played
        {trend ? `; on average ${trend}.` : "."}
      </p>
      <OffsetChart judgements={report.judgements} />
      <div className="flex flex-col gap-2">
        {tips(s, calibrated, minGapMs).map((t) => (
          <Tip key={t}>{t}</Tip>
        ))}
      </div>
    </Panel>
  );
}
