import type { MeterReading } from "@/lib/engine";
import { cn } from "@/lib/utils";

/** Leftmost value on the meter scale, dBFS. */
const MIN_DB = -60;
/** Lamps in a horizontal meter. */
const WIDE_LAMPS = 24;
/** Lamps in a vertical meter. */
const TALL_LAMPS = 16;
/** Lamps up to this share of the scale are green, then amber, then red. */
const GREEN_UNTIL = 0.625;
const AMBER_UNTIL = 0.8125;

/** Map dBFS to 0..1 of the meter scale. */
const toFraction = (db: number) => Math.min(1, Math.max(0, (db - MIN_DB) / -MIN_DB));

/** Colour of lamp `i` of `n`, and whether it is lit by `lit` lamps or the
 * peak-hold lamp `hold`. Unlit lamps are plain. */
function lampClass(i: number, n: number, lit: number, hold: number) {
  if (i >= lit && i !== hold) return "bg-muted";
  const at = (i + 1) / n;
  if (at <= GREEN_UNTIL) return "bg-emerald-500";
  return at <= AMBER_UNTIL ? "bg-amber-500" : "bg-red-500";
}

function lamps(reading: MeterReading | undefined, n: number) {
  const lit = Math.round(toFraction(reading?.db ?? -Infinity) * n);
  const holdFraction = toFraction(reading?.holdDb ?? -Infinity);
  const hold = holdFraction > 0 ? Math.max(0, Math.ceil(holdFraction * n) - 1) : -1;
  return { lit, hold };
}

function ClipLamp({ clipping, className }: { clipping: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-[5px] font-mono text-[10px] font-bold",
        clipping
          ? "bg-red-500 text-white shadow-[0_0_10px_var(--color-red-500)]"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      CLIP
    </span>
  );
}

type LevelMeterProps = {
  label: string;
  reading: MeterReading | undefined;
};

/** A level meter on one line: lamps left to right, peak hold as one lamp, and
 * the peak in dBFS. Lights red under "CLIP" when the signal clips. */
export function LevelMeter({ label, reading }: LevelMeterProps) {
  const { lit, hold } = lamps(reading, WIDE_LAMPS);
  const holdDb = reading?.holdDb ?? -Infinity;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full transition-colors",
              reading?.clipping
                ? "bg-red-500"
                : reading?.hasSignal
                  ? "bg-emerald-500 shadow-[0_0_8px_var(--color-emerald-500)]"
                  : "bg-muted-foreground/30",
            )}
          />
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {holdDb > -120 ? `${holdDb.toFixed(1)} dBFS` : "-∞ dBFS"}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <div
          className="grid flex-1 gap-[3px] rounded-md bg-inset p-[5px]"
          style={{ gridTemplateColumns: `repeat(${WIDE_LAMPS}, minmax(0, 1fr))` }}
          role="meter"
          aria-label={label}
          aria-valuemin={MIN_DB}
          aria-valuemax={0}
          aria-valuenow={Number.isFinite(reading?.db) ? reading?.db : MIN_DB}
        >
          {Array.from({ length: WIDE_LAMPS }, (_, i) => (
            <span key={i} className={cn("h-3 rounded-[2px]", lampClass(i, WIDE_LAMPS, lit, hold))} />
          ))}
        </div>
        <ClipLamp clipping={reading?.clipping ?? false} className="h-[22px] px-2" />
      </div>
    </div>
  );
}

/** One meter per input channel. */
export function ChannelMeters({ meters }: { meters: MeterReading[] }) {
  if (meters.length === 0) {
    return <p className="text-sm text-muted-foreground">No input stream.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {meters.map((reading, i) => (
        <LevelMeter key={i} label={`Input ${i + 1}`} reading={reading} />
      ))}
    </div>
  );
}

/** Vertical meters, side by side, one per input channel: the Tuner's
 * peak-hold level display. */
export function TallMeters({ meters }: { meters: MeterReading[] }) {
  if (meters.length === 0) {
    return <p className="text-sm text-muted-foreground">No input stream.</p>;
  }
  return (
    <div className="flex flex-1 justify-center gap-7">
      {meters.map((reading, i) => {
        const { lit, hold } = lamps(reading, TALL_LAMPS);
        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <ClipLamp clipping={reading.clipping} className="h-3.5 w-[34px] text-[8px]" />
            <div
              className="flex w-[34px] flex-1 flex-col-reverse gap-[3px] rounded-lg bg-inset p-[5px]"
              role="meter"
              aria-label={`Input ${i + 1}`}
              aria-valuemin={MIN_DB}
              aria-valuemax={0}
              aria-valuenow={Number.isFinite(reading.db) ? reading.db : MIN_DB}
            >
              {Array.from({ length: TALL_LAMPS }, (_, j) => (
                <span
                  key={j}
                  className={cn("h-3 shrink-0 rounded-[2px]", lampClass(j, TALL_LAMPS, lit, hold))}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">IN {i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}
