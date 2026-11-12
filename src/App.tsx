import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, AudioLines, Loader2, MicOff, RefreshCw } from "lucide-react";

import { LevelMeter } from "@/components/level-meter";
import { NoteDisplay } from "@/components/note-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInputMonitor } from "@/hooks/use-input-monitor";
import { type InputDeviceInfo, deviceKey, listInputDevices } from "@/lib/audio";

const LAST_DEVICE_KEY = "music-teacher:last-input-device";

function readLastDevice(): string | null {
  try {
    return localStorage.getItem(LAST_DEVICE_KEY);
  } catch {
    return null;
  }
}

function App() {
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const list = await listInputDevices();
      setDevices(list);
      setSelectedKey((current) => {
        const keys = list.map(deviceKey);
        if (current && keys.includes(current)) return current;
        const last = readLastDevice();
        if (last && keys.includes(last)) return last;
        const fallback = list.find((d) => d.isDefault) ?? list[0];
        return fallback ? deviceKey(fallback) : null;
      });
    } catch (e) {
      setListError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = useMemo(
    () => devices.find((d) => deviceKey(d) === selectedKey) ?? null,
    [devices, selectedKey],
  );

  const onSelect = (key: string) => {
    setSelectedKey(key);
    try {
      localStorage.setItem(LAST_DEVICE_KEY, key);
    } catch {
      // Storage unavailable; the choice just won't be remembered.
    }
  };

  const devicesByHost = useMemo(() => {
    const groups = new Map<string, InputDeviceInfo[]>();
    for (const d of devices) {
      groups.set(d.host, [...(groups.get(d.host) ?? []), d]);
    }
    return [...groups];
  }, [devices]);

  const monitor = useInputMonitor(selected);
  const channelCount = monitor.info?.channels ?? 0;
  const signalChannels = monitor.levels
    .map((l, i) => (l.hasSignal ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const clipping = monitor.levels.some((l) => l.clipping);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Music Teacher</h1>
        <p className="text-sm text-muted-foreground">
          Pick your audio interface and check that your instrument is coming through.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Input device</CardTitle>
          <CardDescription>
            The audio interface or microphone to record from.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Select
              value={selectedKey ?? undefined}
              onValueChange={onSelect}
              disabled={devices.length === 0}
            >
              <SelectTrigger className="min-w-0 flex-1">
                <SelectValue
                  placeholder={loading ? "Loading devices…" : "No input devices found"}
                />
              </SelectTrigger>
              <SelectContent>
                {devicesByHost.map(([host, list]) => (
                  <SelectGroup key={host}>
                    <SelectLabel>{host}</SelectLabel>
                    {list.map((d) => (
                      <SelectItem key={deviceKey(d)} value={deviceKey(d)}>
                        {d.name}
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

          {monitor.info && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{selected?.host}</Badge>
              <Badge variant="secondary">{monitor.info.channels} ch</Badge>
              <Badge variant="secondary">{monitor.info.sampleRate} Hz</Badge>
              <Badge variant="secondary">{monitor.info.sampleFormat}</Badge>
            </div>
          )}
          {listError && <p className="text-sm text-destructive">{listError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Note</CardTitle>
          <CardDescription>
            The note you are playing, and how far it is from being in tune.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NoteDisplay note={monitor.status === "running" ? monitor.note : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Input signal</CardTitle>
          <CardDescription>
            Play your instrument. Each input should light up green.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <SignalStatus
            status={monitor.status}
            error={monitor.error}
            signalChannels={signalChannels}
            clipping={clipping}
          />
          {Array.from({ length: channelCount }, (_, i) => (
            <LevelMeter key={i} label={`Input ${i + 1}`} level={monitor.levels[i]} />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

type SignalStatusProps = {
  status: ReturnType<typeof useInputMonitor>["status"];
  error: string | null;
  signalChannels: number[];
  clipping: boolean;
};

function SignalStatus({ status, error, signalChannels, clipping }: SignalStatusProps) {
  const box = "flex items-start gap-3 rounded-lg border p-4";

  if (status === "idle") {
    return (
      <div className={box}>
        <MicOff className="mt-0.5 size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Select an input device to start.</p>
      </div>
    );
  }
  if (status === "starting") {
    return (
      <div className={box}>
        <Loader2 className="mt-0.5 size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Opening device…</p>
      </div>
    );
  }
  if (status === "reconnecting") {
    return (
      <div className={`${box} border-amber-500/50 bg-amber-500/10`}>
        <Loader2 className="mt-0.5 size-5 animate-spin text-amber-500" />
        <div className="text-sm">
          <p className="font-medium">Lost connection to the device, reconnecting…</p>
          <p className="text-muted-foreground">
            This can happen briefly when plugging in a cable. If it continues, check the
            USB cable. Details: {error}
          </p>
        </div>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className={`${box} border-destructive/50`}>
        <AlertTriangle className="mt-0.5 size-5 text-destructive" />
        <div className="text-sm">
          <p className="font-medium text-destructive">Could not read from this device</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }
  if (clipping) {
    return (
      <div className={`${box} border-red-500/50 bg-red-500/10`}>
        <AlertTriangle className="mt-0.5 size-5 text-red-500" />
        <div className="text-sm">
          <p className="font-medium">Clipping: the signal is too loud</p>
          <p className="text-muted-foreground">
            Turn the gain knob on your interface down until the meter stays out of the red.
          </p>
        </div>
      </div>
    );
  }
  if (signalChannels.length > 0) {
    return (
      <div className={`${box} border-emerald-500/50 bg-emerald-500/10`}>
        <AudioLines className="mt-0.5 size-5 text-emerald-500" />
        <div className="text-sm">
          <p className="font-medium">
            Signal detected on input {signalChannels.join(" & ")}
          </p>
          <p className="text-muted-foreground">Your instrument is coming through.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={box}>
      <MicOff className="mt-0.5 size-5 text-muted-foreground" />
      <div className="text-sm">
        <p className="font-medium">No signal yet</p>
        <p className="text-muted-foreground">
          Play something. If nothing shows up, check the cable, the input gain knob, and
          that the instrument (or its volume knob) is turned on.
        </p>
      </div>
    </div>
  );
}

export default App;
