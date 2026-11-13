import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Ear,
  Headphones,
  Play,
  SkipForward,
  Square,
  Trophy,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PitchExerciseKind,
  PitchPracticeState,
  PitchScore,
  PitchTask,
  TaskStage,
} from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

import { prettyNoteName } from "./pitch-labels";
import { type NoteState, PitchStaff } from "./pitch-staff";

type PitchSessionCardProps = {
  exercise: PitchExerciseKind;
  title: string;
  description: string;
  /** How the exercise works, shown before starting. */
  instructions: ReactNode;
  /** The task in words, e.g. "Major 3rd up from the note shown". */
  describe: (task: PitchTask) => string;
  /** Why the exercise cannot start with the current options, if so. */
  blocked?: string | null;
};

/** Start/stop, the current task on a staff, live feedback and the score of
 * a pitch exercise (ADR 0011). Leaving the tab stops the exercise. */
export function PitchSessionCard({
  exercise,
  title,
  description,
  instructions,
  describe,
  blocked = null,
}: PitchSessionCardProps) {
  const { status, calibration, startPitchPractice, stopPitchPractice, skipPitchTask, replayPitchTask } =
    useEngine();
  const pitch = usePitchPractice();
  const state = belongsTo(pitch, exercise) ? pitch : { phase: "idle" as const };
  const running = state.phase === "running";
  const [error, setError] = useState<string | null>(null);

  // Stop this exercise when the tab (or the Practice screen) goes away.
  const latest = useRef({ running, stop: stopPitchPractice });
  useEffect(() => {
    latest.current = { running, stop: stopPitchPractice };
  });
  useEffect(
    () => () => {
      if (latest.current.running) latest.current.stop().catch(() => {});
    },
    [],
  );

  const act = (command: () => Promise<void>) => {
    setError(null);
    command().catch((e) => setError(String(e)));
  };
  const canStart = status.state === "running" && calibration.phase !== "running" && !blocked;
  const stage = running ? state.stage : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex gap-2">
          {running ? (
            <>
              <Button
                variant="outline"
                onClick={() => act(replayPitchTask)}
                disabled={stage !== "playing"}
              >
                <Volume2 />
                Hear it
              </Button>
              <Button
                variant="outline"
                onClick={() => act(skipPitchTask)}
                disabled={stage === "solved" || stage === "revealed"}
              >
                <SkipForward />
                Skip
              </Button>
              <Button variant="destructive" onClick={() => act(stopPitchPractice)}>
                <Square />
                Stop
              </Button>
            </>
          ) : (
            <Button onClick={() => act(() => startPitchPractice(exercise))} disabled={!canStart}>
              <Play />
              Start
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!running && blocked && (
          <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4" />
            {blocked}
          </p>
        )}
        {status.state !== "running" && (
          <p className="text-sm text-muted-foreground">
            Note exercises need a working input device: they listen to what you play.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SessionBody state={state} instructions={instructions} describe={describe} />
      </CardContent>
    </Card>
  );
}

function belongsTo(state: PitchPracticeState, exercise: PitchExerciseKind) {
  switch (state.phase) {
    case "running":
    case "finished":
      return state.exercise === exercise;
    case "idle":
    case "failed":
      return true;
  }
}

function SessionBody({
  state,
  instructions,
  describe,
}: {
  state: PitchPracticeState;
  instructions: ReactNode;
  describe: (task: PitchTask) => string;
}) {
  switch (state.phase) {
    case "idle":
      return <div className="text-sm text-muted-foreground">{instructions}</div>;
    case "failed":
      return (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {state.message}
        </p>
      );
    case "finished":
      return (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="size-4 text-amber-500" />
            Well played! {scoreSummary(state.score)}
          </p>
          <p className="text-sm text-muted-foreground">Press Start to go again.</p>
        </div>
      );
    case "running":
      break;
  }

  const { task, stage, progress } = state;
  const states = noteStates(task, stage, progress);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xl font-semibold tracking-tight">{describe(task)}</p>
        <StageLine stage={stage} task={task} progress={progress} />
      </div>
      <PitchStaff clef={task.clef} notes={task.notes.map((n) => n.written)} states={states} />
      <div className="flex min-h-6 flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
        <span className={cn("font-mono tabular-nums", !state.heard && "text-muted-foreground/60")}>
          <Ear className="mr-1 inline size-4 align-text-bottom text-muted-foreground" />
          {state.heard ? `Hearing ${prettyNoteName(state.heard)}` : "Hearing nothing"}
        </span>
        {state.wrong && stage === "playing" && (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            Not quite: that was {prettyNoteName(state.wrong)}. Try again.
          </span>
        )}
      </div>
      <ScoreLine round={state.round} score={state.score} />
    </div>
  );
}

function noteStates(task: PitchTask, stage: TaskStage, progress: number): NoteState[] {
  const many = task.notes.length > 1;
  return task.notes.map((note, i) => {
    if (i < progress) return "correct";
    switch (stage) {
      case "solved":
        return "correct";
      case "revealed":
        return "answer";
      case "listening":
      case "playing":
        if (!note.given) return "hidden";
        return many && i === progress && stage === "playing" ? "next" : "given";
    }
  });
}

function StageLine({
  stage,
  task,
  progress,
}: {
  stage: TaskStage;
  task: PitchTask;
  progress: number;
}) {
  switch (stage) {
    case "listening":
      return (
        <p className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400">
          <Headphones className="size-4" />
          Listen…
        </p>
      );
    case "playing":
      return (
        <p className="text-sm text-muted-foreground">
          {task.notes.length > 1
            ? `Your turn: note ${progress + 1} of ${task.notes.length}`
            : "Your turn: play it"}
        </p>
      );
    case "solved":
      return (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          Correct!
        </p>
      );
    case "revealed":
      return (
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Here is the answer. Next one in a moment…
        </p>
      );
  }
}

function scoreSummary(score: PitchScore): string {
  const parts = [`${score.solved} solved (${score.clean} without a mistake)`];
  if (score.skipped > 0) parts.push(`${score.skipped} skipped`);
  parts.push(`${score.wrongNotes} wrong ${score.wrongNotes === 1 ? "note" : "notes"}`);
  return parts.join(", ") + ".";
}

function ScoreLine({ round, score }: { round: number; score: PitchScore }) {
  const items: [string, number, string][] = [
    ["Solved", score.solved, "text-emerald-600 dark:text-emerald-400"],
    ["First try", score.clean, "text-emerald-600 dark:text-emerald-400"],
    ["Skipped", score.skipped, "text-amber-600 dark:text-amber-400"],
    ["Wrong notes", score.wrongNotes, "text-red-600 dark:text-red-400"],
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t pt-3 text-sm">
      <span className="text-muted-foreground">Task {round}</span>
      {items.map(([label, value, color]) => (
        <span key={label} className="flex items-baseline gap-1.5">
          <span className={cn("font-mono font-semibold tabular-nums", color)}>{value}</span>
          <span className="text-muted-foreground">{label}</span>
        </span>
      ))}
    </div>
  );
}
