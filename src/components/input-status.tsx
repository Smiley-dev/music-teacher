import type { EngineState } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useEngine } from "@/providers/audio-engine-context";

const STATE_LAMP: Record<EngineState, string> = {
  running: "bg-emerald-500 shadow-[0_0_8px_var(--color-emerald-500)]",
  starting: "bg-amber-500 animate-pulse",
  reconnecting: "bg-amber-500 animate-pulse",
  error: "bg-red-500",
};

const STATE_TEXT: Record<EngineState, string> = {
  running: "running",
  starting: "opening",
  reconnecting: "reconnecting",
  error: "not running",
};

/** The input device and whether it is running, always visible in the top
 * bar (details and fixes are in the banner on each page and in Settings). */
export function InputStatus({ className }: { className?: string }) {
  const { status } = useEngine();
  const device = status.device?.name ?? "No input";
  return (
    <div
      role="status"
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border px-3 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", STATE_LAMP[status.state])} aria-hidden />
      <span className="max-w-52 truncate uppercase" title={device}>
        {device}
      </span>
      <span className="sr-only">{STATE_TEXT[status.state]}</span>
    </div>
  );
}
