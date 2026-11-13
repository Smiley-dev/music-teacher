import type { Instrument, IntervalName, Pitch, ScaleKind } from "@/lib/engine";

const ACCIDENTAL_SIGNS: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 1: "♯", 2: "𝄪" };

/** A written note for display, e.g. "C♯4". */
export function pitchLabel(p: Pitch, withOctave = true): string {
  const sign = ACCIDENTAL_SIGNS[p.accidental] ?? "";
  return `${p.letter.toUpperCase()}${sign}${withOctave ? p.octave : ""}`;
}

/** Engine note names ("D#4", "Bb3", "F##4") with proper signs. */
export function prettyNoteName(name: string): string {
  return name.replace(/^([A-G])(##|#|bb|b)?/, (_, letter: string, accidental?: string) => {
    const sign = { "##": "𝄪", "#": "♯", bb: "𝄫", b: "♭" }[accidental ?? ""] ?? "";
    return letter + sign;
  });
}

/** Ordinal for small numbers: 1st, 2nd, 3rd, 4th … */
export function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

/** Interval names and their usual abbreviations. */
export const INTERVAL_LABELS: Record<IntervalName, { name: string; short: string }> = {
  minorSecond: { name: "Minor 2nd", short: "m2" },
  majorSecond: { name: "Major 2nd", short: "M2" },
  minorThird: { name: "Minor 3rd", short: "m3" },
  majorThird: { name: "Major 3rd", short: "M3" },
  perfectFourth: { name: "Perfect 4th", short: "P4" },
  tritone: { name: "Tritone", short: "A4" },
  perfectFifth: { name: "Perfect 5th", short: "P5" },
  minorSixth: { name: "Minor 6th", short: "m6" },
  majorSixth: { name: "Major 6th", short: "M6" },
  minorSeventh: { name: "Minor 7th", short: "m7" },
  majorSeventh: { name: "Major 7th", short: "M7" },
  octave: { name: "Octave", short: "P8" },
};

/** Scale names, and how each differs from the major scale. */
export const SCALE_LABELS: Record<ScaleKind, { name: string; hint: string }> = {
  major: { name: "Major", hint: "Ionian" },
  naturalMinor: { name: "Natural minor", hint: "Aeolian: ♭3 ♭6 ♭7" },
  harmonicMinor: { name: "Harmonic minor", hint: "♭3 ♭6, major 7th" },
  melodicMinor: { name: "Melodic minor", hint: "♭3 going up; natural minor down" },
  majorPentatonic: { name: "Major pentatonic", hint: "1 2 3 5 6" },
  minorPentatonic: { name: "Minor pentatonic", hint: "1 ♭3 4 5 ♭7" },
  dorian: { name: "Dorian", hint: "♭3 ♭7" },
  phrygian: { name: "Phrygian", hint: "♭2 ♭3 ♭6 ♭7" },
  lydian: { name: "Lydian", hint: "♯4" },
  mixolydian: { name: "Mixolydian", hint: "♭7" },
  locrian: { name: "Locrian", hint: "♭2 ♭3 ♭5 ♭6 ♭7" },
};

/** Instrument names and what their range covers (`Instrument::written_range` in Rust). */
export const INSTRUMENT_INFO: Record<Instrument, { label: string; hint: string }> = {
  guitar: {
    label: "Guitar",
    hint: "Treble clef, sounds an octave lower than written. From the open low E string up to the 8th fret on the high E string.",
  },
  bassGuitar: {
    label: "Bass guitar",
    hint: "Bass clef, sounds an octave lower than written. From the open E string up to the 7th fret on the G string.",
  },
  keyboardTreble: {
    label: "Keyboard (treble clef)",
    hint: "Right hand: from middle C up two octaves.",
  },
  keyboardBass: {
    label: "Keyboard (bass clef)",
    hint: "Left hand: the two octaves below middle C.",
  },
  violin: {
    label: "Violin",
    hint: "Treble clef, first position: from the open G string up to B on the E string.",
  },
  viola: {
    label: "Viola",
    hint: "Alto clef, first position: from the open C string up to D on the A string.",
  },
  cello: {
    label: "Cello",
    hint: "Bass clef, first position: from the open C string up to D on the A string.",
  },
  doubleBass: {
    label: "Double bass",
    hint: "Bass clef, sounds an octave lower than written. From the open E string up to D on the G string.",
  },
};
