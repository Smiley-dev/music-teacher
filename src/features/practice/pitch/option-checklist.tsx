import { useId } from "react";

import { Lamp } from "@/components/rack";
import { cn } from "@/lib/utils";

type OptionChecklistProps<T extends string> = {
  legend: string;
  /** Unique prefix for the choice ids. */
  idPrefix: string;
  /** All choices, in display order. */
  items: readonly T[];
  label: (item: T) => string;
  /** Shown as the choice's tooltip. */
  description?: (item: T) => string;
  selected: readonly T[];
  disabled?: boolean;
  /** The new selection, in `items` order. */
  onChange: (selected: T[]) => void;
  /** Columns of choices (2 fits the options panel). */
  columns?: 2 | 3 | 4;
};

const COLUMNS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const;

/** Several choices out of many (intervals, scales, chords) as lit keys, with
 * All / None. */
export function OptionChecklist<T extends string>({
  legend,
  idPrefix,
  items,
  label,
  description,
  selected,
  disabled,
  onChange,
  columns = 2,
}: OptionChecklistProps<T>) {
  const legendId = useId();
  const toggle = (item: T) =>
    onChange(items.filter((i) => (i === item ? !selected.includes(i) : selected.includes(i))));
  return (
    <div role="group" aria-labelledby={legendId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={legendId} className="font-bold">
          {legend}
        </span>
        <span className="flex gap-1 font-mono text-[10px] font-bold tracking-[0.1em]">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...items])}
            className="rounded px-1.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            ALL
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="rounded px-1.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            NONE
          </button>
        </span>
      </div>
      <div className={cn("grid gap-1.5 font-mono text-[11px] font-bold", COLUMNS[columns])}>
        {items.map((item) => {
          const on = selected.includes(item);
          return (
            <button
              key={item}
              id={`${idPrefix}-${item}`}
              type="button"
              aria-pressed={on}
              title={description?.(item)}
              disabled={disabled}
              onClick={() => toggle(item)}
              className={cn(
                "flex min-h-[34px] items-center gap-1.5 rounded-[7px] bg-muted px-2 py-1 text-left uppercase",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60",
                on ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Lamp on={on} tone="signal" className="size-1.5" />
              {label(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
