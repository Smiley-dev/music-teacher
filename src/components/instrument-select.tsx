import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INSTRUMENTS, type Instrument } from "@/lib/engine";
import { INSTRUMENT_INFO } from "@/lib/pitch-labels";
import { cn } from "@/lib/utils";
import { useEngine, useExerciseRunning } from "@/providers/audio-engine-context";

/** The one instrument choice of the app (ADR 0015), always visible in the
 * main menu: Practice and Theory write, play and judge notes for it. Locked
 * while an exercise runs, since that exercise was made for it. */
export function InstrumentSelect({ className }: { className?: string }) {
  const { settings, setInstrument } = useEngine();
  const running = useExerciseRunning();
  const [error, setError] = useState<string | null>(null);
  const change = (instrument: Instrument) => {
    setError(null);
    setInstrument(instrument).catch((e) => setError(String(e)));
  };

  return (
    <div className={cn("flex flex-col gap-1.5 px-2", className)}>
      <Label htmlFor="instrument" className="font-normal text-muted-foreground">
        Instrument
      </Label>
      <Select
        value={settings.instrument}
        onValueChange={(v) => change(v as Instrument)}
        disabled={running}
      >
        <SelectTrigger
          id="instrument"
          className="w-full bg-background"
          title={INSTRUMENT_INFO[settings.instrument].hint}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INSTRUMENTS.map((i) => (
            <SelectItem key={i} value={i}>
              {INSTRUMENT_INFO[i].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {running && (
        <p className="text-xs text-muted-foreground">Stop the exercise to change it.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
