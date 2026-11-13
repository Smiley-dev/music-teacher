import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstrumentSelect } from "@/features/practice/pitch/instrument-select";
import { OptionCheckbox } from "@/features/practice/pitch/option-checkbox";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { SCALE_LABELS, pitchLabel } from "@/features/practice/pitch/pitch-labels";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import { type PitchTask, SCALE_KINDS, type ScaleOptions } from "@/lib/engine";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

function describe(task: PitchTask): string {
  if (task.prompt.kind !== "scale") return "Play these notes";
  const { root, scale, upAndDown } = task.prompt;
  return `${pitchLabel(root, false)} ${SCALE_LABELS[scale].name.toLowerCase()}, ${
    upAndDown ? "up and down" : "up"
  }`;
}

/** Scales: play a named scale or mode from the root shown. */
export function ScalesPractice() {
  const { status } = useEngine();
  const running = usePitchPractice().phase === "running";
  const { pitch, update, error } = usePitchSettings();
  const options = pitch.scales;
  const set = (change: Partial<ScaleOptions>) => update({ scales: { ...options, ...change } });

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
            legend="Scales and modes"
            idPrefix="scale"
            items={SCALE_KINDS}
            label={(s) => SCALE_LABELS[s].name}
            description={(s) => SCALE_LABELS[s].hint}
            selected={options.scales}
            disabled={running}
            onChange={(scales) => set({ scales })}
          />
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <OptionCheckbox
              id="scales-up-and-down"
              label="Up and down"
              description="Back down to the root after the octave."
              checked={options.upAndDown}
              disabled={running}
              onChange={(upAndDown) => set({ upAndDown })}
            />
            <OptionCheckbox
              id="scales-show-notes"
              label="Show the notes"
              description="Read the scale instead of working it out."
              checked={options.showNotes}
              disabled={running}
              onChange={(showNotes) => set({ showNotes })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <PitchSessionCard
        exercise="scales"
        title="Play the scale"
        description="Play the named scale from the root shown, one note at a time."
        instructions={
          <p>
            Press Start. Each task names a scale, such as "E♭ major, up", and shows its root. Play
            the scale note by note from that root up to the octave (and back down if selected).
            Start in any octave, but keep going in that octave. Each note appears on the staff as
            you play it; a wrong note is named and the scale waits for the right one. Hear it plays
            the whole scale; Skip shows it.
          </p>
        }
        describe={describe}
        blocked={options.scales.length === 0 ? "Select at least one scale." : null}
      />
    </div>
  );
}
