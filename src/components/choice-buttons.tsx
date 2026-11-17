import { useId } from "react";

import { cn } from "@/lib/utils";

type ChoiceButtonsProps<T extends string> = {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
};

/** One choice out of a few, as a row of keys; the chosen one is lit (radio
 * group). */
export function ChoiceButtons<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: ChoiceButtonsProps<T>) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="font-bold">
        {label}
      </span>
      <div
        className="grid auto-cols-fr grid-flow-col gap-1.5 font-mono text-xs font-bold"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(o.id)}
              className={cn(
                "min-h-[34px] rounded-[7px] px-2 uppercase transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
