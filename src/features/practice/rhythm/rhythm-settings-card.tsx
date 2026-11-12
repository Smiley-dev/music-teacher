import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  type Difficulty,
  MAX_BARS,
  MAX_BPM,
  MIN_BARS,
  MIN_BPM,
  NOTE_VALUES,
  type NoteValue,
  type CustomMode,
  type ExerciseDraft,
  type RhythmPracticeSettings,
  SUPPORTED_BEATS_PER_BAR,
} from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useEngine } from "@/providers/audio-engine-context";

import { RhythmEditor } from "./rhythm-editor";

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

const VALUE_LABELS: Record<NoteValue, string> = {
  whole: "Whole",
  half: "Half",
  quarter: "Quarter",
  eighth: "Eighth",
  sixteenth: "Sixteenth",
};

type RhythmSettingsCardProps = {
  disabled: boolean;
  /** The current exercise; shown by the editor for written rhythms. */
  draft: ExerciseDraft | null;
  draftError: string | null;
};

export function RhythmSettingsCard({ disabled, draft, draftError }: RhythmSettingsCardProps) {
  const { settings, setRhythmSettings } = useEngine();
  const rhythm = settings.practice.rhythm;
  const [error, setError] = useState<string | null>(null);
  const [bpmDrag, setBpmDrag] = useState<number | null>(null);
  const [barsText, setBarsText] = useState(String(rhythm.bars));
  useEffect(() => setBarsText(String(rhythm.bars)), [rhythm.bars]);

  const update = (change: Partial<RhythmPracticeSettings>) => {
    setError(null);
    setRhythmSettings({ ...rhythm, ...change }).catch((e) => setError(String(e)));
  };
  const bpm = bpmDrag ?? rhythm.bpm;
  /** Written rhythms set their own length; the bar count does not apply. */
  const writing = rhythm.difficulty === "custom" && rhythm.customMode === "written";
  const setBpm = (value: number) => update({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, value)) });

  const toggleValue = (value: NoteValue, on: boolean) => {
    const values = on
      ? NOTE_VALUES.filter((v) => v === value || rhythm.custom.values.includes(v))
      : rhythm.custom.values.filter((v) => v !== value);
    update({ custom: { ...rhythm.custom, values } });
  };

  const commitBars = () => {
    const n = Math.round(Number(barsText));
    if (Number.isFinite(n) && n >= MIN_BARS && n <= MAX_BARS) update({ bars: n });
    else setBarsText(String(rhythm.bars));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exercise</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Difficulty</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
            {DIFFICULTIES.map((d) => (
              <Button
                key={d.id}
                role="radio"
                aria-checked={rhythm.difficulty === d.id}
                variant={rhythm.difficulty === d.id ? "default" : "outline"}
                disabled={disabled}
                onClick={() => update({ difficulty: d.id })}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {DIFFICULTIES.find((d) => d.id === rhythm.difficulty)?.description}
          </p>
        </div>

        {rhythm.difficulty === "custom" && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2" role="radiogroup" aria-label="Custom mode">
              {CUSTOM_MODES.map((m) => (
                <Button
                  key={m.id}
                  role="radio"
                  size="sm"
                  aria-checked={rhythm.customMode === m.id}
                  variant={rhythm.customMode === m.id ? "secondary" : "ghost"}
                  disabled={disabled}
                  onClick={() => update({ customMode: m.id })}
                >
                  {m.label}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {CUSTOM_MODES.find((m) => m.id === rhythm.customMode)?.description}
            </p>
          </div>
        )}

        {rhythm.difficulty === "custom" && rhythm.customMode === "written" && (
          <div className="rounded-lg border p-4">
            <RhythmEditor
              written={rhythm.written}
              draft={draft}
              error={draftError}
              beatsPerBar={rhythm.timeSignature.beatsPerBar}
              disabled={disabled}
              onChange={(written) => update({ written })}
            />
          </div>
        )}

        {rhythm.difficulty === "custom" && rhythm.customMode === "random" && (
          <fieldset className="flex flex-col gap-3 rounded-lg border p-4" disabled={disabled}>
            <legend className="px-1 text-sm font-medium">Include</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {NOTE_VALUES.map((value) => (
                <CheckboxField
                  key={value}
                  id={`value-${value}`}
                  label={VALUE_LABELS[value]}
                  checked={rhythm.custom.values.includes(value)}
                  onChange={(on) => toggleValue(value, on)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-3">
              <CheckboxField
                id="custom-dotted"
                label="Dotted notes"
                checked={rhythm.custom.dotted}
                onChange={(dotted) => update({ custom: { ...rhythm.custom, dotted } })}
              />
              <CheckboxField
                id="custom-rests"
                label="Rests"
                checked={rhythm.custom.rests}
                onChange={(rests) => update({ custom: { ...rhythm.custom, rests } })}
              />
            </div>
          </fieldset>
        )}

        <div className="grid gap-6 sm:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="tempo">Tempo</Label>
              <span className="font-mono text-sm tabular-nums">{bpm} BPM</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Slower"
                disabled={disabled || bpm <= MIN_BPM}
                onClick={() => setBpm(bpm - 1)}
              >
                <Minus />
              </Button>
              <Slider
                id="tempo"
                min={MIN_BPM}
                max={MAX_BPM}
                step={1}
                value={[bpm]}
                disabled={disabled}
                onValueChange={([v]) => setBpmDrag(v)}
                onValueCommit={([v]) => {
                  setBpmDrag(null);
                  setBpm(v);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Faster"
                disabled={disabled || bpm >= MAX_BPM}
                onClick={() => setBpm(bpm + 1)}
              >
                <Plus />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="time-signature">Time signature</Label>
            <Select
              value={String(rhythm.timeSignature.beatsPerBar)}
              onValueChange={(v) => update({ timeSignature: { beatsPerBar: Number(v) } })}
              disabled={disabled}
            >
              <SelectTrigger id="time-signature" className="w-28">
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

          {!writing && (
          <div className="flex flex-col gap-3">
            <Label htmlFor="bars">Bars</Label>
            <Input
              id="bars"
              type="number"
              min={MIN_BARS}
              max={MAX_BARS}
              className="w-24"
              value={barsText}
              disabled={disabled}
              onChange={(e) => setBarsText(e.currentTarget.value)}
              onBlur={commitBars}
              onKeyDown={(e) => e.key === "Enter" && commitBars()}
            />
          </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={cn("flex items-center gap-2")}>
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
