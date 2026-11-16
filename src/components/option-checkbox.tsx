import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type OptionCheckboxProps = {
  id: string;
  label: string;
  /** One line under the label. */
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

/** A labelled checkbox for exercise options. */
export function OptionCheckbox({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: OptionCheckboxProps) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
