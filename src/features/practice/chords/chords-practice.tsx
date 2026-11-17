import { EngineStatusBanner } from "@/components/engine-status-banner";
import { OptionCheckbox } from "@/components/option-checkbox";
import { SplitLayout } from "@/components/rack";
import { OptionsPanel } from "@/features/practice/options-panel";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import { CHORD_KINDS, type ChordOptions, type PitchTask } from "@/lib/engine";
import { CHORD_LABELS, ordinal, pitchLabel } from "@/lib/pitch-labels";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

function describe(task: PitchTask): string {
  if (task.prompt.kind !== "chord") return "Play these notes";
  const { root, chord, inversion } = task.prompt;
  const label = CHORD_LABELS[chord];
  const name = pitchLabel(root, false);
  const position = inversion === 0 ? "root position" : `${ordinal(inversion)} inversion`;
  return `${name} ${label.name.toLowerCase()} (${name}${label.symbol}), ${position}`;
}

/** Chords: play a named chord's notes one at a time, lowest first. */
export function ChordsPractice() {
  const { status } = useEngine();
  const running = usePitchPractice().phase === "running";
  const { pitch, update, error } = usePitchSettings();
  const options = pitch.chords;
  const set = (change: Partial<ChordOptions>) => update({ chords: { ...options, ...change } });

  return (
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />
      <SplitLayout
        aside={
          <OptionsPanel
            locked={running}
            error={error}
            theory={{ topic: "chords", label: "Chords and inversions" }}
          >
            <OptionChecklist
              legend="Chords"
              idPrefix="chord"
              items={CHORD_KINDS}
              label={(c) => CHORD_LABELS[c].name}
              description={(c) => CHORD_LABELS[c].tones}
              selected={options.chords}
              disabled={running}
              onChange={(chords) => set({ chords })}
            />
            <OptionCheckbox
              id="chords-inversions"
              label="Inversions"
              description="Start on the 3rd, 5th or 7th instead of the root."
              checked={options.inversions}
              disabled={running}
              onChange={(inversions) => set({ inversions })}
            />
            <OptionCheckbox
              id="chords-show-notes"
              label="Show the notes"
              description="Read the chord instead of working it out."
              checked={options.showNotes}
              disabled={running}
              onChange={(showNotes) => set({ showNotes })}
            />
          </OptionsPanel>
        }
      >
        <PitchSessionCard
          exercise="chords"
          title="Play the chord"
          description="Play the chord's notes one at a time, from the lowest up."
          instructions={
            <p>
              Press Start. Each task names a chord, such as "A minor (Am), 1st inversion". Play
              its notes one after another from the lowest up (an arpeggio): root position starts
              on the root, 1st inversion on the 3rd, 2nd on the 5th, 3rd on the 7th. Any octave is
              fine for the first note; the others must go up from it. Notes appear on the staff as
              you play them. Hear it plays the arpeggio; Skip shows it.
            </p>
          }
          describe={describe}
          blocked={options.chords.length === 0 ? "Select at least one chord." : null}
        />
      </SplitLayout>
    </div>
  );
}
