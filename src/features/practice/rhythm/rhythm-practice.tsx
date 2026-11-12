import { useState } from "react";
import { AlertTriangle, CheckCircle2, Dices, Headphones, Play, Square } from "lucide-react";

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
import { AccuracyTips, FastNotesWarning, minGapMs } from "./accuracy-notice";
import { LatencyStatus } from "./latency-status";
import { LiveTimingCounts, TimingAnalysis } from "./timing-analysis";
import { useRhythmExercise } from "./use-rhythm-exercise";

export function RhythmPractice() {
  const { status, settings, calibration, startRhythmPractice, listenToRhythm, stopRhythmPractice } =
    useEngine();
  const practice = usePractice();
  const allJudgements = usePracticeJudgements();
  const calibrated = useLatency() !== null;
  const rhythm = settings.practice.rhythm;
  const { draft, error: generateError, regenerate } = useRhythmExercise(rhythm);
  const writing = rhythm.difficulty === "custom" && rhythm.customMode === "written";
  // Only a complete exercise can be played; a written draft is still shown.
  const exercise = draft?.complete ? draft.exercise : null;
  const gapMs = minGapMs(draft?.minNoteGapBeats ?? null, rhythm.bpm);
  const shownExercise = draft && draft.exercise.bars.length > 0 ? draft.exercise : null;
  // Results belong to the exercise that was played; a new one hides them.
  const [playedExercise, setPlayedExercise] = useState<Exercise | null>(null);
  const showResults = playedExercise !== null && playedExercise === exercise;
  const judgements = showResults ? allJudgements : [];
  const [startError, setStartError] = useState<string | null>(null);

  const running = practice.phase === "running";
  const listening = running && practice.mode.kind === "listen";
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

  const listen = () => {
    if (!exercise) return;
    setStartError(null);
    listenToRhythm(exercise).catch((e) => setStartError(String(e)));
  };

  return (
    <div className="flex flex-col gap-6">
      <EngineStatusBanner status={status} />
      <RhythmSettingsCard
        disabled={running}
        draft={draft}
        draftError={writing ? generateError : null}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Play along</CardTitle>
            <CardDescription>
              {rhythm.bpm} BPM · {rhythm.timeSignature.beatsPerBar}/4 ·{" "}
              {shownExercise?.bars.length ?? 0} bars. Only note lengths matter; play any note.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!writing && (
              <Button variant="outline" onClick={regenerate} disabled={running}>
                <Dices />
                New exercise
              </Button>
            )}
            {running ? (
              <Button variant="destructive" onClick={() => stopRhythmPractice()}>
                <Square />
                Stop
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={listen} disabled={!canStart}>
                  <Headphones />
                  Listen
                </Button>
                <Button onClick={start} disabled={!canStart}>
                  <Play />
                  Start
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SessionStatus practice={showResults ? practice : { phase: "idle" }} exercise={exercise} />
          {running && !listening && <LiveTimingCounts judgements={judgements} />}
          {!running && <LatencyStatus disabled={status.state !== "running"} />}
          <FastNotesWarning gapMs={gapMs} />
          {!running && <AccuracyTips />}
          {status.state !== "running" && (
            <p className="text-sm text-muted-foreground">
              Practice needs a working input device (the metronome is timed on the input's audio
              clock).
            </p>
          )}
          {((generateError && !writing) || startError) && (
            <p className="text-sm text-destructive">{startError ?? generateError}</p>
          )}
          {writing && draft && !draft.complete && (
            <p className="text-sm text-muted-foreground">
              Finish your rhythm above to listen to it or practice it.
            </p>
          )}
          {shownExercise ? (
            <RhythmScore exercise={shownExercise} active={active} judgements={judgements} />
          ) : (
            writing && (
              <p className="text-sm text-muted-foreground">Your rhythm will appear here.</p>
            )
          )}
        </CardContent>
      </Card>

      {showResults && practice.phase === "finished" && (
        <TimingAnalysis report={practice.report} calibrated={calibrated} minGapMs={gapMs} />
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
          Press Listen to hear the rhythm first (played on a random note), then Start: after 4
          count-in clicks, play it with the metronome. Each note turns green (on time), amber
          (early or late) or red (missed) as you play.
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

  const { positionBeats: pos, countInBeats, mode } = practice;
  const listeningTo = mode.kind === "listen" ? mode.note : null;
  if (pos === null || pos < 0) {
    const click = pos === null ? 0 : Math.floor(pos + countInBeats) + 1;
    return (
      <div className="flex items-center gap-4" aria-live="polite">
        <span className="text-sm font-medium">
          {listeningTo ? `Listen (note ${listeningTo}) · count-in` : "Count-in"}
        </span>
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
      {listeningTo && `Listening on ${listeningTo} · `}
      Bar {Math.min(bar, bars)} of {bars} · beat {beat}
    </p>
  );
}
