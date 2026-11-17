import { useEffect, useState } from "react";

import { ChoiceButtons } from "@/components/choice-buttons";
import { OptionCheckbox } from "@/components/option-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionsPanel } from "@/features/practice/options-panel";
import { OptionChecklist } from "@/features/practice/pitch/option-checklist";
import { NOTE_VALUE_LABELS } from "@/features/practice/practice-labels";
import { TempoField } from "@/features/practice/tempo-field";
import {
  type CustomMode,
  type Difficulty,
  MAX_BARS,
  MIN_BARS,
  NOTE_VALUES,
  type RhythmPracticeSettings,
  SUPPORTED_BEATS_PER_BAR,
} from "@/lib/engine";
import { useEngine } from "@/providers/audio-engine-context";

const CUSTOM_MODES: { id: CustomMode; label: string; description: string }[] = [
  { id: "random", label: "Random", description: "New rhythms from the lengths you select." },
  { id: "written", label: "Write your own", description: "Add notes and rests one by one." },
];

const DIFFICULTIES: { id: Difficulty; label: string; description: string }[] = [
  { id: "easy", label: "Easy", description: "Whole, half and quarter notes." },
  { id: "medium", label: "Medium", description: "Adds eighth and sixteenth notes." },
  {
    id: "hard",
    label: "Hard",
    description: "Every note length, dotted notes and rests (shortest: sixteenth).",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Pick the lengths for random rhythms, or write your own.",
  },
];

const TIME_SIGNATURES = SUPPORTED_BEATS_PER_BAR.map((b) => ({ id: String(b), label: `${b}/4` }));

/** Rhythm exercise options panel: tempo, time signature, length and
 * difficulty (or custom lengths). A written rhythm is edited next to the
 * score, see `RhythmEditor`. */
export function RhythmSettingsCard({ disabled }: { disabled: boolean }) {
  const { settings, setRhythmSettings } = useEngine();
  const rhythm = settings.practice.rhythm;
  const [error, setError] = useState<string | null>(null);
  const [barsText, setBarsText] = useState(String(rhythm.bars));
  useEffect(() => setBarsText(String(rhythm.bars)), [rhythm.bars]);

  const update = (change: Partial<RhythmPracticeSettings>) => {
    setError(null);
    setRhythmSettings({ ...rhythm, ...change }).catch((e) => setError(String(e)));
  };
  /** Written rhythms set their own length; the bar count does not apply. */
  const writing = rhythm.difficulty === "custom" && rhythm.customMode === "written";

  const commitBars = () => {
    const n = Math.round(Number(barsText));
    if (Number.isFinite(n) && n >= MIN_BARS && n <= MAX_BARS) update({ bars: n });
    else setBarsText(String(rhythm.bars));
  };

  return (
    <OptionsPanel
      title="Exercise"
      locked={disabled}
      error={error}
      instrument={false}
      theory={{ topic: "rhythm", label: "Beats, bars and note values" }}
    >
      <div className="flex flex-col gap-4">
        <TempoField
          id="tempo"
          bpm={rhythm.bpm}
          onChange={(bpm) => update({ bpm })}
          disabled={disabled}
        />
        <ChoiceButtons
          label="Time signature"
          options={TIME_SIGNATURES}
          value={String(rhythm.timeSignature.beatsPerBar)}
          disabled={disabled}
          onChange={(b) => update({ timeSignature: { beatsPerBar: Number(b) } })}
        />
        {!writing && (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="bars" className="font-bold">
              Bars
            </Label>
            <Input
              id="bars"
              type="number"
              min={MIN_BARS}
              max={MAX_BARS}
              className="w-24 bg-inset font-mono font-bold"
              value={barsText}
              disabled={disabled}
              onChange={(e) => setBarsText(e.currentTarget.value)}
              onBlur={commitBars}
              onKeyDown={(e) => e.key === "Enter" && commitBars()}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <ChoiceButtons
          label="Difficulty"
          options={DIFFICULTIES}
          value={rhythm.difficulty}
          disabled={disabled}
          onChange={(difficulty) => update({ difficulty })}
        />
        <p className="text-xs text-muted-foreground">
          {DIFFICULTIES.find((d) => d.id === rhythm.difficulty)?.description}
        </p>
      </div>

      {rhythm.difficulty === "custom" && (
        <div className="flex flex-col gap-2">
          <ChoiceButtons
            label="Custom rhythm"
            options={CUSTOM_MODES}
            value={rhythm.customMode}
            disabled={disabled}
            onChange={(customMode) => update({ customMode })}
          />
          <p className="text-xs text-muted-foreground">
            {CUSTOM_MODES.find((m) => m.id === rhythm.customMode)?.description}
          </p>
        </div>
      )}

      {rhythm.difficulty === "custom" && rhythm.customMode === "random" && (
        <div className="flex flex-col gap-3">
          <OptionChecklist
            legend="Include"
            idPrefix="value"
            items={NOTE_VALUES}
            label={(v) => NOTE_VALUE_LABELS[v]}
            selected={rhythm.custom.values}
            disabled={disabled}
            onChange={(values) => update({ custom: { ...rhythm.custom, values } })}
          />
          <OptionCheckbox
            id="custom-dotted"
            label="Dotted notes"
            checked={rhythm.custom.dotted}
            disabled={disabled}
            onChange={(dotted) => update({ custom: { ...rhythm.custom, dotted } })}
          />
          <OptionCheckbox
            id="custom-rests"
            label="Rests"
            checked={rhythm.custom.rests}
            disabled={disabled}
            onChange={(rests) => update({ custom: { ...rhythm.custom, rests } })}
          />
        </div>
      )}
    </OptionsPanel>
  );
}
