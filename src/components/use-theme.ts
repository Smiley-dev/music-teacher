import { useState } from "react";

import {
  type ThemePreference,
  applyTheme,
  loadThemePreference,
  saveThemePreference,
} from "@/lib/theme";

/** The theme choice (system, light or dark) and a way to change it. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(loadThemePreference);
  const choose = (next: ThemePreference) => {
    setPreference(next);
    saveThemePreference(next);
    applyTheme(next);
  };
  return { preference, setPreference: choose };
}
