import { type ReactNode, useEffect, useRef, useState } from "react";
import { AlertTriangle, Play, SkipForward, Square, Volume2 } from "lucide-react";

import { Display, Lamp, Panel, Readout, StatusStrip } from "@/components/rack";
import { Button } from "@/components/ui/button";
import type {
  PitchExerciseKind,
  PitchPracticeState,
  PitchScore,
  PitchTask,
  TaskStage,
} from "@/lib/engine";
import { prettyNoteName } from "@/lib/pitch-labels";
import { cn } from "@/lib/utils";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

import { type NoteState, PitchStaff } from "./pitch-staff";

const EXERCISE_NAMES: Record<PitchExerciseKind, string> = {
  notes: "Notes",
  intervals: "Intervals",
  scales: "Scales",
  chords: "Chords",
  ear: "Ear training",
};

type PitchSessionCardProps = {
  exercise: PitchExerciseKind;
  /** What to do, shown large before starting ("Read and play"). */
  title: string;
  /** One line under the title before starting. */
  description: string;
  /** How the exercise works, shown before starting. */
  instructions: ReactNode;
  /** The task in words, e.g. "Major 3rd up". */
  describe: (task: PitchTask) => string;
  /** Why the exercise cannot start with the current options, if so. */
  blocked?: string | null;
};

/** The display of a pitch exercise (ADR 0011): the current task large and
 * on a staff, what is heard, the outcome, the transport keys and the score.
 * Leaving the exercise stops it. */
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

  // Stop this exercise when the user goes to another page.
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
  // Ear training plays the notes first; the button then repeats them.
  const replayLabel = running && state.task.playFirst ? "Play again" : "Hear it";
  const score = state.phase === "running" || state.phase === "finished" ? state.score : null;

  return (
    <Panel aria-label={title} className="flex flex-col gap-4">
      <Display className="flex flex-col gap-3.5 sm:px-[26px] sm:py-[22px]">
        <TopLine state={state} name={EXERCISE_NAMES[exercise]} />
        {state.phase === "running" ? (
          <TaskView state={state} describe={describe} />
        ) : (
          <>
            <h2 className="text-[clamp(2.25rem,5vw,3.75rem)] leading-none font-extrabold tracking-tight text-signal uppercase">
              {title}
            </h2>
            <p className="text-muted-foreground">{description}</p>
            <IdleBody
              state={state}
              instructions={instructions}
              blocked={blocked}
              noInput={status.state !== "running"}
            />
          </>
        )}
      </Display>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2.5">
          {running ? (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={() => act(replayPitchTask)}
                disabled={stage !== "playing"}
              >
                <Volume2 />
                {replayLabel}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => act(skipPitchTask)}
                disabled={stage === "solved" || stage === "revealed"}
              >
                <SkipForward />
                Skip
              </Button>
              <Button size="lg" variant="destructive" onClick={() => act(stopPitchPractice)}>
                <Square className="fill-current" />
                Stop
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="px-7 text-[15px]"
              onClick={() => act(() => startPitchPractice(exercise))}
              disabled={!canStart}
            >
              <Play className="fill-current" />
              Start
            </Button>
          )}
        </div>
        {score && <ScoreTiles score={score} last={state.phase === "finished"} />}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Panel>
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

const pad = (n: number) => String(n).padStart(2, "0");

