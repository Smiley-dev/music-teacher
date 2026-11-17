import { ChoiceButtons } from "@/components/choice-buttons";
import { EngineStatusBanner } from "@/components/engine-status-banner";
import { OptionCheckbox } from "@/components/option-checkbox";
import { SplitLayout } from "@/components/rack";
import { OptionsPanel } from "@/features/practice/options-panel";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import {
  type Directions,
  INTERVAL_NAMES,
  type IntervalOptions,
  type PitchTask,
} from "@/lib/engine";
import { INTERVAL_LABELS } from "@/lib/pitch-labels";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

const DIRECTIONS: { id: Directions; label: string }[] = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
  { id: "both", label: "Both" },
];

function describe(task: PitchTask): string {
  if (task.prompt.kind !== "interval") return "Play these notes";
  const { interval, direction } = task.prompt;
  return `${INTERVAL_LABELS[interval].name} ${direction === "up" ? "↑" : "↓"}`;
}

/** Intervals: the first note is shown with an interval; play both notes. */
export function IntervalsPractice() {
  const { status } = useEngine();
  const running = usePitchPractice().phase === "running";
  const { pitch, update, error } = usePitchSettings();
  const options = pitch.intervals;
  const set = (change: Partial<IntervalOptions>) =>
    update({ intervals: { ...options, ...change } });

  return (
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />
      <SplitLayout
        aside={
          <OptionsPanel
            locked={running}
            error={error}
            theory={{ topic: "intervals", label: "How intervals work" }}
          >
            <OptionChecklist
              legend="Intervals"
              idPrefix="interval"
              items={INTERVAL_NAMES}
              label={(i) => INTERVAL_LABELS[i].name}
              description={(i) =>
                i === "tritone" ? "A4: augmented 4th" : INTERVAL_LABELS[i].short
              }
              selected={options.intervals}
              disabled={running}
              onChange={(intervals) => set({ intervals })}
            />
            <ChoiceButtons
              label="Direction"
              options={DIRECTIONS}
              value={options.directions}
              disabled={running}
              onChange={(directions) => set({ directions })}
            />
            <OptionCheckbox
              id="intervals-show-both"
              label="Show both notes"
              description="Read the second note instead of working it out."
              checked={options.showBoth}
              disabled={running}
              onChange={(showBoth) => set({ showBoth })}
            />
          </OptionsPanel>
        }
      >
        <PitchSessionCard
          exercise="intervals"
          title="Build the interval"
          description="Play the note shown, then the note at that interval from it."
          instructions={
            <p>
              Press Start. Each task shows a note and an interval such as "Major 3rd ↑". Play the
              note, then the note that distance above (or below) it. Any octave is fine, as long
              as the second note is the right distance from the first. The second note appears on
              the staff once you play it. Hear it plays both notes; Skip shows the answer.
            </p>
          }
          describe={describe}
          blocked={options.intervals.length === 0 ? "Select at least one interval." : null}
        />
      </SplitLayout>
    </div>
  );
}
