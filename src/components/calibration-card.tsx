import { useEffect, useState } from "react";
import { AlertTriangle, Headphones, Play, X } from "lucide-react";

import { Display, Lamp, Panel, PanelLabel, StatusStrip } from "@/components/rack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type CalibrationState, type LatencyCalibration, MAX_ABS_LATENCY_MS } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useEngine, usePractice } from "@/providers/audio-engine-context";

export const CALIBRATION_TITLE = "Instrument calibration";
export const CALIBRATION_DESCRIPTION =
  "Measures how late your playing reaches the app (round-trip latency: output, input and your reaction), so Practice can correct your timing.";

/** Calibration in a panel, for the Settings screen. */
export function CalibrationCard({ className }: { className?: string }) {
  return (
    <Panel aria-labelledby="calibration-title" className={cn("flex flex-col gap-3.5", className)}>
      <PanelLabel>03 · Latency</PanelLabel>
      <h2 id="calibration-title" className="text-lg font-extrabold">
        {CALIBRATION_TITLE}
      </h2>
      <p className="leading-relaxed text-muted-foreground">{CALIBRATION_DESCRIPTION}</p>
      <CalibrationPanel />
    </Panel>
  );
}

/** The calibration procedure, result and manual latency editor. Shared by
 * Settings and the Practice screens (in a dialog). */
