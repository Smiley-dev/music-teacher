import { useState } from "react";

import { ChannelMeters } from "@/components/level-meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MAX_GAIN_DB, MIN_GAIN_DB } from "@/lib/engine";
import { useEngine, useFrame } from "@/providers/audio-engine-context";

const formatDb = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;

export function InputGainCard() {
  const { settings, setGainDb } = useEngine();
  const frame = useFrame();
  // While dragging, show the local value so echoes from the engine don't jitter.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = dragValue ?? settings.gainDb;

  const apply = (db: number) => {
    setError(null);
    setGainDb(db).catch((e) => setError(String(e)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input volume</CardTitle>
        <CardDescription>
          Digital gain applied before analysis. Aim for peaks around −18 to −6 dBFS. If the meter
          shows Clip, turn the gain knob on your interface down first.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="input-gain">Gain</Label>
            <span className="font-mono text-sm tabular-nums">{formatDb(value)}</span>
          </div>
          <Slider
            id="input-gain"
            min={MIN_GAIN_DB}
            max={MAX_GAIN_DB}
            step={0.5}
            value={[value]}
            onValueChange={([db]) => {
              setDragValue(db);
              apply(db);
            }}
            onValueCommit={() => setDragValue(null)}
          />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{MIN_GAIN_DB} dB</span>
            <span>0</span>
            <span>+{MAX_GAIN_DB} dB</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => apply(0)}
            disabled={settings.gainDb === 0}
          >
            Reset to 0 dB
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <ChannelMeters meters={frame?.meters ?? []} />
      </CardContent>
    </Card>
  );
}
