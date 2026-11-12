import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEngine } from "@/providers/audio-engine-context";

import { CALIBRATION_DESCRIPTION, CALIBRATION_TITLE, CalibrationPanel } from "./calibration-card";

type CalibrationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Calibration without leaving the current screen. Closing the dialog while
 * clicks are playing cancels the calibration. */
export function CalibrationDialog({ open, onOpenChange }: CalibrationDialogProps) {
  const { calibration, cancelCalibration } = useEngine();

  const change = (next: boolean) => {
    if (!next && calibration.phase === "running") cancelCalibration().catch(() => {});
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{CALIBRATION_TITLE}</DialogTitle>
          <DialogDescription>{CALIBRATION_DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <CalibrationPanel />
      </DialogContent>
    </Dialog>
  );
}
