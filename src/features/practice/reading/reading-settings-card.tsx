import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChoiceButtons } from "@/features/practice/pitch/choice-buttons";
import { InstrumentSelect } from "@/features/practice/pitch/instrument-select";
import { OptionCheckbox } from "@/features/practice/pitch/option-checkbox";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
import { SCALE_LABELS } from "@/features/practice/pitch/pitch-labels";
import { usePitchSettings } from "@/features/practice/pitch/use-pitch-settings";
import { NOTE_VALUE_LABELS } from "@/features/practice/practice-labels";
import { TempoField } from "@/features/practice/tempo-field";
import {
  INTERVAL_SIZES,
  type IntervalSize,
  MAX_KEY_ACCIDENTALS,
  MAX_READING_BARS,
  MIN_BARS,
  NOTE_VALUES,
  type ReadingOptions,
  type RhythmOptions,
  SCALE_KINDS,
  SUPPORTED_BEATS_PER_BAR,
} from "@/lib/engine";
import { useEngine } from "@/providers/audio-engine-context";

const INTERVAL_SIZE_LABELS: Record<IntervalSize, { name: string; hint: string }> = {
  unison: { name: "Repeated note", hint: "The same note again" },
  second: { name: "2nd", hint: "Step to the next line or space" },
  third: { name: "3rd", hint: "Skip one line or space" },
  fourth: { name: "4th", hint: "" },
  fifth: { name: "5th", hint: "" },
  sixth: { name: "6th", hint: "" },
  seventh: { name: "7th", hint: "" },
  octave: { name: "Octave", hint: "" },
};

const KEY_CHOICES = Array.from({ length: MAX_KEY_ACCIDENTALS + 1 }, (_, n) => ({
  id: String(n),
  label: n === 0 ? "None" : String(n),
}));

/** Sight-reading options: what the melodies are made of. */
export function ReadingSettingsCard({ disabled }: { disabled: boolean }) {
  const { settings, setReadingSettings } = useEngine();
  const reading = settings.practice.reading;
  const melody = reading.melody;
  const { pitch, update: updatePitch, error: pitchError } = usePitchSettings();
  const [error, setError] = useState<string | null>(null);
  const [barsText, setBarsText] = useState(String(melody.bars));
  useEffect(() => setBarsText(String(melody.bars)), [melody.bars]);

  const save = (next: typeof reading) => {
    setError(null);
    setReadingSettings(next).catch((e) => setError(String(e)));
  };
  const set = (change: Partial<ReadingOptions>) =>
    save({ ...reading, melody: { ...melody, ...change } });
  const setRhythm = (change: Partial<RhythmOptions>) =>
    set({ rhythm: { ...melody.rhythm, ...change } });

  const commitBars = () => {
    const n = Math.round(Number(barsText));
    if (Number.isFinite(n) && n >= MIN_BARS && n <= MAX_READING_BARS) set({ bars: n });
    else setBarsText(String(melody.bars));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Melody</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <InstrumentSelect
          value={pitch.instrument}
          onChange={(instrument) => updatePitch({ instrument })}
          disabled={disabled}
        />

        <OptionChecklist
          legend="Scales and keys"
          idPrefix="reading-scale"
          items={SCALE_KINDS}
          label={(s) => SCALE_LABELS[s].name}
          description={(s) => SCALE_LABELS[s].hint}
          selected={melody.scales}
          disabled={disabled}
          onChange={(scales) => set({ scales })}
        />
        <div className="flex flex-col gap-1">
          <ChoiceButtons
            label="Most sharps or flats in the key signature"
            options={KEY_CHOICES}
            value={String(melody.maxAccidentals)}
            disabled={disabled}
            onChange={(n) => set({ maxAccidentals: Number(n) })}
          />
          <p className="text-sm text-muted-foreground">
            {melody.maxAccidentals === 0
              ? "No key signature: C major, A minor and their modes."
              : `Keys with up to ${melody.maxAccidentals} ${melody.maxAccidentals === 1 ? "sharp or flat" : "sharps or flats"}. Modes use their parent major's key signature.`}
          </p>
        </div>

        <OptionChecklist
          legend="Intervals between neighbouring notes"
          idPrefix="reading-interval"
          items={INTERVAL_SIZES}
          label={(i) => INTERVAL_SIZE_LABELS[i].name}
          description={(i) => INTERVAL_SIZE_LABELS[i].hint}
          selected={melody.intervals}
          disabled={disabled}
          onChange={(intervals) => set({ intervals })}
        />

        <OptionChecklist
          legend="Note lengths"
          idPrefix="reading-value"
          items={NOTE_VALUES}
          label={(v) => NOTE_VALUE_LABELS[v]}
          selected={melody.rhythm.values}
          disabled={disabled}
          onChange={(values) => setRhythm({ values })}
        />
        <div className="-mt-3 flex flex-wrap gap-x-8 gap-y-4">
          <OptionCheckbox
            id="reading-dotted"
            label="Dotted notes"
            checked={melody.rhythm.dotted}
            disabled={disabled}
            onChange={(dotted) => setRhythm({ dotted })}
          />
          <OptionCheckbox
            id="reading-rests"
            label="Rests"
            checked={melody.rhythm.rests}
            disabled={disabled}
            onChange={(rests) => setRhythm({ rests })}
          />
          <OptionCheckbox
            id="reading-ledger"
            label="Ledger lines"
            description="Notes above and below the staff."
            checked={melody.ledgerLines}
            disabled={disabled}
            onChange={(ledgerLines) => set({ ledgerLines })}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto_auto]">
          <TempoField
            id="reading-tempo"
            bpm={reading.bpm}
            onChange={(bpm) => save({ ...reading, bpm })}
            disabled={disabled}
          />
          <div className="flex flex-col gap-3">
            <Label htmlFor="reading-time-signature">Time signature</Label>
            <Select
              value={String(melody.timeSignature.beatsPerBar)}
              onValueChange={(v) => set({ timeSignature: { beatsPerBar: Number(v) } })}
              disabled={disabled}
            >
              <SelectTrigger id="reading-time-signature" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_BEATS_PER_BAR.map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    {b}/4
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="reading-bars">Bars</Label>
            <Input
              id="reading-bars"
              type="number"
              min={MIN_BARS}
              max={MAX_READING_BARS}
              className="w-24"
              value={barsText}
              disabled={disabled}
              onChange={(e) => setBarsText(e.currentTarget.value)}
              onBlur={commitBars}
              onKeyDown={(e) => e.key === "Enter" && commitBars()}
            />
          </div>
        </div>
        {(error ?? pitchError) && <p className="text-sm text-destructive">{error ?? pitchError}</p>}
      </CardContent>
    </Card>
  );
}
