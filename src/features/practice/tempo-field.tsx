import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MAX_BPM, MIN_BPM } from "@/lib/engine";

type TempoFieldProps = {
  id: string;
  bpm: number;
  /** Called with a value clamped to MIN_BPM..MAX_BPM, once dragging ends. */
  onChange: (bpm: number) => void;
  disabled?: boolean;
};

/** Tempo slider with −/+ buttons (quarter note = beat). Shared by the
 * practice subsections that use a metronome. */
export function TempoField({ id, bpm, onChange, disabled }: TempoFieldProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? bpm;
  const set = (value: number) => onChange(Math.min(MAX_BPM, Math.max(MIN_BPM, value)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Tempo</Label>
        <span className="font-mono text-sm tabular-nums">{shown} BPM</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Slower"
          disabled={disabled || shown <= MIN_BPM}
          onClick={() => set(shown - 1)}
        >
          <Minus />
        </Button>
        <Slider
          id={id}
          min={MIN_BPM}
          max={MAX_BPM}
          step={1}
          value={[shown]}
          disabled={disabled}
          onValueChange={([v]) => setDragging(v)}
          onValueCommit={([v]) => {
            setDragging(null);
            set(v);
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Faster"
          disabled={disabled || shown >= MAX_BPM}
          onClick={() => set(shown + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
