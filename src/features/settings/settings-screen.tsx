import { CalibrationCard } from "@/components/calibration-card";
import { InputDeviceCard } from "./input-device-card";
import { InputGainCard } from "./input-gain-card";

export function SettingsScreen() {
  return (
    <div className="grid items-start gap-5 md:grid-cols-2">
      <InputDeviceCard />
      <InputGainCard />
      <CalibrationCard className="md:col-span-2" />
    </div>
  );
}
