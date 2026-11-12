import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { EngineStatusBanner } from "@/components/engine-status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Input device</CardTitle>
        <CardDescription>The audio interface or microphone to listen to.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Select
            value={current ? keyOf(current) : undefined}
            onValueChange={onSelect}
            disabled={devices.length === 0}
          >
            <SelectTrigger className="min-w-0 flex-1" aria-label="Input device">
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
            size="icon"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh devices"
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        </div>

        {status.stream && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{status.device?.host}</Badge>
            <Badge variant="secondary">{status.stream.channels} ch</Badge>
            <Badge variant="secondary">{status.stream.sampleRate} Hz</Badge>
            <Badge variant="secondary">{status.stream.sampleFormat}</Badge>
          </div>
        )}
        {(listError || selectError) && (
          <p className="text-sm text-destructive">{listError ?? selectError}</p>
        )}
        <EngineStatusBanner status={status} />
      </CardContent>
    </Card>
  );
}
