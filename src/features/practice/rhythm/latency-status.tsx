import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { describeLatency } from "@/components/calibration-card";
import { CalibrationDialog } from "@/components/calibration-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings } from "@/providers/audio-engine-context";

/** The latency used to correct timing, with a way to (re)calibrate in place. */
export function LatencyStatus({ disabled }: { disabled: boolean }) {
  const { latency } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg px-3.5 py-2",
        latency ? "bg-inset" : "border border-amber-500/40 bg-amber-500/10",
      )}
    >
      {latency ? (
        <p className="flex flex-wrap items-baseline gap-x-3 font-mono text-xs">
          <span className="text-[10px] tracking-[0.12em] text-muted-foreground">LATENCY</span>
          <span className="text-base font-bold text-signal">
            {latency.ms.toFixed(1)}
            <span className="text-xs text-muted-foreground"> MS</span>
          </span>
          <span className="font-sans text-muted-foreground">{describeLatency(latency)}</span>
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" />
          Not calibrated: timing results will include your setup's latency.
        </p>
      )}
      <Button
        size="sm"
        variant={latency ? "outline" : "default"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {latency ? "Recalibrate" : "Calibrate now"}
      </Button>
      <CalibrationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
