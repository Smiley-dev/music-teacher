import { ChoiceButtons } from "@/components/choice-buttons";
import { EngineStatusBanner } from "@/components/engine-status-banner";
import { OptionCheckbox } from "@/components/option-checkbox";
import { SplitLayout } from "@/components/rack";
import { OptionsPanel } from "@/features/practice/options-panel";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import { type EarOptions, MAX_EAR_NOTES, MIN_EAR_NOTES, type PitchTask } from "@/lib/engine";
import { pitchLabel } from "@/lib/pitch-labels";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

const COUNTS = Array.from({ length: MAX_EAR_NOTES - MIN_EAR_NOTES + 1 }, (_, i) => {
  const n = String(MIN_EAR_NOTES + i);
  return { id: n, label: n };
});

type NoteSet = "key" | "chromatic";

const NOTE_SETS: { id: NoteSet; label: string }[] = [
  { id: "key", label: "A major key" },
  { id: "chromatic", label: "Any notes" },
];

function describe(task: PitchTask): string {
  const n = task.notes.length;
  const what = n === 1 ? "Play the note you heard" : `Play back the ${n} notes you heard`;
  if (task.prompt.kind !== "echo" || !task.prompt.key) return what;
  return `${what} (${pitchLabel(task.prompt.key, false)} major)`;
}

/** Ear training: hear a few notes, play them back. */
export function EarPractice() {
  const { status } = useEngine();
  const running = usePitchPractice().phase === "running";
  const { pitch, update, error } = usePitchSettings();
  const options = pitch.ear;
  const set = (change: Partial<EarOptions>) => update({ ear: { ...options, ...change } });

  return (
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />
      <SplitLayout
        aside={
          <OptionsPanel
            locked={running}
            error={error}
            theory={{ topic: "ear", label: "Training your ear" }}
          >
            <div className="flex flex-col gap-2">
              <ChoiceButtons
                label="Notes per task"
                options={COUNTS}
                value={String(options.notes)}
                disabled={running}
                onChange={(n) => set({ notes: Number(n) })}
              />
              <p className="text-xs text-muted-foreground">
                {options.notes === 1
                  ? "One note: find the note you hear on your instrument (pitch matching)."
                  : `A short melody of ${options.notes} notes, steps of at most a 5th (melodic dictation).`}
              </p>
            </div>
            <ChoiceButtons
              label="Notes from"
              options={NOTE_SETS}
              value={options.chromatic ? "chromatic" : "key"}
              disabled={running}
              onChange={(s) => set({ chromatic: s === "chromatic" })}
            />
            <OptionCheckbox
              id="ear-show-first"
              label="Show the first note"
              description="Start from a known note; find the rest by ear."
              checked={options.showFirst}
              disabled={running}
              onChange={(showFirst) => set({ showFirst })}
            />
            <OptionCheckbox
              id="ear-any-octave"
              label="Any octave"
              description="Accept the notes an octave up or down (same shape)."
              checked={options.anyOctave}
              disabled={running}
              onChange={(anyOctave) => set({ anyOctave })}
            />
          </OptionsPanel>
        }
      >
        <PitchSessionCard
          exercise="ear"
          title="Play it back"
          description="Listen to the notes, then play them back on your instrument."
          instructions={
            <>
              <p>
                Press Start and listen: the app plays the notes, then it is your turn. Play them
                back in order; each one appears on the staff when you get it right, and a wrong
                note is named so you can try another. Play again repeats the notes (and starts the
                task over); Skip shows the answer.
              </p>
              <p className="mt-2">
                The notes play on your default output device. While they play, nothing you play is
                judged, so a microphone hearing your speakers does no harm.
              </p>
            </>
          }
          describe={describe}
        />
      </SplitLayout>
    </div>
  );
}
