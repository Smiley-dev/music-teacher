import type { ComponentType } from "react";

import { RhythmPractice } from "./rhythm/rhythm-practice";

export type PracticeSection = {
  id: string;
  label: string;
  Component: ComponentType;
};

/** Practice subsections, in tab order. See docs/CODING_RULES.md to add one. */
export const PRACTICE_SECTIONS = [
  { id: "rhythm", label: "Rhythm", Component: RhythmPractice },
] as const satisfies readonly PracticeSection[];
