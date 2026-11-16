import { useState } from "react";

import type { PitchPracticeSettings } from "@/lib/engine";
import { useEngine } from "@/providers/audio-engine-context";

/** The saved pitch practice settings and a way to change part of them. */
export function usePitchSettings() {
  const { settings, setPitchSettings } = useEngine();
  const pitch = settings.practice.pitch;
  const [error, setError] = useState<string | null>(null);
  const update = (change: Partial<PitchPracticeSettings>) => {
    setError(null);
    setPitchSettings({ ...pitch, ...change }).catch((e) => setError(String(e)));
  };
  return { pitch, update, error };
}
