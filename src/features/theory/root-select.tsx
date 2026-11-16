import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Letter, NoteName } from "@/lib/engine";

/** Roots offered: every natural, sharp and flat used as a key note. */
const ROOTS: readonly NoteName[] = (
  [
    ["c", 0],
    ["c", 1],
    ["d", -1],
    ["d", 0],
    ["d", 1],
    ["e", -1],
    ["e", 0],
    ["f", 0],
    ["f", 1],
    ["g", -1],
    ["g", 0],
    ["g", 1],
    ["a", -1],
    ["a", 0],
    ["a", 1],
    ["b", -1],
    ["b", 0],
  ] as const satisfies readonly (readonly [Letter, number])[]
).map(([letter, accidental]) => ({ letter, accidental }));

const SIGNS: Record<number, string> = { [-1]: "♭", 0: "", 1: "♯" };

/** "E♭" */
export function noteNameLabel(n: NoteName): string {
  return n.letter.toUpperCase() + (SIGNS[n.accidental] ?? "");
}

const id = (n: NoteName) => `${n.letter}${n.accidental}`;

type RootSelectProps = {
  label: string;
  value: NoteName;
  onChange: (root: NoteName) => void;
};

/** Pick the note an example starts from. */
export function RootSelect({ label, value, onChange }: RootSelectProps) {
  const selectId = `root-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        value={id(value)}
        onValueChange={(v) => onChange(ROOTS.find((r) => id(r) === v) ?? ROOTS[0])}
      >
        <SelectTrigger id={selectId} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROOTS.map((r) => (
            <SelectItem key={id(r)} value={id(r)}>
              {noteNameLabel(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
