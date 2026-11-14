import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pitchLabel, prettyNoteName } from "@/features/practice/pitch/pitch-labels";
import type { PitchCheck, PitchReport, PitchResult, ReadingExercise } from "@/lib/engine";
import { cn } from "@/lib/utils";

/** Wrong notes listed by name; more are only counted. */
const MAX_LISTED = 8;
/** Above this share of unclear notes (%), suggest playing louder or slower. */
const UNCLEAR_TIP_PERCENT = 20;

const RESULT_COLOR: Record<PitchResult, string> = {
  right: "text-emerald-500",
  wrong: "text-violet-500",
  unclear: "text-muted-foreground",
};

/** Small live counters shown while playing with the metronome. */
export function LivePitchCounts({ checks }: { checks: PitchCheck[] }) {
  const count = (r: PitchResult) => checks.filter((c) => c.result === r).length;
  const items: [string, PitchResult][] = [
    ["Right notes", "right"],
    ["Wrong notes", "wrong"],
  ];
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {items.map(([label, result]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={cn("font-mono font-semibold tabular-nums", RESULT_COLOR[result])}>
            {count(result)}
          </span>
          <span className="text-muted-foreground">{label}</span>
        </span>
      ))}
    </div>
  );
}

/** After playing with the metronome: how many notes had the right pitch, and
 * which were wrong. */
export function PitchAnalysis({
  report,
  exercise,
}: {
  report: PitchReport;
  exercise: ReadingExercise;
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
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Each note's pitch, from what was heard while it should sound. Timing is above.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Right notes" value={`${Math.round(summary.rightPercent)}%`} color={RESULT_COLOR.right} />
          <Stat label="Right" value={`${summary.right} of ${summary.notes}`} />
          <Stat label="Wrong" value={String(summary.wrong)} color={summary.wrong > 0 ? RESULT_COLOR.wrong : undefined} />
          <Stat label="Pitch unclear" value={String(summary.unclear)} />
        </div>
        {wrong.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {wrong.slice(0, MAX_LISTED).map((c) => {
              const written = expected(c);
              return (
                <li key={`${c.bar}:${c.symbol}`}>
                  <span className="text-muted-foreground">Bar {c.bar + 1}:</span>{" "}
                  <span className="font-medium text-violet-600 dark:text-violet-400">
                    {c.played ? prettyNoteName(c.played) : "?"}
                  </span>{" "}
                  instead of <span className="font-medium">{written ? pitchLabel(written) : "?"}</span>
                </li>
              );
            })}
            {wrong.length > MAX_LISTED && (
              <li className="text-muted-foreground">…and {wrong.length - MAX_LISTED} more.</li>
            )}
          </ul>
        )}
        {tips.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {tips.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
                {t}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className={cn("font-mono text-2xl font-semibold tabular-nums", color)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
