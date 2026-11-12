import { useState } from "react";
import { AlertTriangle, Timer } from "lucide-react";

import { describeLatency } from "@/components/calibration-card";
import { CalibrationDialog } from "@/components/calibration-dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/audio-engine-context";

/** The latency used to correct timing, with a way to (re)calibrate in place. */
export function LatencyStatus({ disabled }: { disabled: boolean }) {
  const { latency } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      {latency ? (
        <p className="flex items-center gap-2 text-sm">
          <Timer className="size-4 shrink-0 text-muted-foreground" />
          <span>
            Latency correction: <span className="font-mono font-semibold">{latency.ms.toFixed(1)} ms</span>
            <span className="text-muted-foreground"> · {describeLatency(latency)}</span>
          </span>
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
