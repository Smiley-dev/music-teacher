import type { DisplayedNote } from "@/hooks/use-input-monitor";
import { cn } from "@/lib/utils";

const IN_TUNE_CENTS = 5;
const CLOSE_CENTS = 15;

function tuningColor(cents: number) {
  const c = Math.abs(cents);
  if (c <= IN_TUNE_CENTS) return "text-emerald-500";
  if (c <= CLOSE_CENTS) return "text-amber-500";
  return "text-red-500";
}

function tuningLabel(cents: number) {
  if (Math.abs(cents) <= IN_TUNE_CENTS) return "In tune";
  return cents < 0 ? "Flat ♭ (tune up)" : "Sharp ♯ (tune down)";
}

export function NoteDisplay({ note }: { note: DisplayedNote | null }) {
  if (!note) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
        <span className="text-6xl font-semibold text-muted-foreground/30">—</span>
        <p className="text-sm text-muted-foreground">Play a single note to see it here.</p>
      </div>
    );
  }

  const cents = Math.max(-50, Math.min(50, note.cents));
  const markerLeft = 50 + cents; // -50..+50 cents -> 0..100 %
  const color = tuningColor(cents);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 transition-opacity duration-300",
        !note.active && "opacity-40",
      )}
    >
      <div className="flex items-start">
        <span className={cn("text-8xl leading-none font-bold tracking-tight", color)}>
          {note.name.replace("#", "")}
        </span>
        <span className="mt-1 flex flex-col text-2xl leading-none font-semibold">
          <span className={cn(color, !note.name.includes("#") && "invisible")}>♯</span>
          <span className="mt-auto text-muted-foreground">{note.octave}</span>
        </span>
      </div>

      <div className="flex gap-3 font-mono text-sm tabular-nums text-muted-foreground">
        <span>{note.frequency.toFixed(1)} Hz</span>
        <span>·</span>
        <span>
          {note.cents >= 0 ? "+" : ""}
          {note.cents.toFixed(0)} cents
        </span>
        <span>·</span>
        <span>Input {note.channel + 1}</span>
      </div>

      {/* Cents gauge: centre line = perfectly in tune. */}
      <div className="w-full max-w-md">
        <div className="relative h-8 rounded-md bg-muted">
          <div className="absolute inset-y-0 left-[45%] w-[10%] rounded-sm bg-emerald-500/20" />
          <div className="absolute inset-y-1 left-1/2 w-px bg-foreground/40" />
          <div
            className={cn(
              "absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-current transition-[left] duration-100",
              color,
            )}
            style={{ left: `${markerLeft}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>-50</span>
          <span className={cn("font-sans text-xs font-medium", color)}>
            {tuningLabel(cents)}
          </span>
          <span>+50</span>
        </div>
      </div>
    </div>
  );
}
