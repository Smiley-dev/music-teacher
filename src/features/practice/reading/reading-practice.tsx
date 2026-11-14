import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Dices,
  Ear,
  Headphones,
  Play,
  Square,
  Timer,
  Trophy,
} from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SCALE_LABELS, pitchLabel, prettyNoteName } from "@/features/practice/pitch/pitch-labels";
import { FastNotesWarning, minGapMs } from "@/features/practice/rhythm/accuracy-notice";
import { LatencyStatus } from "@/features/practice/rhythm/latency-status";
import { symbolAt } from "@/features/practice/rhythm/render-score";
import { LiveTimingCounts, TimingAnalysis } from "@/features/practice/rhythm/timing-analysis";
import type {
  Judgement,
  PitchCheck,
  PracticeState,
  ReadingExercise,
  ReadingState,
} from "@/lib/engine";
import { cn } from "@/lib/utils";
import {
  useEngine,
  useLatency,
  usePractice,
  usePracticeJudgements,
  usePracticePitchChecks,
  useReading,
} from "@/providers/audio-engine-context";

import { LivePitchCounts, PitchAnalysis } from "./pitch-analysis";
import { NOTE_CLASSES, ReadingScore, type Slot, slotKey } from "./reading-score";
import { ReadingSettingsCard } from "./reading-settings-card";
import { useReadingExercise } from "./use-reading-exercise";

/** What the user last started from this tab (results belong to it). */
type Action = "listen" | "ownPace" | "metronome";

function describe(exercise: ReadingExercise, bpm: number): string {
  const { root, scale, rhythm } = exercise;
  const name = `${pitchLabel(root, false)} ${SCALE_LABELS[scale].name.toLowerCase()}`;
  const bars = rhythm.bars.length;
  return `${name} · ${rhythm.timeSignature.beatsPerBar}/4 · ${bars} ${bars === 1 ? "bar" : "bars"} · ${bpm} BPM`;
}

/** Sight reading: a generated melody in standard notation; listen to it,
 * then play it at your own pace or with the metronome (ADR 0012). */
