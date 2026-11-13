import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NoteReadingOptions } from "@/lib/engine";
import { InstrumentSelect } from "@/features/practice/pitch/instrument-select";
import { OptionCheckbox } from "@/features/practice/pitch/option-checkbox";
import { PitchSessionCard } from "@/features/practice/pitch/pitch-session-card";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import { useEngine, usePitchPractice } from "@/providers/audio-engine-context";

/** Note reading: a note appears on the staff, play it. */
export function NotesPractice() {
  const { status } = useEngine();
  const running = usePitchPractice().phase === "running";
  const { pitch, update, error } = usePitchSettings();
  const options = pitch.notes;
  const set = (change: Partial<NoteReadingOptions>) => update({ notes: { ...options, ...change } });

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
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <OptionCheckbox
              id="notes-ledger"
              label="Ledger lines"
              description="Notes above and below the staff."
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
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <PitchSessionCard
        exercise="notes"
        title="Read and play"
        description="A note appears on the staff: find it on your instrument and play it."
        instructions={
          <p>
            Press Start. Play each note as it appears and hold it for a moment; it turns green when
            it is right, and the next note follows. A wrong note is named so you can correct it.
            Stuck? Hear it plays the note, Skip shows the next one.
          </p>
        }
        describe={(task) =>
          task.matching === "anyOctave" ? "Play this note (any octave)" : "Play this note"
        }
      />
    </div>
  );
}
