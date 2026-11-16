import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ChoiceButtonsProps<T extends string> = {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
};

/** One choice out of a few, as a row of buttons (radio group). */
export function ChoiceButtons<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: ChoiceButtonsProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Button
            key={o.id}
            role="radio"
            size="sm"
            aria-checked={value === o.id}
            variant={value === o.id ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