export function ReadingPractice() {
  const {
    status,
    settings,
    calibration,
    listenToReading,
    startReadingPractice,
    startReadingWithMetronome,
    stopReadingPractice,
    stopRhythmPractice,
  } = useEngine();
  const practice = usePractice();
  const judgements = usePracticeJudgements();
  const pitchChecks = usePracticePitchChecks();
  const reading = useReading();
  const calibrated = useLatency() !== null;
  const { bpm, melody } = settings.practice.reading;
  const { exercise, error: generateError, regenerate } = useReadingExercise(
    melody,
    settings.practice.pitch.instrument,
  );
  // Results belong to the exercise that was played; a new one hides them.
  const [played, setPlayed] = useState<{ exercise: ReadingExercise; action: Action } | null>(
    null,
  );
  const action = played !== null && played.exercise === exercise ? played.action : null;
  const [startError, setStartError] = useState<string | null>(null);

  const rhythmRunning = practice.phase === "running";
  const withClock = (action === "listen" || action === "metronome") && rhythmRunning;
  const ownPace = action === "ownPace" && reading.phase === "running";
  const running = withClock || ownPace;
  const canStart =
    exercise !== null &&
    status.state === "running" &&
    calibration.phase !== "running" &&
    !rhythmRunning &&
    reading.phase !== "running";
  const gapMs = minGapMs(exercise?.minNoteGapBeats ?? null, bpm);

  // Stop what this tab started when the tab (or the Practice screen) goes away.
  const latest = useRef({ withClock, ownPace, stopRhythmPractice, stopReadingPractice });
  useEffect(() => {
    latest.current = { withClock, ownPace, stopRhythmPractice, stopReadingPractice };
  });
  useEffect(
    () => () => {
      const l = latest.current;
      if (l.withClock) l.stopRhythmPractice().catch(() => {});
      if (l.ownPace) l.stopReadingPractice().catch(() => {});
    },
    [],
  );

  const start = (next: Action) => {
    if (!exercise) return;
    setStartError(null);
    setPlayed({ exercise, action: next });
    const command = {
      listen: listenToReading,
      ownPace: startReadingPractice,
      metronome: startReadingWithMetronome,
    }[next];
    command(exercise).catch((e) => setStartError(String(e)));
  };
  const stop = () => (withClock ? stopRhythmPractice() : stopReadingPractice()).catch(() => {});

  const { classes, active } = useMemo(
    () => noteStates(exercise, action, practice, reading, judgements, pitchChecks),
    [exercise, action, practice, reading, judgements, pitchChecks],
  );
  const finishedWithMetronome =
    action === "metronome" && practice.phase === "finished" ? practice : null;

  return (
    <div className="flex flex-col gap-6">
      <EngineStatusBanner status={status} />
      <ReadingSettingsCard disabled={running} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Read and play</CardTitle>
            <CardDescription>
              {exercise ? describe(exercise, bpm) : "Choose the options above to get a melody."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button variant="destructive" onClick={stop}>
                <Square />
                Stop
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={regenerate}>
                  <Dices />
                  New melody
                </Button>
                <Button variant="outline" onClick={() => start("listen")} disabled={!canStart}>
                  <Headphones />
                  Listen
                </Button>
                <Button variant="outline" onClick={() => start("ownPace")} disabled={!canStart}>
                  <Play />
                  Play at my own pace
                </Button>
                <Button onClick={() => start("metronome")} disabled={!canStart}>
                  <Timer />
                  Play with metronome
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Status exercise={exercise} action={action} practice={practice} reading={reading} />
          {action === "metronome" && rhythmRunning && (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <LiveTimingCounts judgements={judgements} />
              <LivePitchCounts checks={pitchChecks} />
            </div>
          )}
          {!running && <LatencyStatus disabled={status.state !== "running"} />}
          <FastNotesWarning gapMs={gapMs} />
          {status.state !== "running" && (
            <p className="text-sm text-muted-foreground">
              Sight reading needs a working input device: it listens to what you play.
            </p>
          )}
          {(startError ?? generateError) && (
            <p className="text-sm text-destructive">{startError ?? generateError}</p>
          )}
          {exercise && <ReadingScore exercise={exercise} classes={classes} active={active} />}
        </CardContent>
      </Card>

      {exercise && finishedWithMetronome && (
        <>
          <TimingAnalysis report={finishedWithMetronome.report} calibrated={calibrated} minGapMs={gapMs} />
          {finishedWithMetronome.pitch && (
            <PitchAnalysis report={finishedWithMetronome.pitch} exercise={exercise} />
          )}
        </>
      )}
    </div>
  );
}

/** Note colours and the highlighted note for the current session. */
function noteStates(
  exercise: ReadingExercise | null,
  action: Action | null,
  practice: PracticeState,
  reading: ReadingState,
  judgements: Judgement[],
  pitchChecks: PitchCheck[],
): { classes: Map<string, string>; active: Slot | null } {
  const classes = new Map<string, string>();
  if (!exercise || !action) return { classes, active: null };
  const position = practice.phase === "running" ? practice.positionBeats : null;
  const cursor = position === null ? null : symbolAt(exercise.rhythm, position);
  switch (action) {
    case "listen":
      return { classes, active: cursor };
    case "metronome": {
      if (practice.phase !== "running" && practice.phase !== "finished") {
        return { classes, active: null };
      }
      // Timing colours, with a wrong pitch taking precedence.
      for (const j of judgements) classes.set(slotKey(j), NOTE_CLASSES[j.result]);
      for (const c of pitchChecks) {
        if (c.result === "wrong") classes.set(slotKey(c), NOTE_CLASSES.wrongPitch);
      }
      return { classes, active: cursor };
    }
    case "ownPace":
      break;
  }
  switch (reading.phase) {
    case "running":
      exercise.notes
        .slice(0, reading.progress)
        .forEach((n) => classes.set(slotKey(n), NOTE_CLASSES.correct));
      return { classes, active: exercise.notes[reading.progress] ?? null };
    case "finished":
      exercise.notes.forEach((n) => classes.set(slotKey(n), NOTE_CLASSES.correct));
      return { classes, active: null };
    case "idle":
    case "failed":
      return { classes, active: null };
  }
}

function Status({
  exercise,
  action,
  practice,
  reading,
}: {
  exercise: ReadingExercise | null;
  action: Action | null;
  practice: PracticeState;
  reading: ReadingState;
}) {
  if (action === "listen" || action === "metronome") {
    switch (practice.phase) {
      case "running":
        return <ClockLine practice={practice} exercise={exercise} listening={action === "listen"} />;
      case "finished":
        return (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-emerald-500" />
            Done! See how the timing and the notes went below. Purple notes had the wrong pitch.
          </p>
        );
      case "failed":
        return <ErrorLine message={practice.message} />;
      case "idle":
        break;
    }
  }
  if (action === "ownPace") {
    switch (reading.phase) {
      case "running":
        return <OwnPaceLine reading={reading} />;
      case "finished":
        return (
          <p className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="size-4 text-amber-500" />
            Done! {reading.notes} notes in {Math.round(reading.seconds)} s,{" "}
            {reading.mistakes === 0
              ? "without a wrong note."
              : `${reading.mistakes} wrong ${reading.mistakes === 1 ? "note" : "notes"}.`}{" "}
            Try it with the metronome next.
          </p>
        );
      case "failed":
        return <ErrorLine message={reading.message} />;
      case "idle":
        break;
    }
  }
  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p>Read the melody first, then:</p>
      <ul className="list-disc pl-5">
        <li>
          <span className="font-medium text-foreground">Listen</span> plays it at the tempo after 4
          count-in clicks.
        </li>
        <li>
          <span className="font-medium text-foreground">Play at my own pace</span>: play the blue
          note; it turns green when it is right and the next one turns blue. Only the pitch counts.
        </li>
        <li>
          <span className="font-medium text-foreground">Play with metronome</span>: after 4
          count-in clicks, play along. Every note is judged for timing (green, amber, red) and
          pitch (purple when wrong).
        </li>
      </ul>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-destructive">
      <AlertTriangle className="size-4" />
      {message}
    </p>
  );
}

