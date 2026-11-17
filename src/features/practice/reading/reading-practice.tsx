import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Dices, Headphones, Play, Square, Timer } from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Button } from "@/components/ui/button";
import { Display, Lamp, Panel, Readout, SplitLayout, StatusStrip } from "@/components/rack";
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
import { SCALE_LABELS, pitchLabel, prettyNoteName } from "@/lib/pitch-labels";
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

/** What the user last started from this page (results belong to it). */
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
    settings.instrument,
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

  // Stop what this page started when the user goes to another page.
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
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />
      <SplitLayout
        asideFirst
        aside={<ReadingSettingsCard disabled={running} tabAvailable={exercise?.tab != null} />}
      >
        <Panel aria-label="Melody" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap justify-between gap-2.5 font-mono text-xs tracking-[0.08em] uppercase">
            <span className="font-bold text-signal">
              {exercise ? describe(exercise, bpm) : "No melody yet"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <>
                <span className="flex h-10 items-center gap-2 rounded-lg border-b-[3px] border-primary bg-secondary px-3.5 font-mono text-xs font-bold tracking-[0.06em] uppercase">
                  <Lamp on tone="signal" />
                  {action === "listen"
                    ? "Listening"
                    : action === "ownPace"
                      ? "At my own pace"
                      : "With metronome"}
                </span>
                <div className="flex-1" />
                <Button variant="destructive" onClick={stop}>
                  <Square className="fill-current" />
                  Stop
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => start("listen")} disabled={!canStart}>
                  <Headphones />
                  Listen
                </Button>
                <Button variant="outline" onClick={() => start("ownPace")} disabled={!canStart}>
                  <Play />
                  At my own pace
                </Button>
                <Button onClick={() => start("metronome")} disabled={!canStart}>
                  <Timer />
                  With metronome
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={regenerate}>
                  <Dices />
                  New melody
                </Button>
              </>
            )}
          </div>

          <Status exercise={exercise} action={action} practice={practice} reading={reading} />
          {action === "metronome" && rhythmRunning && (
            <div className="flex flex-wrap gap-2">
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
          {exercise && (
            <Display className="px-2.5 py-4 sm:px-2.5">
              <ReadingScore
                exercise={exercise}
                classes={classes}
                active={active}
                showTab={settings.practice.reading.showTab}
              />
            </Display>
          )}
        </Panel>
      </SplitLayout>

      {exercise && finishedWithMetronome && (
        <div className="flex flex-wrap items-start gap-5">
          <TimingAnalysis
            report={finishedWithMetronome.report}
            calibrated={calibrated}
            minGapMs={gapMs}
            className="min-w-0 flex-[999_1_32rem]"
          />
          {finishedWithMetronome.pitch && (
            <PitchAnalysis
              report={finishedWithMetronome.pitch}
              exercise={exercise}
              className="min-w-0 flex-[1_1_21rem]"
            />
          )}
        </div>
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
        return <ClockLine practice={practice} exercise={exercise} />;
      case "finished":
        return (
          <StatusStrip tone="ok">
            <Lamp on tone="ok" />
            {action === "listen"
              ? "That's how it goes. Now play it at your own pace or with the metronome."
              : "Done! Timing and notes are below. Purple notes had the wrong pitch."}
          </StatusStrip>
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
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2 text-center">
              <Readout label="Notes" value={reading.notes} className="flex-[1_1_5rem]" />
              <Readout
                label="Time taken"
                value={minutes(reading.seconds)}
                className="flex-[1_1_5rem]"
              />
              <Readout
                label="Wrong notes"
                value={reading.mistakes}
                tone={reading.mistakes > 0 ? "bad" : "ok"}
                className="flex-[1_1_5rem]"
              />
            </div>
            <StatusStrip tone="ok">
              <Lamp on tone="ok" />
              Done! Try it with the metronome next.
            </StatusStrip>
          </div>
        );
      case "failed":
        return <ErrorLine message={reading.message} />;
      case "idle":
        break;
    }
  }
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
      <li>
        <span className="font-bold text-foreground">Listen</span> plays the melody at the tempo
        after 4 count-in clicks.
      </li>
      <li>
        <span className="font-bold text-foreground">At my own pace</span>: play the blue note; it
        turns green when it is right and the next one turns blue. Only the pitch counts.
      </li>
      <li>
        <span className="font-bold text-foreground">With metronome</span>: after 4 count-in
        clicks, play along. Every note is judged for timing (green, amber, red) and pitch (purple
        when wrong).
      </li>
    </ul>
  );
}

/** Seconds as m:ss. */
function minutes(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ErrorLine({ message }: { message: string }) {
  return (
    <StatusStrip tone="bad">
      <AlertTriangle className="size-4 shrink-0" />
      {message}
    </StatusStrip>
  );
}

/** Count-in, then bar and beat, while listening or playing with the metronome. */
function ClockLine({
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
      <div className="flex items-center gap-4 self-start rounded-lg bg-inset px-3 py-2" aria-live="polite">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
          COUNT-IN
        </span>
        <div className="flex gap-2">
          {Array.from({ length: practice.countInBeats }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex size-9 items-center justify-center rounded-md font-mono font-bold",
                i < click
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--primary)]"
                  : "bg-muted text-muted-foreground",
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
  const bar = Math.min(Math.floor(pos / beats) + 1, bars);
  const beat = Math.floor(pos % beats) + 1;
  return (
    <div
      className="flex items-center gap-3 self-start rounded-lg bg-inset px-3 py-2 font-mono"
      aria-live="off"
      aria-label={`Bar ${bar} of ${bars}, beat ${beat}`}
    >
      <span className="text-[10px] tracking-[0.1em] text-muted-foreground">BAR · BEAT</span>
      <span className="text-[22px] font-bold text-signal tabular-nums">
        {bar}·{beat}
      </span>
      <span className="text-[11px] text-muted-foreground">OF {bars}</span>
    </div>
  );
}

function OwnPaceLine({ reading }: { reading: Extract<ReadingState, { phase: "running" }> }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-stretch gap-2 font-mono">
        <div className="flex items-center gap-3 rounded-lg bg-inset px-3 py-2">
          <span className="text-[10px] tracking-[0.1em] text-muted-foreground">NOTE</span>
          <span className="text-[22px] font-bold text-signal tabular-nums">
            {Math.min(reading.progress + 1, reading.total)}
          </span>
          <span className="text-[11px] text-muted-foreground">OF {reading.total}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-inset px-3 text-xs tracking-[0.08em] uppercase">
          <Lamp on={reading.heard !== null} tone="signal" />
          <span className={reading.heard ? "text-signal" : "text-muted-foreground"}>
            {reading.heard ? `Hearing ${prettyNoteName(reading.heard)}` : "Hearing nothing"}
          </span>
        </div>
        <div className="flex items-center rounded-lg bg-inset px-3 text-xs tracking-[0.08em] text-muted-foreground uppercase">
          <span className={cn("mr-1", reading.mistakes > 0 && "font-bold text-red-500")}>
            {reading.mistakes}
          </span>
          wrong {reading.mistakes === 1 ? "note" : "notes"}
        </div>
      </div>
      {reading.wrong && (
        <StatusStrip tone="bad">
          ✕ Not quite: that was {prettyNoteName(reading.wrong)}. Try again.
        </StatusStrip>
      )}
    </div>
  );
}
