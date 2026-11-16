/**
 * Shorthand for writing Theory examples: notes by name ("F#4", "Bb3"; "Bn4"
 * draws a natural sign), chords, rhythm-only beats and rests.
 */
import type { Pitch } from "@/lib/engine";
import { ACCIDENTAL_CODES, vexKey } from "@/lib/notation";

import type { Duration, ScoreNote } from "./render-example";

const NOTE_NAME = /^([A-G])(##|#|bb|b|n)?(\d)$/;

function parse(name: string): { key: string; accidental: string | null } {
  const match = NOTE_NAME.exec(name);
  if (!match) throw new Error(`Not a note name: ${name}`);
  const [, letter, accidental, octave] = match;
  const sounding = accidental && accidental !== "n" ? accidental : "";
  return { key: `${letter.toLowerCase()}${sounding}/${octave}`, accidental: accidental ?? null };
}

const lines = (labels?: string | string[]) =>
  labels === undefined ? undefined : Array.isArray(labels) ? labels : [labels];

/** A note drawn with the accidental written in its name. */
export function note(
  name: string,
  labels?: string | string[],
  duration: Duration = "w",
  dotted = false,
): ScoreNote {
  const { key, accidental } = parse(name);
  return { keys: [key], accidentals: [accidental], duration, dotted, labels: lines(labels) };
}

/** Several notes sounding together, lowest first. */
export function chord(
  names: string[],
  labels?: string | string[],
  duration: Duration = "w",
): ScoreNote {
  const parsed = names.map(parse);
  return {
    keys: parsed.map((p) => p.key),
    accidentals: parsed.map((p) => p.accidental),
    duration,
    labels: lines(labels),
  };
}

/** A note of a rhythm (percussion clef: its pitch does not matter). */
export function beat(duration: Duration, labels?: string | string[], dotted = false): ScoreNote {
  return { keys: ["b/4"], duration, dotted, labels: lines(labels) };
}

export function rest(duration: Duration, labels?: string | string[], dotted = false): ScoreNote {
  return { keys: [], duration, dotted, rest: true, labels: lines(labels) };
}

/** A spelled pitch from the engine as a whole note, accidental drawn. */
export function pitchNote(p: Pitch, labels?: string[]): ScoreNote {
  return {
    keys: [vexKey(p)],
    accidentals: [ACCIDENTAL_CODES[p.accidental] ?? null],
    duration: "w",
    labels,
  };
}

/** Spelled pitches sounding together. */
export function pitchChord(pitches: Pitch[], labels?: string[]): ScoreNote {
  return {
    keys: pitches.map(vexKey),
    accidentals: pitches.map((p) => ACCIDENTAL_CODES[p.accidental] ?? null),
    duration: "w",
    labels,
  };
}
