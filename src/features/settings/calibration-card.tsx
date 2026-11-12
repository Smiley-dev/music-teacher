import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Headphones, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type CalibrationState, type LatencyCalibration, MAX_ABS_LATENCY_MS } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useEngine } from "@/providers/audio-engine-context";

export function CalibrationCard() {
  const { status, settings, calibration, startCalibration, cancelCalibration } = useEngine();
  const [error, setError] = useState<string | null>(null);
  const running = calibration.phase === "running";

  const start = () => {
    setError(null);
    startCalibration().catch((e) => setError(String(e)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instrument calibration</CardTitle>
        <CardDescription>
          Measures how late your playing reaches the app (round-trip latency: output, input and
          your reaction), so Practice can correct your timing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {running ? (
          <BeatCounter calibration={calibration} onCancel={() => cancelCalibration()} />
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Press Start. You'll hear 4 bars of clicks at 90 BPM on your default output device.
              </li>
              <li>Play any single note exactly on each click.</li>
              <li>The result is saved automatically.</li>
            </ol>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Headphones className="size-4 shrink-0" />
              Using a microphone? Wear headphones so the click isn't picked up.
            </p>
            <CalibrationResult calibration={calibration} />
            <Button
              className="self-start"
              onClick={start}
              disabled={status.state !== "running"}
            >
              <Play />
              {calibration.phase === "failed" ? "Try again" : "Start calibration"}
            </Button>
            {status.state !== "running" && (
              <p className="text-sm text-muted-foreground">
                Calibration needs a working input device.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}

        <div className="border-t pt-5">
          <LatencyEditor latency={settings.latency} disabled={running} />
        </div>
      </CardContent>
    </Card>
  );
}

function BeatCounter({
  calibration,
  onCancel,
}: {
  calibration: Extract<CalibrationState, { phase: "running" }>;
  onCancel: () => void;
}) {
  const { beat, beatsPerBar, totalClicks } = calibration;
  const bars = totalClicks / beatsPerBar;
  const currentBeat = beat === 0 ? -1 : (beat - 1) % beatsPerBar;
  const currentBar = beat === 0 ? 0 : Math.ceil(beat / beatsPerBar);
  const finished = beat >= totalClicks;

  return (
    <div className="flex flex-col items-center gap-4 py-2" aria-live="polite">
      <p className="text-sm font-medium">
        {beat === 0
          ? "Get ready… the first click is coming."
          : finished
            ? "Listening for your last note…"
            : `Bar ${currentBar} of ${bars}: play on every click`}
      </p>
      <div className="flex gap-3">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <div
            key={i}
            className={cn(
              "flex size-14 items-center justify-center rounded-lg border text-xl font-semibold transition-colors duration-75",
              i === currentBeat && !finished
                ? i === 0
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-emerald-500 bg-emerald-500/20"
                : "text-muted-foreground",
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        Click {Math.min(beat, totalClicks)} / {totalClicks}
      </p>
      <Button variant="outline" size="sm" onClick={onCancel}>
        <Square />
        Cancel
      </Button>
    </div>
  );
}

function CalibrationResult({ calibration }: { calibration: CalibrationState }) {
  if (calibration.phase === "done") {
    const { latency, rejected } = calibration;
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        <div>
          <p className="font-medium">Measured latency: {latency.ms.toFixed(1)} ms</p>
          <p className="text-muted-foreground">
            Matched {latency.matched} of {latency.totalClicks} clicks
            {rejected > 0 && ` (${rejected} outlier${rejected > 1 ? "s" : ""} ignored)`}.
          </p>
        </div>
      </div>
    );
  }
  if (calibration.phase === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Couldn't calibrate, try again</p>
          <p className="text-muted-foreground">
            {calibration.matched !== null
              ? `Only ${calibration.matched} of ${calibration.totalClicks} clicks matched a played note. Play one clear note right on each click.`
              : calibration.message}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function describe(latency: LatencyCalibration | null) {
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
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && changed) save(parsed);
      }}
    >
      <Label htmlFor="latency-ms">Latency (ms)</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="latency-ms"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={-MAX_ABS_LATENCY_MS}
          max={MAX_ABS_LATENCY_MS}
          placeholder="Not set"
          className="w-36"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.currentTarget.value)}
          aria-invalid={text.trim() !== "" && !valid}
        />
        <Button type="submit" variant="secondary" disabled={disabled || !changed}>
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
      <p className="text-sm text-muted-foreground">
        {text.trim() !== "" && !valid
          ? `Enter a number between -${MAX_ABS_LATENCY_MS} and ${MAX_ABS_LATENCY_MS}.`
          : describe(latency)}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
