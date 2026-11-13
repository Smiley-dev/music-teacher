import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceButtons } from "@/features/practice/pitch/choice-buttons";
import { InstrumentSelect } from "@/features/practice/pitch/instrument-select";
import { OptionCheckbox } from "@/features/practice/pitch/option-checkbox";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { INTERVAL_LABELS } from "@/features/practice/pitch/pitch-labels";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import {
  type Directions,
  INTERVAL_NAMES,
  type IntervalOptions,
  type PitchTask,
} from "@/lib/engine";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

const DIRECTIONS: { id: Directions; label: string }[] = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
  { id: "both", label: "Both" },
];

function describe(task: PitchTask): string {
  if (task.prompt.kind !== "interval") return "Play these notes";
  const { interval, direction } = task.prompt;
  return `${INTERVAL_LABELS[interval].name} ${direction}`;
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
    <div className="flex flex-col gap-6">
      <EngineStatusBanner status={status} />
      <Card>
        <CardHeader>
          <CardTitle>Exercise</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <InstrumentSelect
            value={pitch.instrument}
            onChange={(instrument) => update({ instrument })}
            disabled={running}
          />
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
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
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
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <PitchSessionCard
        exercise="intervals"
        title="Build the interval"
        description="Play the note shown, then the note at that interval from it."
        instructions={
          <p>
            Press Start. Each task shows a note and an interval such as "Major 3rd up". Play the
            note, then the note that distance above (or below) it. Any octave is fine, as long as
            the second note is the right distance from the first. The second note appears on the
            staff once you play it. Hear it plays both notes; Skip shows the answer.
          </p>
        }
        describe={describe}
        blocked={options.intervals.length === 0 ? "Select at least one interval." : null}
      />
    </div>
  );
}
