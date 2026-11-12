import type { MeterReading } from "@/lib/engine";
import { cn } from "@/lib/utils";

/** Leftmost value on the meter scale, dBFS. */
const MIN_DB = -60;
const TICKS = [-60, -48, -36, -24, -12, -6, 0];

/** Map dBFS to 0..100 % of the meter width. */
const toPercent = (db: number) => Math.min(100, Math.max(0, ((db - MIN_DB) / -MIN_DB) * 100));

type LevelMeterProps = {
  label: string;
  reading: MeterReading | undefined;
  /** Hide the dB scale under the bar (for compact layouts). */
  hideScale?: boolean;
};

export function LevelMeter({ label, reading, hideScale = false }: LevelMeterProps) {
  const fill = toPercent(reading?.db ?? -Infinity);
  const hold = toPercent(reading?.holdDb ?? -Infinity);
  const holdDb = reading?.holdDb ?? -Infinity;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span
            className={cn(
              "size-2.5 rounded-full transition-colors",
              reading?.clipping
                ? "bg-red-500"
                : reading?.hasSignal
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/30",
            )}
          />
          {label}
          {reading?.clipping && (
            <span className="rounded-sm bg-red-500 px-1.5 text-[10px] font-semibold uppercase text-white">
              Clip
            </span>
          )}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {holdDb > -120 ? `${holdDb.toFixed(1)} dBFS` : "-∞ dBFS"}
        </span>
      </div>

      <div className="relative h-4 overflow-hidden rounded-sm bg-muted">
        {/* Full-width gradient, revealed by clipping the right side. */}
        <div
          className="absolute inset-0 bg-linear-to-r from-emerald-500 via-emerald-500 via-70% to-red-500"
          style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
        />
        {hold > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground/80"
            style={{ left: `calc(${hold}% - 1px)` }}
          />
        )}
      </div>

      {!hideScale && (
        <div className="relative h-3 font-mono text-[10px] text-muted-foreground">
          {TICKS.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${toPercent(t)}%` }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
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
