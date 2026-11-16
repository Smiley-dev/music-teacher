import type { ComponentType } from "react";
import { BookOpen, Dumbbell, Gauge, type LucideIcon, Settings } from "lucide-react";

import { PRACTICE_SECTIONS } from "@/features/practice/practice-sections";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { THEORY_TOPICS } from "@/features/theory/theory-topics";
import { TunerScreen } from "@/features/tuner/tuner-screen";

/** A page inside a section, listed under it in the main menu. */
export type Subsection = {
  id: string;
  label: string;
  Component: ComponentType;
};

type SectionBase = {
  id: string;
  label: string;
  /** One line shown under the screen title. */
  description: string;
  icon: LucideIcon;
};

/** A main menu entry: one screen, or subsections listed under it. */
export type Section = SectionBase &
  (
    | { Screen: ComponentType; subsections?: never }
    | { subsections: readonly Subsection[]; Screen?: never }
  );

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
    description: "Rhythm and note exercises that listen to your instrument.",
    icon: Dumbbell,
    subsections: PRACTICE_SECTIONS,
  },
  {
    id: "theory",
    label: "Theory",
    description: "The music theory behind every exercise, with examples to see and hear.",
    icon: BookOpen,
    subsections: THEORY_TOPICS,
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

/** Subsection ids of section `Id` ("rhythm", "reading" … for "practice"). */
export type SubsectionId<Id extends SectionId> =
  Extract<(typeof SECTIONS)[number], { id: Id }> extends {
    subsections: readonly (infer S extends { id: string })[];
  }
    ? S["id"]
    : never;

/** The subsections of `section` (empty for a single screen). */
export function subsectionsOf(section: Section): readonly Subsection[] {
  return section.subsections ?? [];
}
