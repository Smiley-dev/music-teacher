import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";

import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { useTheme } from "./use-theme";

const OPTIONS: { id: ThemePreference; label: string; icon: LucideIcon }[] = [
  { id: "system", label: "Follow the system setting", icon: Monitor },
  { id: "light", label: "Light theme", icon: Sun },
  { id: "dark", label: "Dark theme", icon: Moon },
];

/** Light / dark / follow-the-system switch for the app shell. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className={cn("flex items-center justify-between gap-2 px-2", className)}>
      <span className="text-sm text-muted-foreground">Theme</span>
      <div role="radiogroup" aria-label="Theme" className="flex gap-0.5 rounded-lg border bg-background p-0.5">
        {OPTIONS.map(({ id, label, icon: Icon }) => {
          const selected = preference === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              onClick={() => setPreference(id)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "bg-secondary text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
