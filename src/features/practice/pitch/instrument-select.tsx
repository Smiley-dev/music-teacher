import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INSTRUMENTS, type Instrument } from "@/lib/engine";

import { INSTRUMENT_INFO } from "./pitch-labels";

type InstrumentSelectProps = {
  value: Instrument;
  onChange: (instrument: Instrument) => void;
  disabled: boolean;
};

/** The instrument every pitch exercise is written and judged for. */
export function InstrumentSelect({ value, onChange, disabled }: InstrumentSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="instrument">Instrument</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as Instrument)}
        disabled={disabled}
      >
        <SelectTrigger id="instrument" className="w-60">
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
      <p className="text-sm text-muted-foreground">
        {INSTRUMENT_INFO[value].hint} Used by every note exercise.
      </p>
    </div>
  );
}
