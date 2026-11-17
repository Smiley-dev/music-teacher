import { Display, Panel, PanelLabel, Readout, Tip } from "@/components/rack";
import type { PitchCheck, PitchReport, PitchResult, ReadingExercise } from "@/lib/engine";
import { pitchLabel, prettyNoteName } from "@/lib/pitch-labels";
import { cn } from "@/lib/utils";

/** Wrong notes listed by name; more are only counted. */
const MAX_LISTED = 8;
/** Above this share of unclear notes (%), suggest playing louder or slower. */
const UNCLEAR_TIP_PERCENT = 20;

const pad = (n: number) => String(n).padStart(2, "0");

/** Live pitch read-outs while playing with the metronome (tiles, to sit in a
 * row with the timing ones). */
export function LivePitchCounts({ checks }: { checks: PitchCheck[] }) {
  const count = (r: PitchResult) => checks.filter((c) => c.result === r).length;
  return (
    <>
      <Readout
        label="Right pitch"
        value={pad(count("right"))}
        tone="ok"
        className="flex-[1_1_5rem] text-center"
      />
      <Readout
        label="Wrong pitch"
        value={pad(count("wrong"))}
        tone="pitch"
        className="flex-[1_1_5rem] text-center"
      />
    </>
  );
}

/** After playing with the metronome: how many notes had the right pitch, and
 * which were wrong. */
export function PitchAnalysis({
  report,
  exercise,
  className,
}: {
  report: PitchReport;
  exercise: ReadingExercise;
  className?: string;
}) {
  const { summary } = report;
  const wrong = report.checks.filter((c) => c.result === "wrong");
  const unclearPercent = summary.notes === 0 ? 0 : (100 * summary.unclear) / summary.notes;
  const expected = (c: PitchCheck) =>
    exercise.notes.find((n) => n.bar === c.bar && n.symbol === c.symbol)?.written;

  const tips: string[] = [];
  if (summary.wrong > 0) {
    tips.push("Wrong notes are purple in the score. Play the melody at your own pace first to find them.");
  }
  if (unclearPercent > UNCLEAR_TIP_PERCENT) {
    tips.push(
      "Many notes were too short or quiet to hear their pitch. Let each note ring for its full length, play a little louder, or lower the tempo.",
    );
  }
  if (summary.notes > 0 && summary.right === summary.notes) {
    tips.push("Every note at the right pitch. Try a faster tempo, more keys or wider intervals.");
  }

  return (
    <Panel aria-label="Notes" className={cn("flex flex-col gap-3.5", className)}>
      <PanelLabel>Notes · pitch</PanelLabel>
      <Display className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 font-mono sm:px-4 sm:py-3.5">
        <div>
          <div className="text-[10px] tracking-[0.12em] text-muted-foreground">RIGHT NOTES</div>
          <div className="text-[44px] leading-tight font-bold text-emerald-500 tabular-nums">
            {Math.round(summary.rightPercent)}%
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[13px] uppercase">
          <span>
            <span className="font-bold text-emerald-500">{summary.right}</span> right
          </span>
          <span>
            <span className="font-bold text-violet-500">{summary.wrong}</span> wrong
          </span>
          <span>
            <span className="font-bold text-muted-foreground">{summary.unclear}</span> unclear
          </span>
        </div>
      </Display>
      <p className="text-xs text-muted-foreground">
        Each note's pitch, from what was heard while it should sound.
      </p>
      {wrong.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="rack-label text-[10px]">Wrong notes by bar</span>
          {wrong.slice(0, MAX_LISTED).map((c) => {
            const written = expected(c);
            return (
              <div
                key={`${c.bar}:${c.symbol}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-violet-500/10 px-3 py-2.5 font-mono text-[13px]"
              >
                <span className="text-muted-foreground">BAR {c.bar + 1}</span>
                <span>
                  <strong className="text-violet-500">
                    {c.played ? prettyNoteName(c.played) : "?"}
                  </strong>{" "}
                  instead of <strong>{written ? pitchLabel(written) : "?"}</strong>
                </span>
              </div>
            );
          })}
          {wrong.length > MAX_LISTED && (
            <p className="text-sm text-muted-foreground">…and {wrong.length - MAX_LISTED} more.</p>
          )}
        </div>
      )}
      {tips.length > 0 && (
        <div className="flex flex-col gap-2">
          {tips.map((t) => (
            <Tip key={t}>{t}</Tip>
          ))}
        </div>
      )}
    </Panel>
  );
}
