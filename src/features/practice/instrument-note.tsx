import { INSTRUMENT_INFO } from "@/lib/pitch-labels";
import { useSettings } from "@/providers/audio-engine-context";

/** Which instrument an exercise is written for and the range it uses. The
 * instrument itself is chosen in the main menu (ADR 0015). */
export function InstrumentNote() {
  const { label, hint } = INSTRUMENT_INFO[useSettings().instrument];
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        <span className="text-muted-foreground">Written for </span>
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground"> (change it in the main menu)</span>
      </p>
      <p className="text-muted-foreground">{hint}</p>
    </div>
  );
}
