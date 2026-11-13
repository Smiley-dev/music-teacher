import type { ComponentType } from "react";

import { ChordsPractice } from "./chords/chords-practice";
import { EarPractice } from "./ear/ear-practice";
import { IntervalsPractice } from "./intervals/intervals-practice";
import { NotesPractice } from "./notes/notes-practice";
import { RhythmPractice } from "./rhythm/rhythm-practice";
import { ScalesPractice } from "./scales/scales-practice";

export type PracticeSection = {
  id: string;
  label: string;
  Component: ComponentType;
};

/** Practice subsections, in tab order. See docs/CODING_RULES.md to add one. */
export const PRACTICE_SECTIONS = [
  { id: "rhythm", label: "Rhythm", Component: RhythmPractice },
  { id: "notes", label: "Notes", Component: NotesPractice },
  { id: "intervals", label: "Intervals", Component: IntervalsPractice },
  { id: "scales", label: "Scales", Component: ScalesPractice },
  { id: "chords", label: "Chords", Component: ChordsPractice },
  { id: "ear", label: "Ear training", Component: EarPractice },
] as const satisfies readonly PracticeSection[];