export function CalibrationPanel() {
  const { status, settings, calibration, startCalibration, cancelCalibration } = useEngine();
  const practicing = usePractice().phase === "running";
  const [error, setError] = useState<string | null>(null);
  const running = calibration.phase === "running";

  const start = () => {
    setError(null);
    startCalibration().catch((e) => setError(String(e)));
  };

  if (running) {
    return <BeatCounter calibration={calibration} onCancel={() => cancelCalibration()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <LatencyDisplay latency={settings.latency} />
      <CalibrationResult calibration={calibration} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Press Start. You'll hear 4 bars of clicks at 90 BPM on your default output device.</li>
        <li>Play any single note exactly on each click.</li>
        <li>The result is saved automatically.</li>
      </ol>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Headphones className="size-4 shrink-0 text-signal" />
        Using a microphone? Wear headphones so the click isn't picked up.
      </p>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
        <Button
          size="lg"
          onClick={start}
          disabled={status.state !== "running" || practicing}
        >
          <Play className="fill-current" />
          {calibration.phase === "failed" ? "Try again" : "Start calibration"}
        </Button>
        <LatencyEditor latency={settings.latency} disabled={running} />
      </div>
      {status.state !== "running" && (
        <p className="text-sm text-muted-foreground">Calibration needs a working input device.</p>
      )}
      {practicing && (
        <p className="text-sm text-muted-foreground">Stop the practice session to calibrate.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** The latency in use, large, with where it came from. */
function LatencyDisplay({ latency }: { latency: LatencyCalibration | null }) {
  return (
    <Display className="flex flex-wrap items-center gap-5 px-[18px] py-4 font-mono sm:px-[18px] sm:py-4">
      <div>
        <div className="text-[10px] tracking-[0.14em] text-muted-foreground">
          ROUND-TRIP LATENCY
        </div>
        <div
          className={cn(
            "text-[44px] leading-[1.1] font-bold tabular-nums",
            latency ? "text-signal" : "text-muted-foreground/40",
          )}
        >
          {latency ? latency.ms.toFixed(1) : "– –"}
          <span className="text-lg text-muted-foreground"> MS</span>
        </div>
        <div className="text-[11px] text-muted-foreground uppercase">{describeLatency(latency)}</div>
      </div>
    </Display>
  );
}

/** While the clicks play: bar and beat, one cell per click, and Cancel. */
function BeatCounter({
  calibration,
  onCancel,
}: {
  calibration: Extract<CalibrationState, { phase: "running" }>;
  onCancel: () => void;
}) {
  const { beat, beatsPerBar, totalClicks } = calibration;
  const bars = totalClicks / beatsPerBar;
  const finished = beat >= totalClicks;
  const bar = beat === 0 ? 0 : Math.ceil(beat / beatsPerBar);
  const beatInBar = beat === 0 ? 0 : ((beat - 1) % beatsPerBar) + 1;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div>
        <PanelLabel tone="signal">
          Calibrating · 90 BPM · {totalClicks} clicks
        </PanelLabel>
        <p className="mt-1 text-[22px] font-extrabold">
          {beat === 0
            ? "Get ready… the first click is coming."
            : finished
              ? "Listening for your last note…"
              : "Play any note on each click"}
        </p>
      </div>
      <Display className="flex flex-wrap items-center gap-5 px-[18px] py-4 sm:px-[18px] sm:py-4">
        <div className="font-mono">
          <div className="text-[10px] tracking-[0.14em] text-muted-foreground">BAR · BEAT</div>
          <div className="text-5xl leading-none font-bold text-signal tabular-nums">
            {bar}·{beatInBar}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">OF {bars} BARS</div>
        </div>
        <div
          className="grid min-w-60 flex-1 gap-1"
          style={{ gridTemplateColumns: `repeat(${totalClicks}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`Click ${Math.min(beat, totalClicks)} of ${totalClicks}`}
        >
          {Array.from({ length: totalClicks }, (_, i) => {
            const now = i + 1 === beat && !finished;
            return (
              <span
                key={i}
                className={cn(
                  "h-9 rounded-[4px]",
                  now
                    ? "bg-primary shadow-[0_0_12px_var(--primary)]"
                    : i + 1 < beat || finished
                      ? "bg-primary/35"
                      : "bg-muted",
                  i % beatsPerBar === 0 && "ring-1 ring-muted-foreground/40",
                )}
              />
            );
          })}
        </div>
      </Display>
      <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-primary" />
          NOW
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-primary/35" />
          PLAYED
        </span>
        <span>OUTLINED: BEAT 1 OF EACH BAR (ACCENTED)</span>
      </div>
      <StatusStrip tone="warn" className="font-sans text-sm font-normal tracking-normal">
        <Headphones className="size-4 shrink-0" />
        Using a microphone? Wear headphones so the clicks don't leak into the input. Use the same
        kind of note you practise with.
      </StatusStrip>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          The result is saved when the clicks end. Play one clear note on every click.
        </span>
        <Button size="lg" variant="outline" onClick={onCancel}>
          <X />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CalibrationResult({ calibration }: { calibration: CalibrationState }) {
  if (calibration.phase === "done") {
    const { latency, rejected } = calibration;
    return (
      <StatusStrip tone="ok" className="font-sans text-sm tracking-normal">
        <Lamp on tone="ok" />
        <span>
          Measured {latency.ms.toFixed(1)} ms.{" "}
          <span className="font-normal">
            Matched {latency.matched} of {latency.totalClicks} clicks
            {rejected > 0 && ` (${rejected} outlier${rejected > 1 ? "s" : ""} ignored)`}.
          </span>
        </span>
      </StatusStrip>
    );
  }
  if (calibration.phase === "failed") {
    return (
      <StatusStrip tone="bad" className="items-start font-sans text-sm tracking-normal">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Couldn't calibrate, try again.{" "}
          <span className="font-normal">
            {calibration.matched !== null
              ? `Only ${calibration.matched} of ${calibration.totalClicks} clicks matched a played note. Play one clear note right on each click.`
              : calibration.message}
          </span>
        </span>
      </StatusStrip>
    );
  }
  return null;
}

/** One line about the saved latency, e.g. "Measured, 15 of 16 clicks matched." */
export function describeLatency(latency: LatencyCalibration | null) {
  if (!latency) return "Not calibrated yet.";
  if (latency.source === "manual") return "Entered manually.";
  return `Measured, ${latency.matched} of ${latency.totalClicks} clicks matched.`;
}

function LatencyEditor({
  latency,
  disabled,
}: {
  latency: LatencyCalibration | null;
  disabled: boolean;
}) {
  const { setLatencyMs } = useEngine();
  const savedText = latency ? latency.ms.toFixed(1) : "";
  const [text, setText] = useState(savedText);
  const [error, setError] = useState<string | null>(null);

  // Show new values (e.g. after a calibration) when they arrive.
  useEffect(() => setText(savedText), [savedText]);

  const parsed = text.trim() === "" ? null : Number(text);
  const valid = parsed !== null && Number.isFinite(parsed) && Math.abs(parsed) <= MAX_ABS_LATENCY_MS;
  const changed = valid && (latency === null || Math.abs(parsed - latency.ms) >= 0.05);

  const save = (ms: number | null) => {
    setError(null);
    setLatencyMs(ms).catch((e) => setError(String(e)));
  };

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && changed) save(parsed);
      }}
    >
      <Label htmlFor="latency-ms" className="rack-label text-[10px]">
        Or enter it (ms)
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="latency-ms"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={-MAX_ABS_LATENCY_MS}
          max={MAX_ABS_LATENCY_MS}
          placeholder="Not set"
          className="h-10 w-28 bg-inset font-mono font-bold"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.currentTarget.value)}
          aria-invalid={text.trim() !== "" && !valid}
        />
        <Button type="submit" variant="outline" disabled={disabled || !changed}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || latency === null}
          onClick={() => save(null)}
        >
          Reset
        </Button>
      </div>
      {text.trim() !== "" && !valid && (
        <p className="text-sm text-destructive">
          Enter a number between -{MAX_ABS_LATENCY_MS} and {MAX_ABS_LATENCY_MS}.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
