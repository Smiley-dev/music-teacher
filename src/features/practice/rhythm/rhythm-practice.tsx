import { useState } from "react";
import { AlertTriangle, Dices, Headphones, Play, Square } from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Display, Lamp, Panel, PanelLabel, SplitLayout, StatusStrip } from "@/components/rack";
import { Button } from "@/components/ui/button";
import type { Exercise, PracticeState } from "@/lib/engine";
import { cn } from "@/lib/utils";
import {
  useEngine,
  useLatency,
  usePractice,
  usePracticeJudgements,
} from "@/providers/audio-engine-context";

import { AccuracyTips, FastNotesWarning, minGapMs } from "./accuracy-notice";
import { LatencyStatus } from "./latency-status";
import { symbolAt } from "./render-score";
import { RhythmEditor } from "./rhythm-editor";
import { RhythmScore } from "./rhythm-score";
import { RhythmSettingsCard } from "./rhythm-settings-card";
import { LiveTimingCounts, TimingAnalysis } from "./timing-analysis";
import { useRhythmExercise } from "./use-rhythm-exercise";

export function RhythmPractice() {
  const {
    status,
    settings,
    calibration,
    startRhythmPractice,
    listenToRhythm,
    stopRhythmPractice,
    setRhythmSettings,
  } = useEngine();
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
  const [editError, setEditError] = useState<string | null>(null);

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
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />
      <SplitLayout asideFirst aside={<RhythmSettingsCard disabled={running} />}>
        {writing && (
          <Panel aria-label="Write your own" className="flex flex-col gap-3.5">
            <PanelLabel tone={running ? "signal" : "muted"}>
              {running ? "Write your own · locked while playing" : "Write your own"}
            </PanelLabel>
            <RhythmEditor
              written={rhythm.written}
              draft={draft}
              error={generateError}
              beatsPerBar={rhythm.timeSignature.beatsPerBar}
              disabled={running}
              onChange={(written) => {
                setEditError(null);
                setRhythmSettings({ ...rhythm, written }).catch((e) => setEditError(String(e)));
              }}
            />
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </Panel>
        )}

        <Panel aria-label="Rhythm exercise" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap justify-between gap-2.5 font-mono text-xs tracking-[0.08em] uppercase">
            <span className="font-bold text-signal">
              {rhythm.bpm} BPM · {rhythm.timeSignature.beatsPerBar}/4 ·{" "}
              {shownExercise?.bars.length ?? 0} bars
            </span>
            <span className="text-muted-foreground">Any note · only the lengths count</span>
          </div>
          {!running && <LatencyStatus disabled={status.state !== "running"} />}

          <SessionStatus
            practice={showResults || listening ? practice : { phase: "idle" }}
            exercise={exercise}
            judgements={judgements}
          />
          <FastNotesWarning gapMs={gapMs} />
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
            <Display className="px-2.5 py-3 sm:px-2.5">
              <RhythmScore exercise={shownExercise} active={active} judgements={judgements} />
            </Display>
          ) : (
            writing && (
              <p className="text-sm text-muted-foreground">Your rhythm will appear here.</p>
            )
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {running ? (
              <Button size="lg" variant="destructive" onClick={() => stopRhythmPractice()}>
                <Square className="fill-current" />
                Stop
              </Button>
            ) : (
              <>
                <Button size="lg" className="px-7" onClick={start} disabled={!canStart}>
                  <Play className="fill-current" />
                  Start
                </Button>
                <Button size="lg" variant="outline" onClick={listen} disabled={!canStart}>
                  <Headphones />
                  Listen
                </Button>
              </>
            )}
            {!writing && (
              <Button size="lg" variant="outline" onClick={regenerate} disabled={running}>
                <Dices />
                New exercise
              </Button>
            )}
          </div>
          {!running && <AccuracyTips />}
        </Panel>
      </SplitLayout>

      {showResults && practice.phase === "finished" && (
        <TimingAnalysis report={practice.report} calibrated={calibrated} minGapMs={gapMs} />
      )}
    </div>
  );
}

function SessionStatus({
  practice,
  exercise,
  judgements,
}: {
  practice: PracticeState;
  exercise: Exercise | null;
  judgements: Parameters<typeof LiveTimingCounts>[0]["judgements"];
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
        <StatusStrip tone="ok">
          <Lamp on tone="ok" />
          Done! Your timing is below. Start to try again, or New exercise for another one.
        </StatusStrip>
      );
    case "failed":
      return (
        <StatusStrip tone="bad">
          <AlertTriangle className="size-4 shrink-0" />
          {practice.message}
        </StatusStrip>
      );
    case "running":
      break;
  }

  const { positionBeats: pos, countInBeats, mode } = practice;
  const listeningTo = mode.kind === "listen" ? mode.note : null;
  if (pos === null || pos < 0) {
    const click = pos === null ? 0 : Math.floor(pos + countInBeats) + 1;
    return (
      <Display className="flex flex-wrap items-center gap-4 py-3 sm:py-3" aria-live="polite">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          {listeningTo ? `Listen (note ${listeningTo}) · count-in` : "Count-in"}
        </span>
        <div className="flex gap-2">
          {Array.from({ length: countInBeats }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex size-10 items-center justify-center rounded-md font-mono text-lg font-bold",
                i < click
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--primary)]"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </Display>
    );
  }

  const beats = exercise?.timeSignature.beatsPerBar ?? 4;
  const bars = exercise?.bars.length ?? 0;
  const bar = Math.min(Math.floor(pos / beats) + 1, bars);
  const beat = Math.floor(pos % beats) + 1;
  return (
    <Display className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 sm:py-3" aria-live="off">
      <div className="font-mono" aria-label={`Bar ${bar} of ${bars}, beat ${beat}`}>
        <div className="text-[10px] tracking-[0.12em] text-muted-foreground">
          {listeningTo ? `LISTENING ON ${listeningTo}` : "BAR"}
        </div>
        <div className="text-[34px] leading-none font-bold text-signal tabular-nums">
          {String(bar).padStart(2, "0")}
          <span className="text-base text-muted-foreground">/{bars}</span>
        </div>
      </div>
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full",
              i + 1 === beat
                ? "bg-primary shadow-[0_0_12px_var(--primary)]"
                : i + 1 < beat
                  ? "bg-primary/35"
                  : "bg-muted",
            )}
          />
        ))}
      </div>
      {!listeningTo && (
        <div className="flex flex-1 flex-wrap gap-2">
          <LiveTimingCounts judgements={judgements} />
        </div>
      )}
    </Display>
  );
}
