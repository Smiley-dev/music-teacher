import { Button } from "@/components/ui/button";

import { OptionCheckbox } from "./option-checkbox";

type OptionChecklistProps<T extends string> = {
  legend: string;
  /** Unique prefix for the checkbox ids. */
  idPrefix: string;
  /** All choices, in display order. */
  items: readonly T[];
  label: (item: T) => string;
  description?: (item: T) => string;
  selected: readonly T[];
  disabled?: boolean;
  /** The new selection, in `items` order. */
  onChange: (selected: T[]) => void;
};

/** Several choices out of many (intervals, scales, chords), with All/None. */
export function OptionChecklist<T extends string>({
  legend,
  idPrefix,
  items,
  label,
  description,
  selected,
  disabled,
  onChange,
}: OptionChecklistProps<T>) {
  const toggle = (item: T, on: boolean) =>
    onChange(items.filter((i) => (i === item ? on : selected.includes(i))));
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <OptionCheckbox
            key={item}
            id={`${idPrefix}-${item}`}
            label={label(item)}
            description={description?.(item)}
            checked={selected.includes(item)}
            disabled={disabled}
            onChange={(on) => toggle(item, on)}
          />
        ))}
      </div>
      <div className="flex gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...items])}>
          Select all
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
    </fieldset>
  );
}
