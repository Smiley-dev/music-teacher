import { useState } from "react";
import { Lock } from "lucide-react";

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
 * top bar: Practice and Theory write, play and judge notes for it. Locked
 * while an exercise runs, since that exercise was made for it. */
export function InstrumentSelect({ className }: { className?: string }) {
  const { settings, setInstrument } = useEngine();
  const running = useExerciseRunning();
  const [error, setError] = useState<string | null>(null);
  const change = (instrument: Instrument) => {
    setError(null);
    setInstrument(instrument).catch((e) => setError(String(e)));
  };
  const info = INSTRUMENT_INFO[settings.instrument];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor="instrument" className="rack-label tracking-[0.14em]">
        Instrument
      </Label>
      <Select
        value={settings.instrument}
        onValueChange={(v) => change(v as Instrument)}
        disabled={running}
      >
        <SelectTrigger
          id="instrument"
          className="h-9 w-48"
          title={running ? "Stop the exercise to change it." : info.hint}
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
        <span className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-signal">
          <Lock className="size-3" aria-hidden />
          LOCKED
          <span className="sr-only">: stop the exercise to change the instrument</span>
        </span>
      )}
      {error && (
        <span role="alert" className="max-w-48 truncate text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
