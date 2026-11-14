import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Dices, Ear, Headphones, Play, Square, Trophy } from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SCALE_LABELS, pitchLabel, prettyNoteName } from "@/features/practice/pitch/pitch-labels";
import { symbolAt } from "@/features/practice/rhythm/render-score";
import type { PracticeState, ReadingExercise, ReadingState } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useEngine, usePractice, useReading } from "@/providers/audio-engine-context";

import { NOTE_CLASSES, ReadingScore, type Slot, slotKey } from "./reading-score";
import { ReadingSettingsCard } from "./reading-settings-card";
import { useReadingExercise } from "./use-reading-exercise";

/** What the user last started from this tab (results belong to it). */
type Action = "listen" | "ownPace";

function describe(exercise: ReadingExercise, bpm: number): string {
  const { root, scale, rhythm } = exercise;
  const name = `${pitchLabel(root, false)} ${SCALE_LABELS[scale].name.toLowerCase()}`;
  const bars = rhythm.bars.length;
  return `${name} · ${rhythm.timeSignature.beatsPerBar}/4 · ${bars} ${bars === 1 ? "bar" : "bars"} · ${bpm} BPM`;
}

/** Sight reading: a generated melody in standard notation; listen to it,
 * then play it at your own pace (ADR 0012). */
export function ReadingPractice() {
  const {
    status,
    settings,
    calibration,
    listenToReading,
    startReadingPractice,
    stopReadingPractice,
    stopRhythmPractice,
  } = useEngine();
  const practice = usePractice();
  const reading = useReading();
  const { bpm, melody } = settings.practice.reading;
  const { exercise, error: generateError, regenerate } = useReadingExercise(
    melody,
    settings.practice.pitch.instrument,
  );
  // Results belong to the exercise that was played; a new one hides them.
  const [played, setPlayed] = useState<{ exercise: ReadingExercise; action: Action } | null>(
    null,
  );
  const mine = played !== null && played.exercise === exercise;
  const [startError, setStartError] = useState<string | null>(null);

  const listening =
    mine && played.action === "listen" && practice.phase === "running" && practice.mode.kind === "melody";
  const ownPace = mine && played.action === "ownPace" && reading.phase === "running";
  const running = listening || ownPace;
  const canStart =
    exercise !== null &&
    status.state === "running" &&
    calibration.phase !== "running" &&
    practice.phase !== "running" &&
    reading.phase !== "running";

  // Stop what this tab started when the tab (or the Practice screen) goes away.
  const latest = useRef({ listening, ownPace, stopRhythmPractice, stopReadingPractice });
  useEffect(() => {
    latest.current = { listening, ownPace, stopRhythmPractice, stopReadingPractice };
  });
  useEffect(
    () => () => {
      const l = latest.current;
      if (l.listening) l.stopRhythmPractice().catch(() => {});
      if (l.ownPace) l.stopReadingPractice().catch(() => {});
    },
    [],
  );

  const start = (action: Action) => {
    if (!exercise) return;
    setStartError(null);
    setPlayed({ exercise, action });
    const command = action === "listen" ? listenToReading : startReadingPractice;
    command(exercise).catch((e) => setStartError(String(e)));
  };
  const stop = () => (listening ? stopRhythmPractice() : stopReadingPractice()).catch(() => {});

  const { classes, active } = useMemo(
    () => noteStates(exercise, mine, practice, reading, listening),
    [exercise, mine, practice, reading, listening],
  );

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
                <Button onClick={() => start("ownPace")} disabled={!canStart}>
                  <Play />
                  Play at my own pace
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Status
            exercise={exercise}
            action={mine ? played.action : null}
            practice={practice}
            reading={reading}
          />
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
    </div>
  );
}

/** Note colours and the highlighted note for the current session. */
function noteStates(
  exercise: ReadingExercise | null,
  mine: boolean,
  practice: PracticeState,
  reading: ReadingState,
  listening: boolean,
): { classes: Map<string, string>; active: Slot | null } {
  const classes = new Map<string, string>();
  if (!exercise || !mine) return { classes, active: null };
  if (listening && practice.phase === "running" && practice.positionBeats !== null) {
    return { classes, active: symbolAt(exercise.rhythm, practice.positionBeats) };
  }
  switch (reading.phase) {
    case "running": {
      exercise.notes
        .slice(0, reading.progress)
        .forEach((n) => classes.set(slotKey(n), NOTE_CLASSES.correct));
      return { classes, active: exercise.notes[reading.progress] ?? null };
    }
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
  if (action === "listen") {
    switch (practice.phase) {
      case "running":
        return <ListeningLine practice={practice} exercise={exercise} />;
      case "failed":
        return <ErrorLine message={practice.message} />;
      case "idle":
      case "finished":
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
            Play it again, or press New melody.
          </p>
        );
      case "failed":
        return <ErrorLine message={reading.message} />;
      case "idle":
        break;
    }
  }
  return (
    <p className="text-sm text-muted-foreground">
      Read the melody, then press Listen to hear it at the tempo (after 4 count-in clicks), or Play
      at my own pace: play the blue note, it turns green when it is right, and the next note turns
      blue. Take your time; only the pitch counts.
    </p>
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

function ListeningLine({
  practice,
  exercise,
}: {
  practice: Extract<PracticeState, { phase: "running" }>;
  exercise: ReadingExercise | null;
}) {
  const pos = practice.positionBeats;
  if (pos === null || pos < 0) {
    const click = pos === null ? 0 : Math.floor(pos + practice.countInBeats) + 1;
    return (
      <p className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400" aria-live="polite">
        <Headphones className="size-4" />
        Listen · count-in {click > 0 ? click : ""}
      </p>
    );
  }
  const beats = exercise?.rhythm.timeSignature.beatsPerBar ?? 4;
  const bars = exercise?.rhythm.bars.length ?? 0;
  return (
    <p className="flex items-center gap-2 font-mono text-sm tabular-nums text-sky-600 dark:text-sky-400">
      <Headphones className="size-4" />
      Listening · bar {Math.min(Math.floor(pos / beats) + 1, bars)} of {bars}
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
