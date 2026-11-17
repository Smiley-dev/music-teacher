import { useEffect, useState } from "react";

import { ChoiceButtons } from "@/components/choice-buttons";
import { OptionCheckbox } from "@/components/option-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionsPanel } from "@/features/practice/options-panel";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
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
import { SCALE_LABELS } from "@/lib/pitch-labels";
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
  label: String(n),
}));

type ReadingSettingsCardProps = {
  disabled: boolean;
  /** The melody has a tab (the instrument is guitar or bass guitar). */
  tabAvailable: boolean;
};

/** Sight-reading options panel: what the melodies are made of, the tempo,
 * and whether to show their tab. */
export function ReadingSettingsCard({ disabled, tabAvailable }: ReadingSettingsCardProps) {
  const { settings, setReadingSettings } = useEngine();
  const reading = settings.practice.reading;
  const melody = reading.melody;
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
    <OptionsPanel
      title="Melody"
      locked={disabled}
      error={error}
      theory={{ topic: "reading", label: "How to sight-read" }}
    >
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
      <div className="flex flex-col gap-1.5">
        <ChoiceButtons
          label="Most ♯ or ♭ in the key"
          options={KEY_CHOICES}
          value={String(melody.maxAccidentals)}
          disabled={disabled}
          onChange={(n) => set({ maxAccidentals: Number(n) })}
        />
        <p className="text-xs text-muted-foreground">
          {melody.maxAccidentals === 0
            ? "No key signature: C major, A minor and their modes."
            : `Keys with up to ${melody.maxAccidentals} ${melody.maxAccidentals === 1 ? "sharp or flat" : "sharps or flats"}. Modes use their parent major's key signature.`}
        </p>
      </div>
      <OptionChecklist
        legend="Steps between notes"
        idPrefix="reading-interval"
        items={INTERVAL_SIZES}
        label={(i) => INTERVAL_SIZE_LABELS[i].name}
        description={(i) => INTERVAL_SIZE_LABELS[i].hint}
        selected={melody.intervals}
        disabled={disabled}
        onChange={(intervals) => set({ intervals })}
      />
      <div className="flex flex-col gap-3">
        <OptionChecklist
          legend="Note lengths"
          idPrefix="reading-value"
          items={NOTE_VALUES}
          label={(v) => NOTE_VALUE_LABELS[v]}
          selected={melody.rhythm.values}
          disabled={disabled}
          onChange={(values) => setRhythm({ values })}
        />
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
      </div>
      <OptionCheckbox
        id="reading-ledger"
        label="Ledger lines"
        description="Notes above and below the staff."
        checked={melody.ledgerLines}
        disabled={disabled}
        onChange={(ledgerLines) => set({ ledgerLines })}
      />
      <div className="flex flex-col gap-4">
        <TempoField
          id="reading-tempo"
          bpm={reading.bpm}
          onChange={(bpm) => save({ ...reading, bpm })}
          disabled={disabled}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reading-time-signature" className="font-bold">
              Time
            </Label>
            <Select
              value={String(melody.timeSignature.beatsPerBar)}
              onValueChange={(v) => set({ timeSignature: { beatsPerBar: Number(v) } })}
              disabled={disabled}
            >
              <SelectTrigger id="reading-time-signature" className="w-full font-mono">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="reading-bars" className="font-bold">
              Bars
            </Label>
            <Input
              id="reading-bars"
              type="number"
              min={MIN_BARS}
              max={MAX_READING_BARS}
              className="bg-inset font-mono font-bold"
              value={barsText}
              disabled={disabled}
              onChange={(e) => setBarsText(e.currentTarget.value)}
              onBlur={commitBars}
              onKeyDown={(e) => e.key === "Enter" && commitBars()}
            />
          </div>
        </div>
      </div>
      {tabAvailable && (
        <OptionCheckbox
          id="reading-tab"
          label="Show tab"
          description="String and fret of every note, under the staff. The melody stays the same."
          checked={reading.showTab}
          disabled={disabled}
          onChange={(showTab) => save({ ...reading, showTab })}
        />
      )}
    </OptionsPanel>
  );
}
