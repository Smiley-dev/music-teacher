import { useState } from "react";
import { AlertTriangle, CheckCircle2, Dices, Play, Square } from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Exercise, PracticeState } from "@/lib/engine";
import {
  useEngine,
  useLatency,
  usePractice,
  usePracticeJudgements,
} from "@/providers/audio-engine-context";

import { symbolAt } from "./render-score";
import { RhythmScore } from "./rhythm-score";
import { RhythmSettingsCard } from "./rhythm-settings-card";
import { LiveTimingCounts, TimingAnalysis } from "./timing-analysis";
import { useRhythmExercise } from "./use-rhythm-exercise";

export function RhythmPractice() {
  const { status, settings, calibration, startRhythmPractice, stopRhythmPractice } = useEngine();
  const practice = usePractice();
  const allJudgements = usePracticeJudgements();
  const calibrated = useLatency() !== null;
  const rhythm = settings.practice.rhythm;
  const { exercise, error: generateError, regenerate } = useRhythmExercise(rhythm);
  // Results belong to the exercise that was played; a new one hides them.
  const [playedExercise, setPlayedExercise] = useState<Exercise | null>(null);
  const showResults = playedExercise !== null && playedExercise === exercise;
  const judgements = showResults ? allJudgements : [];
  const [startError, setStartError] = useState<string | null>(null);

  const running = practice.phase === "running";
  const position = running ? practice.positionBeats : null;
  const active = exercise && position !== null ? symbolAt(exercise, position) : null;
  const canStart =
    exercise !== null && status.state === "running" && calibration.phase !== "running";

  const start = () => {
    if (!exercise) return;
    setStartError(null);
    setPlayedExercise(exercise);
    startRhythmPractice(exercise).catch((e) => setStartError(String(e)));
  };

  return (
    <div className="flex flex-col gap-6">
      <EngineStatusBanner status={status} />
      <RhythmSettingsCard disabled={running} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Play along</CardTitle>
            <CardDescription>
              {rhythm.bpm} BPM · {rhythm.timeSignature.beatsPerBar}/4 · {rhythm.bars} bars. Only
              note lengths matter; play any note.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={regenerate} disabled={running}>
              <Dices />
              New exercise
            </Button>
            {running ? (
              <Button variant="destructive" onClick={() => stopRhythmPractice()}>
                <Square />
                Stop
              </Button>
            ) : (
              <Button onClick={start} disabled={!canStart}>
                <Play />
                Start
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SessionStatus practice={showResults ? practice : { phase: "idle" }} exercise={exercise} />
          {running && <LiveTimingCounts judgements={judgements} />}
          {!calibrated && !running && (
            <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              Not calibrated yet: calibrate in Settings so your timing is judged accurately.
            </p>
          )}
          {status.state !== "running" && (
            <p className="text-sm text-muted-foreground">
              Practice needs a working input device (the metronome is timed on the input's audio
              clock).
            </p>
          )}
          {(generateError || startError) && (
            <p className="text-sm text-destructive">{generateError ?? startError}</p>
          )}
          {exercise && (
            <RhythmScore exercise={exercise} active={active} judgements={judgements} />
          )}
        </CardContent>
      </Card>

      {showResults && practice.phase === "finished" && (
        <TimingAnalysis report={practice.report} calibrated={calibrated} />
      )}
    </div>
  );
}

function SessionStatus({
  practice,
  exercise,
}: {
  practice: PracticeState;
  exercise: Exercise | null;
}) {
  switch (practice.phase) {
    case "idle":
      return (
        <p className="text-sm text-muted-foreground">
          Press Start: after 4 count-in clicks, play the rhythm with the metronome. Each note turns
          green (on time), amber (early or late) or red (missed) as you play.
        </p>
      );
    case "finished":
      return (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="size-4 text-emerald-500" />
          Done! See your timing analysis below. Press Start to try again or New exercise for
          another one.
        </p>
      );
    case "failed":
      return (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {practice.message}
        </p>
      );
    case "running":
      break;
  }

  const { positionBeats: pos, countInBeats } = practice;
  if (pos === null || pos < 0) {
    const click = pos === null ? 0 : Math.floor(pos + countInBeats) + 1;
    return (
      <div className="flex items-center gap-4" aria-live="polite">
        <span className="text-sm font-medium">Count-in</span>
        <div className="flex gap-2">
          {Array.from({ length: countInBeats }, (_, i) => (
            <span
              key={i}
              className={
                i < click
                  ? "flex size-10 items-center justify-center rounded-md bg-emerald-500 text-lg font-semibold text-white"
                  : "flex size-10 items-center justify-center rounded-md border text-lg text-muted-foreground"
              }
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const beats = exercise?.timeSignature.beatsPerBar ?? 4;
  const bars = exercise?.bars.length ?? 0;
  const bar = Math.floor(pos / beats) + 1;
  const beat = Math.floor(pos % beats) + 1;
  return (
    <p className="font-mono text-sm tabular-nums" aria-live="off">
      Bar {Math.min(bar, bars)} of {bars} · beat {beat}
    </p>
  );
}
