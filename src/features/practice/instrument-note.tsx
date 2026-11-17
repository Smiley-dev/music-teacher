import { INSTRUMENT_INFO } from "@/lib/pitch-labels";
import { useSettings } from "@/providers/audio-engine-context";

/** Which instrument an exercise is written for and the range it uses. The
 * instrument itself is chosen in the top bar (ADR 0015). */
export function InstrumentNote() {
  const { label, hint } = INSTRUMENT_INFO[useSettings().instrument];
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-inset px-3 py-2.5 text-xs">
      <p className="font-mono tracking-[0.1em] text-muted-foreground uppercase">
        Written for <span className="font-bold text-foreground">{label}</span>
      </p>
      <p className="text-muted-foreground">
        {hint} Change the instrument in the top bar.
      </p>
    </div>
  );
}
