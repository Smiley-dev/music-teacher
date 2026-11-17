import { Lamp } from "@/components/rack";

type OptionCheckboxProps = {
  id: string;
  label: string;
  /** One line under the label. */
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

/** An on/off exercise option: its name and a lit ON / dark OFF switch. */
export function OptionCheckbox({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: OptionCheckboxProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {description && <p className="text-xs leading-snug text-muted-foreground">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex h-[34px] shrink-0 items-center gap-2 rounded-[7px] border bg-inset px-3 font-mono text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-55"
      >
        <Lamp on={checked} />
        <span className={checked ? undefined : "text-muted-foreground"}>{checked ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}
