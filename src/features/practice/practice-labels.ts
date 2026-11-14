import type { NoteValue } from "@/lib/engine";

/** Note value names, shared by rhythm and sight-reading options. */
export const NOTE_VALUE_LABELS: Record<NoteValue, string> = {
  whole: "Whole",
  half: "Half",
  quarter: "Quarter",
  eighth: "Eighth",
  sixteenth: "Sixteenth",
};
