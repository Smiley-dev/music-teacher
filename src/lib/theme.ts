/**
 * Light/dark theme. UI-only state (like the selected section): the choice is
 * remembered in localStorage, applied as shadcn's `.dark` class on <html>,
 * and passed to the window so the title bar matches.
 */
import { getCurrentWindow } from "@tauri-apps/api/window";

/** "system" follows the OS setting. */
export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "music-teacher:theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export function loadThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "system" || saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage unavailable: follow the OS.
  }
  return "system";
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Not remembered across restarts; harmless.
  }
}

/** Apply `preference` to the page and the window's title bar. */
export function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && darkQuery.matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  // Native scrollbars and form controls follow too.
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    // `null` lets the title bar follow the OS again.
    getCurrentWindow()
      .setTheme(preference === "system" ? null : preference)
      .catch(() => {});
  } catch {
    // Not running inside Tauri (e.g. a plain browser): the page is enough.
  }
}

/** Re-apply the saved preference whenever the OS theme changes (matters for
 * "system"). Returns a function that stops listening. */
export function followSystemTheme(): () => void {
  const onChange = () => applyTheme(loadThemePreference());
  darkQuery.addEventListener("change", onChange);
  return () => darkQuery.removeEventListener("change", onChange);
}