/** Count-in, then bar and beat, while listening or playing with the metronome. */
function ClockLine({
  practice,
  exercise,
  listening,
}: {
  practice: Extract<PracticeState, { phase: "running" }>;
  exercise: ReadingExercise | null;
  listening: boolean;
}) {
  const pos = practice.positionBeats;
  const Icon = listening ? Headphones : Timer;
  const label = listening ? "Listening" : "Playing";
  if (pos === null || pos < 0) {
    const click = pos === null ? 0 : Math.floor(pos + practice.countInBeats) + 1;
    return (
      <div className="flex items-center gap-4" aria-live="polite">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4" />
          Count-in
        </span>
        <div className="flex gap-2">
          {Array.from({ length: practice.countInBeats }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex size-9 items-center justify-center rounded-md text-base",
                i < click
                  ? "bg-emerald-500 font-semibold text-white"
                  : "border text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    );
  }
  const beats = exercise?.rhythm.timeSignature.beatsPerBar ?? 4;
  const bars = exercise?.rhythm.bars.length ?? 0;
  return (
    <p className="flex items-center gap-2 font-mono text-sm tabular-nums" aria-live="off">
      <Icon className="size-4" />
      {label} · bar {Math.min(Math.floor(pos / beats) + 1, bars)} of {bars} · beat{" "}
      {Math.floor(pos % beats) + 1}
    </p>
  );
}

function OwnPaceLine({ reading }: { reading: Extract<ReadingState, { phase: "running" }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
      <span className="font-medium">
        Note {Math.min(reading.progress + 1, reading.total)} of {reading.total}
      </span>
      <span className={cn("font-mono tabular-nums", !reading.heard && "text-muted-foreground/60")}>
        <Ear className="mr-1 inline size-4 align-text-bottom text-muted-foreground" />
        {reading.heard ? `Hearing ${prettyNoteName(reading.heard)}` : "Hearing nothing"}
      </span>
      {reading.wrong && (
        <span className="font-medium text-amber-600 dark:text-amber-400">
          Not quite: that was {prettyNoteName(reading.wrong)}. Try again.
        </span>
      )}
      <span className="text-muted-foreground">
        {reading.mistakes} wrong {reading.mistakes === 1 ? "note" : "notes"}
      </span>
    </div>
  );
}
