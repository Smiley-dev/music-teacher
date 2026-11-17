import type { StableNote } from "@/lib/engine";
import { cn } from "@/lib/utils";

/** Within this many cents counts as in tune (green). */
const IN_TUNE_CENTS = 5;
/** Within this many cents counts as close (amber). */
const CLOSE_CENTS = 15;
/** Marks on the strobe scale, −50 to +50 cents. */
const SCALE_MARKS = 41;
/** Cents between two marks. */
const MARK_STEP_CENTS = 100 / (SCALE_MARKS - 1);

type Zone = "inTune" | "close" | "far";

function zoneOf(cents: number): Zone {
  const c = Math.abs(cents);
  if (c <= IN_TUNE_CENTS) return "inTune";
  return c <= CLOSE_CENTS ? "close" : "far";
}

const ZONE_TEXT: Record<Zone, string> = {
  inTune: "text-emerald-500",
  close: "text-amber-500",
  far: "text-red-500",
};
const ZONE_LAMP: Record<Zone, string> = {
  inTune: "bg-emerald-500 shadow-[0_0_14px_var(--color-emerald-500)]",
  close: "bg-amber-500 shadow-[0_0_14px_var(--color-amber-500)]",
  far: "bg-red-500 shadow-[0_0_14px_var(--color-red-500)]",
};
const ZONE_UNLIT: Record<Zone, string> = {
  inTune: "bg-emerald-500/20",
  close: "bg-amber-500/20",
  far: "bg-red-500/20",
};

function tuningLabel(cents: number) {
  if (Math.abs(cents) <= IN_TUNE_CENTS) return "In tune";
  return cents < 0 ? "Flat ▸ tune up" : "Sharp ▸ tune down";
}

/** The note being played: its name and pitch on a display, and how far from
 * in tune it is on a strobe-style scale (A4 = 440 Hz). */
export function NoteDisplay({ note }: { note: StableNote | null }) {
  const cents = note ? Math.max(-50, Math.min(50, note.cents)) : 0;
  const zone = zoneOf(cents);
  const sharp = note?.name.includes("#") ?? false;
  const fading = note !== null && !note.active;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border bg-inset px-8 py-6">
        <div className={cn("transition-opacity duration-300", fading && "opacity-40")}>
          <div className="rack-label">
            {note ? `Note · from input ${note.channel + 1}` : "Note · listening"}
          </div>
          {note ? (
            <div
              className="flex items-start font-mono leading-none font-bold text-signal [text-shadow:0_0_24px_color-mix(in_oklch,var(--signal),transparent_65%)]"
              aria-label={`${note.name}${note.octave}`}
            >
              <span className="text-[clamp(6rem,13vw,10.5rem)]">{note.name.replace("#", "")}</span>
              <span className="mt-[0.4rem] flex flex-col text-[clamp(2rem,4vw,3.4rem)]">
                <span className={cn(!sharp && "invisible")}>♯</span>
                <span className="text-muted-foreground">{note.octave}</span>
              </span>
            </div>
          ) : (
            <>
              <div className="font-mono text-[clamp(5rem,10vw,7.5rem)] leading-none font-bold text-muted-foreground/30">
                – –
              </div>
              <p className="font-mono text-[13px] text-muted-foreground uppercase">
                Play a note · one at a time
              </p>
            </>
          )}
        </div>

        <dl className="flex min-w-56 flex-col gap-3.5 font-mono">
          <div className="flex justify-between gap-6 border-b border-dashed pb-2.5">
            <dt className="text-xs tracking-[0.12em] text-muted-foreground">FREQ</dt>
            <dd className="text-[26px] leading-none font-bold tabular-nums">
              {note ? note.frequency.toFixed(2) : "–"}
              <span className="text-[13px] text-muted-foreground"> HZ</span>
            </dd>
          </div>
          <div className="flex justify-between gap-6 border-b border-dashed pb-2.5">
            <dt className="text-xs tracking-[0.12em] text-muted-foreground">CENTS</dt>
            <dd
              className={cn(
                "text-[26px] leading-none font-bold tabular-nums",
                note ? ZONE_TEXT[zone] : "text-muted-foreground",
              )}
            >
              {note ? `${note.cents >= 0 ? "+" : "−"}${Math.abs(Math.round(note.cents))}` : "–"}
            </dd>
          </div>
          <div
            className={cn(
              "flex h-[42px] items-center justify-center rounded-lg border-2 text-sm font-bold tracking-[0.12em] uppercase",
              note ? cn(ZONE_TEXT[zone], "border-current") : "border-border text-muted-foreground",
            )}
          >
            {note ? tuningLabel(cents) : "No note"}
          </div>
        </dl>
      </div>

      {/* Strobe scale: the lit mark is where the note is; the middle mark is
          exactly in tune. */}
      <div className="flex flex-col gap-2.5 rounded-xl border bg-inset px-6 pt-5 pb-3.5">
        <div
          className={cn(
            "flex h-[66px] items-end gap-1 transition-opacity duration-300",
            fading && "opacity-40",
          )}
          role="img"
          aria-label={note ? `Scale: ${tuningLabel(cents)}, ${Math.round(note.cents)} cents` : "Scale"}
        >
          {Array.from({ length: SCALE_MARKS }, (_, i) => {
            const at = -50 + i * MARK_STEP_CENTS;
            const lit = note !== null && Math.abs(at - cents) <= MARK_STEP_CENTS / 2;
            const markZone = zoneOf(at);
            return (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-[3px] transition-[height] duration-100",
                  lit ? ZONE_LAMP[markZone] : ZONE_UNLIT[markZone],
                  lit ? "h-[66px]" : i === (SCALE_MARKS - 1) / 2 ? "h-[54px]" : "h-[42px]",
                )}
              />
            );
          })}
        </div>
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>−50 FLAT</span>
          <span>±5 IN TUNE</span>
          <span>SHARP +50</span>
        </div>
      </div>
    </div>
  );
}
