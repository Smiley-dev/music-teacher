import { InputDeviceCard } from "./input-device-card";
import { InputGainCard } from "./input-gain-card";

export function SettingsScreen() {
  return (
    <div className="flex flex-col gap-6">
      <InputDeviceCard />
      <InputGainCard />
    </div>
  );
}
