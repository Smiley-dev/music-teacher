import type { ComponentType } from "react";

import { ChordsTheory } from "./chords-theory";
import { EarTheory } from "./ear-theory";
import { IntervalsTheory } from "./intervals-theory";
import { KeysTheory } from "./keys-theory";
import { NotesTheory } from "./notes-theory";
import { ReadingTheory } from "./reading-theory";
import { RhythmTheory } from "./rhythm-theory";
import { ScalesTheory } from "./scales-theory";

export type TheoryTopic = {
  id: string;
  label: string;
  Component: ComponentType;
};

/** Theory topics, in menu order (from the basics up). See docs/CODING_RULES.md to add one. */
export const THEORY_TOPICS = [
  { id: "notes", label: "Notes", Component: NotesTheory },
  { id: "rhythm", label: "Rhythm", Component: RhythmTheory },
  { id: "intervals", label: "Intervals", Component: IntervalsTheory },
  { id: "scales", label: "Scales", Component: ScalesTheory },
  { id: "keys", label: "Keys", Component: KeysTheory },
  { id: "chords", label: "Chords", Component: ChordsTheory },
  { id: "reading", label: "Sight reading", Component: ReadingTheory },
  { id: "ear", label: "Ear training", Component: EarTheory },
] as const satisfies readonly TheoryTopic[];
