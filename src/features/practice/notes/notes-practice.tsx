import { EngineStatusBanner } from "@/components/engine-status-banner";
import { OptionCheckbox } from "@/components/option-checkbox";
import { SplitLayout } from "@/components/rack";
import { OptionsPanel } from "@/features/practice/options-panel";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import type { NoteReadingOptions } from "@/lib/engine";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

/** Note reading: a note appears on the staff, play it. */
export function NotesPractice() {
  const { status } = useEngine();
  const running = usePitchPractice().phase === "running";
  const { pitch, update, error } = usePitchSettings();
  const options = pitch.notes;
  const set = (change: Partial<NoteReadingOptions>) => update({ notes: { ...options, ...change } });

  return (
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />
      <SplitLayout
        aside={
          <OptionsPanel
            locked={running}
            error={error}
            theory={{ topic: "notes", label: "Notes on the staff" }}
          >
            <OptionCheckbox
              id="notes-ledger"
              label="Ledger lines"
              description="Notes above and below the staff, up to the instrument's range."
              checked={options.ledgerLines}
              disabled={running}
              onChange={(ledgerLines) => set({ ledgerLines })}
            />
            <OptionCheckbox
              id="notes-accidentals"
              label="Sharps and flats"
              description="Not only natural notes."
              checked={options.accidentals}
              disabled={running}
              onChange={(accidentals) => set({ accidentals })}
            />
            <OptionCheckbox
              id="notes-octave"
              label="Any octave"
              description="Accept the note name in any octave."
              checked={options.anyOctave}
              disabled={running}
              onChange={(anyOctave) => set({ anyOctave })}
            />
          </OptionsPanel>
        }
      >
        <PitchSessionCard
          exercise="notes"
          title="Read and play"
          description="A note appears on the staff: find it on your instrument and play it."
          instructions={
            <p>
              Press Start. Play each note as it appears and hold it for a moment; it turns green
              when it is right, and the next note follows. A wrong note is named so you can correct
              it. Stuck? Hear it plays the note, Skip shows the next one.
            </p>
          }
          describe={(task) =>
            task.matching === "anyOctave" ? "Play this note (any octave)" : "Play this note"
          }
        />
      </SplitLayout>
    </div>
  );
}
