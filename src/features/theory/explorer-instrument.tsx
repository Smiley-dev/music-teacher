import { InstrumentSelect } from "@/components/instrument-select";
import { usePitchSettings } from "@/components/use-pitch-settings";

/** The instrument an explorer writes and plays its example for: the one
 * saved for the note exercises, so changing it here changes it there too. */
export function ExplorerInstrument() {
  const { pitch, update, error } = usePitchSettings();
  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <InstrumentSelect
        value={pitch.instrument}
        onChange={(instrument) => update({ instrument })}
        disabled={false}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
