import type { ComponentType } from "react";
import { Dumbbell, Gauge, type LucideIcon, Settings } from "lucide-react";

import { PracticeScreen } from "@/features/practice/practice-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { TunerScreen } from "@/features/tuner/tuner-screen";

export type Section = {
  id: string;
  label: string;
  /** One line shown under the screen title. */
  description: string;
  icon: LucideIcon;
  Screen: ComponentType;
};

/** Main menu entries, in display order. See docs/CODING_RULES.md to add one. */
export const SECTIONS = [
  {
    id: "tuner",
    label: "Tuner",
    description: "See the note you're playing and tune your instrument.",
    icon: Gauge,
    Screen: TunerScreen,
  },
  {
    id: "practice",
    label: "Practice",
    description: "Rhythm exercises with a metronome.",
    icon: Dumbbell,
    Screen: PracticeScreen,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Input device, volume and latency calibration.",
    icon: Settings,
    Screen: SettingsScreen,
  },
] as const satisfies readonly Section[];

export type SectionId = (typeof SECTIONS)[number]["id"];
