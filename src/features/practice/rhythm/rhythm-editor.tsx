import { useState } from "react";
import { Eraser, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type ExerciseDraft,
  MAX_WRITTEN_SYMBOLS,
  NOTE_VALUES,
  type NoteValue,
  type Symbol,
  symbolDuration,
} from "@/lib/engine";
import { cn } from "@/lib/utils";

/** SMuFL code points in the Bravura font (loaded by VexFlow). */
const NOTE_GLYPHS: Record<NoteValue, string> = {
  whole: "",
  half: "",
  quarter: "",
  eighth: "",
  sixteenth: "",
};
const REST_GLYPHS: Record<NoteValue, string> = {
  whole: "",
  half: "",
  quarter: "",
  eighth: "",
  sixteenth: "",
};
const DOT_GLYPH = "";

const VALUE_LABELS: Record<NoteValue, string> = {
  whole: "Whole",
  half: "Half",
  quarter: "Quarter",
  eighth: "Eighth",
  sixteenth: "Sixteenth",
};

function Glyph({ symbol, className }: { symbol: Symbol; className?: string }) {
  const glyph = (symbol.rest ? REST_GLYPHS : NOTE_GLYPHS)[symbol.value];
  return (
    <span
      aria-hidden
      className={cn("inline-block leading-none", className)}
      style={{ fontFamily: "Bravura", fontSize: 26, lineHeight: "40px" }}
    >
      {glyph}
      {symbol.dotted && <span className="ml-0.5">{DOT_GLYPH}</span>}
    </span>
  );
}

const describe = (s: Symbol) =>
  `${s.dotted ? "dotted " : ""}${VALUE_LABELS[s.value].toLowerCase()} ${s.rest ? "rest" : "note"}`;

type RhythmEditorProps = {
  written: Symbol[];
  draft: ExerciseDraft | null;
  /** Error from laying the rhythm out (e.g. after a time signature change). */
  error: string | null;
  beatsPerBar: number;
  disabled: boolean;
  onChange: (written: Symbol[]) => void;
};

/** Write a rhythm note by note: pick a length, optionally dotted or a rest,
 * and it is added at the end. Bars fill up automatically. */
export function RhythmEditor({
  written,
  draft,
  error,
  beatsPerBar,
  disabled,
  onChange,
}: RhythmEditorProps) {
  const [dotted, setDotted] = useState(false);
  const [rest, setRest] = useState(false);

  const barLen = beatsPerBar * 4;
  const bars = draft?.exercise.bars.length ?? 0;
  // Room left in the bar being written (a full last bar starts a new one).
  const room = !draft || draft.remaining === 0 ? barLen : draft.remaining;
  const full = written.length >= MAX_WRITTEN_SYMBOLS;

  const add = (value: NoteValue) => {
    onChange([...written, { value, dotted: dotted && value !== "sixteenth", rest }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={rest ? "secondary" : "outline"}
          size="sm"
          aria-pressed={!rest}
          disabled={disabled}
          onClick={() => setRest(false)}
        >
          Notes
        </Button>
        <Button
          variant={rest ? "outline" : "secondary"}
          size="sm"
          aria-pressed={rest}
          disabled={disabled}
          onClick={() => setRest(true)}
          className={cn(rest && "ring-2 ring-ring")}
        >
          Rests
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button
          variant={dotted ? "default" : "outline"}
          size="sm"
          aria-pressed={dotted}
          disabled={disabled}
          onClick={() => setDotted((d) => !d)}
        >
          Dotted
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {NOTE_VALUES.map((value) => {
          const symbol: Symbol = { value, dotted: dotted && value !== "sixteenth", rest };
          const fits = symbolDuration(symbol) <= room;
          const unavailable = dotted && value === "sixteenth";
          return (
            <Button
              key={value}
              variant="outline"
              className="h-auto flex-col gap-0 py-1"
              disabled={disabled || !fits || unavailable || full || error !== null}
              title={
                unavailable
                  ? "Dotted sixteenths are not used (sixteenth is the shortest length)"
                  : fits
                    ? `Add a ${describe(symbol)}`
                    : "Doesn't fit in the rest of this bar"
              }
              aria-label={`Add ${describe(symbol)}`}
              onClick={() => add(value)}
            >
              <Glyph symbol={symbol} />
              <span className="text-[11px] text-muted-foreground">{VALUE_LABELS[value]}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {written.length === 0
            ? "Pick a length to add the first note."
            : draft?.complete
              ? `${bars} bar${bars === 1 ? "" : "s"}, ready to play. Keep adding to make it longer.`
              : draft && draft.remaining === 0
                ? "Add at least one note (not only rests)."
                : `Bar ${bars}: ${room / 4} beat${room === 4 ? "" : "s"} left to fill.`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || written.length === 0}
            onClick={() => onChange(written.slice(0, -1))}
          >
            <Undo2 />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || written.length === 0}
            onClick={() => onChange([])}
          >
            <Eraser />
            Clear
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">
          {error}. Undo the last notes or clear the rhythm (the time signature may have changed).
        </p>
      )}
    </div>
  );
}
