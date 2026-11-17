import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Lamp, Panel, PanelLabel } from "@/components/rack";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type DeviceId, type InputDeviceInfo, sameDevice } from "@/lib/engine";
import { useEngine } from "@/providers/audio-engine-context";

import { useInputDevices } from "./use-input-devices";

const keyOf = (id: DeviceId) => `${id.host}::${id.name}`;

export function InputDeviceCard() {
  const { status, settings, setInputDevice } = useEngine();
  const { devices, loading, error: listError, refresh } = useInputDevices();
  const [selectError, setSelectError] = useState<string | null>(null);

  // The device in use, else the saved one (e.g. while it is unplugged).
  const current = status.device ?? settings.inputDevice;
  const currentListed = devices.some((d) => sameDevice(d.id, current));

  const byHost = useMemo(() => {
    const groups = new Map<string, InputDeviceInfo[]>();
    for (const d of devices) groups.set(d.id.host, [...(groups.get(d.id.host) ?? []), d]);
    return [...groups];
  }, [devices]);

  const onSelect = (key: string) => {
    const device = devices.find((d) => keyOf(d.id) === key);
    if (!device) return;
    setSelectError(null);
    setInputDevice(device.id).catch((e) => setSelectError(String(e)));
  };

  return (
    <Panel aria-labelledby="device-title" className="flex flex-col gap-3.5">
      <PanelLabel>01 · Input</PanelLabel>
      <h2 id="device-title" className="text-lg font-extrabold">
        Input device
      </h2>
        <div className="flex gap-2">
          <Select
            value={current ? keyOf(current) : undefined}
            onValueChange={onSelect}
            disabled={devices.length === 0}
          >
            <SelectTrigger className="h-11 min-w-0 flex-1" aria-label="Input device">
              <SelectValue
                placeholder={loading ? "Loading devices…" : "No input devices found"}
              />
            </SelectTrigger>
            <SelectContent>
              {current && !currentListed && (
                <SelectGroup>
                  <SelectLabel>Saved</SelectLabel>
                  <SelectItem value={keyOf(current)} disabled>
                    {current.name} (not connected)
                  </SelectItem>
                </SelectGroup>
              )}
              {byHost.map(([host, list]) => (
                <SelectGroup key={host}>
                  <SelectLabel>{host}</SelectLabel>
                  {list.map((d) => (
                    <SelectItem key={keyOf(d.id)} value={keyOf(d.id)}>
                      {d.id.name}
                      {d.isDefault && " (default)"}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-lg"
            className="size-11"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh devices"
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        </div>

        {status.stream && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-inset px-3 py-2.5 font-mono text-xs">
            <Lamp on tone="ok" />
            <span className="text-emerald-500">
              RUNNING · {status.stream.channels} INPUT{" "}
              {status.stream.channels === 1 ? "CHANNEL" : "CHANNELS"}
            </span>
            <span className="text-muted-foreground">
              {status.device?.host} · {status.stream.sampleRate} HZ · {status.stream.sampleFormat}
            </span>
          </div>
        )}
        {(listError || selectError) && (
          <p className="text-sm text-destructive">{listError ?? selectError}</p>
        )}
        <EngineStatusBanner status={status} />
        <p className="leading-relaxed text-muted-foreground">
          The audio interface or microphone to listen to. A saved device that is unplugged shows
          “(not connected)” and opens again by itself when it is back.
        </p>
    </Panel>
  );
}
