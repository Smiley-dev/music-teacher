import { EngineStatusBanner } from "@/components/engine-status-banner";
import { ChannelMeters } from "@/components/level-meter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Waveform } from "@/components/waveform";
import { useEngine, useFrame } from "@/providers/audio-engine-context";

import { NoteDisplay } from "./note-display";

export function TunerScreen() {
  const { status } = useEngine();
  const frame = useFrame();

  return (
    <div className="flex flex-col gap-6">
      <EngineStatusBanner status={status} />

      <Card>
        <CardHeader>
          <CardTitle>Note</CardTitle>
          <CardDescription>
            The note you are playing, and how far it is from being in tune (A4 = 440 Hz).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NoteDisplay note={frame?.note ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Input signal</CardTitle>
          <CardDescription>
            {frame
              ? `Waveform of input ${frame.waveformChannel + 1}. Each input lights up green when it hears something.`
              : "Live waveform and levels appear once the input device is running."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Waveform points={frame?.waveform ?? []} />
          <ChannelMeters meters={frame?.meters ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
