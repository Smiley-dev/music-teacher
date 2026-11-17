import { useState } from "react";

import { ChannelMeters } from "@/components/level-meter";
import { Button } from "@/components/ui/button";
import { Display, Panel, PanelLabel } from "@/components/rack";
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
    <Panel aria-labelledby="gain-title" className="flex flex-col gap-3.5">
      <PanelLabel>02 · Gain</PanelLabel>
      <div className="flex items-center justify-between gap-3">
        <h2 id="gain-title" className="text-lg font-extrabold">
          Input volume
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => apply(0)}
          disabled={settings.gainDb === 0}
        >
          Reset 0 dB
        </Button>
      </div>
      <Display className="flex flex-wrap items-center gap-4 px-3.5 py-3 sm:px-3.5 sm:py-3">
        <span className="min-w-[7.5rem] font-mono text-[34px] font-bold text-signal tabular-nums">
          {formatDb(value).replace(" dB", "")}
          <span className="text-sm text-muted-foreground"> DB</span>
        </span>
        <div className="flex min-w-40 flex-1 flex-col gap-2">
          <Label htmlFor="input-gain" className="sr-only">
            Gain
          </Label>
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
            <span>{MIN_GAIN_DB}</span>
            <span>0</span>
            <span>+{MAX_GAIN_DB}</span>
          </div>
        </div>
      </Display>
      <ChannelMeters meters={frame?.meters ?? []} />
      <p className="leading-relaxed text-muted-foreground">
        Digital gain applied before analysis. Aim for peaks around −18 to −6 dBFS. Clip lights when
        the interface itself clips (turn its gain knob down) or the signal after this gain reaches
        0 dBFS (lower the slider).
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Panel>
  );
}