/** Mono line at the top of the display: which task, and what is going on. */
function TopLine({ state, name }: { state: PitchPracticeState; name: string }) {
  let left = `${name} · ready`;
  let right: ReactNode = "Stopped";
  switch (state.phase) {
    case "finished":
      left = `${name} · finished`;
      break;
    case "failed":
      left = `${name} · could not start`;
      break;
    case "idle":
      break;
    case "running": {
      left = `Task ${pad(state.round)} · ${name}`;
      const { task, stage, progress } = state;
      if (task.notes.length > 1) left += ` · ${Math.min(progress, task.notes.length)} of ${task.notes.length} notes`;
      if (stage === "listening") {
        right = <span className="text-sky-600 dark:text-sky-400">Judging paused while notes play</span>;
      } else if (stage === "solved") {
        right = <span className="text-emerald-500">Next task in a moment</span>;
      } else {
        right = (
          <span className={cn("flex items-center gap-2", state.heard ? "text-signal" : undefined)}>
            <Lamp on={state.heard !== null} tone="signal" />
            {state.heard ? `Hearing ${prettyNoteName(state.heard)}` : "Hearing nothing"}
          </span>
        );
      }
      break;
    }
  }
  return (
    <div className="flex flex-wrap justify-between gap-3 font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function IdleBody({
  state,
  instructions,
  blocked,
  noInput,
}: {
  state: Exclude<PitchPracticeState, { phase: "running" }>;
  instructions: ReactNode;
  blocked: string | null;
  noInput: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      {state.phase === "failed" ? (
        <StatusStrip tone="bad">
          <AlertTriangle className="size-4 shrink-0" />
          {state.message}
        </StatusStrip>
      ) : state.phase === "finished" ? (
        <StatusStrip tone="ok">
          <Lamp on tone="ok" />
          Well played! {scoreSummary(state.score)} Press Start to go again.
        </StatusStrip>
      ) : (
        <div className="leading-relaxed text-muted-foreground">{instructions}</div>
      )}
      {blocked && (
        <StatusStrip tone="warn">
          <AlertTriangle className="size-4 shrink-0" />
          {blocked}
        </StatusStrip>
      )}
      {noInput && (
        <p className="text-muted-foreground">
          Note exercises need a working input device: they listen to what you play.
        </p>
      )}
    </div>
  );
}

function TaskView({
  state,
  describe,
}: {
  state: Extract<PitchPracticeState, { phase: "running" }>;
  describe: (task: PitchTask) => string;
}) {
  const { task, stage, progress } = state;
  const states = noteStates(task, stage, progress);
  const listening = stage === "listening";
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h2
          className={cn(
            "text-[clamp(1.9rem,3.8vw,3rem)] leading-none font-extrabold tracking-tight uppercase",
            listening ? "text-sky-500" : "text-signal",
          )}
        >
          {listening ? "Listen…" : describe(task)}
        </h2>
        {listening && task.notes.length > 1 && (
          <div className="flex gap-2.5" aria-hidden>
            {task.notes.map((_, i) => (
              <span
                key={i}
                className="flex size-10 items-center justify-center rounded-lg bg-sky-500/15 font-mono font-bold text-sky-500"
              >
                {i + 1}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="text-muted-foreground">
        {listening
          ? `${describe(task)}. Listen first; your turn comes when the notes have played.`
          : task.notes.length > 1
            ? `Your turn: note ${Math.min(progress + 1, task.notes.length)} of ${task.notes.length}.`
            : "Your turn: play it."}
      </p>
      <PitchStaff clef={task.clef} notes={task.notes.map((n) => n.written)} states={states} />
      <Outcome state={state} />
    </>
  );
}

function Outcome({ state }: { state: Extract<PitchPracticeState, { phase: "running" }> }) {
  const stage: TaskStage = state.stage;
  if (stage === "solved") {
    return (
      <StatusStrip tone="ok">
        <Lamp on tone="ok" />
        CORRECT!
      </StatusStrip>
    );
  }
  if (stage === "revealed") {
    return <StatusStrip tone="warn">Here is the answer. Next one in a moment…</StatusStrip>;
  }
  if (state.wrong && stage === "playing") {
    return (
      <StatusStrip tone="bad">
        ✕ Not quite: that was {prettyNoteName(state.wrong)}. Try again.
      </StatusStrip>
    );
  }
  // Keeps the display from jumping when a strip appears.
  return <div className="min-h-[42px]" aria-hidden />;
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

function scoreSummary(score: PitchScore): string {
  const parts = [`${score.solved} solved (${score.clean} without a mistake)`];
  if (score.skipped > 0) parts.push(`${score.skipped} skipped`);
  parts.push(`${score.wrongNotes} wrong ${score.wrongNotes === 1 ? "note" : "notes"}`);
  return parts.join(", ") + ".";
}

function ScoreTiles({ score, last }: { score: PitchScore; last: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {last && <span className="rack-label text-[10px]">Last session</span>}
      <div className="flex flex-wrap gap-2 text-center">
        <Readout label="Solved" value={pad(score.solved)} tone="ok" />
        <Readout label="1st try" value={pad(score.clean)} tone="signal" />
        <Readout label="Skipped" value={pad(score.skipped)} />
        <Readout label="Wrong" value={pad(score.wrongNotes)} tone="bad" />
      </div>
    </div>
  );
}
