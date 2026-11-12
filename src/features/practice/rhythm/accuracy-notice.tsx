import { AlertTriangle, Lightbulb } from "lucide-react";

import { FAST_NOTE_GAP_MS, MIN_JUDGEABLE_GAP_MS } from "@/lib/engine";
import { cn } from "@/lib/utils";

/** Shortest gap between played notes at `bpm`, ms (null if < 2 notes). */
export function minGapMs(minNoteGapBeats: number | null, bpm: number): number | null {
  return minNoteGapBeats === null ? null : (minNoteGapBeats * 60_000) / bpm;
}

/** Warns when notes are so close together that detection or judging gets
 * unreliable (thresholds measured in ADR 0010 / defined in judge.rs). */
export function FastNotesWarning({ gapMs }: { gapMs: number | null }) {
  if (gapMs === null || gapMs >= FAST_NOTE_GAP_MS) return null;
  const tooFast = gapMs < MIN_JUDGEABLE_GAP_MS;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        tooFast ? "border-red-500/50 bg-red-500/10" : "border-amber-500/50 bg-amber-500/10",
      )}
    >
      <AlertTriangle
        className={cn("mt-0.5 size-4 shrink-0", tooFast ? "text-red-500" : "text-amber-500")}
      />
      <div>
        <p className="font-medium">
          {tooFast ? "Too fast to judge early or late" : "Fast notes: results are less reliable"}
        </p>
        <p className="text-muted-foreground">
          {tooFast
            ? `The closest notes are only ${Math.round(gapMs)} ms apart. That leaves less room than the ±40 ms "on time" zone, so results will mostly show only hit or missed. Lower the tempo for real timing feedback.`
            : `The closest notes are ${Math.round(gapMs)} ms apart. Fast notes, especially low ones, are sometimes missed or timed less precisely. Play higher notes and pick clearly; lower the tempo if many notes show as missed.`}
        </p>
      </div>
    </div>
  );
}

const TIPS = [
  "Play higher notes: on guitar the G, B or high E string (or above the 5th fret), on keys above middle C. Low notes vibrate slowly, so the moment they start is harder to detect: in our tests high notes were timed within about 1–5 ms, low notes within about 5–20 ms, and fast low notes are sometimes missed.",
  "Pick each note firmly and clearly. At fast tempos, mute the string between notes so every note has a clean start.",
  "Calibrate with the same kind of note you practise with, so the latency correction matches.",
  "Using a microphone? Wear headphones so the metronome isn't detected as a note.",
];

/** Advice for getting accurate timing results. */
export function AccuracyTips() {
  return (
    <details className="group rounded-lg border px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
        <Lightbulb className="size-4 text-amber-500" />
        Tips for accurate results
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
          Hide
        </span>
      </summary>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
        {TIPS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </details>
  );
}
