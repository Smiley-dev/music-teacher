/** The key signatures, as reference content for the Theory section. */

/** Sharps and flats of key signatures, in the order they are added. */
export const SHARP_ORDER = ["F♯", "C♯", "G♯", "D♯", "A♯", "E♯", "B♯"];
export const FLAT_ORDER = ["B♭", "E♭", "A♭", "D♭", "G♭", "C♭", "F♭"];

/** "3 flats (B♭, E♭, A♭)" or "no sharps or flats". */
export function keyAccidentals(count: number): string {
  if (count === 0) return "no sharps or flats";
  const n = Math.abs(count);
  const list = count > 0 ? SHARP_ORDER.slice(0, n) : FLAT_ORDER.slice(0, n);
  const kind = count > 0 ? "sharp" : "flat";
  return `${n} ${kind}${n === 1 ? "" : "s"} (${list.join(", ")})`;
}

export type KeyInfo = {
  /** Sharps (> 0) or flats (< 0). */
  accidentals: number;
  major: string;
  minor: string;
  /** VexFlow key-signature spec. */
  spec: string;
};

/** The 15 major keys and their relative minors, by number of sharps or flats. */
export const KEYS: readonly KeyInfo[] = [
  { accidentals: 0, major: "C", minor: "A", spec: "C" },
  { accidentals: 1, major: "G", minor: "E", spec: "G" },
  { accidentals: 2, major: "D", minor: "B", spec: "D" },
  { accidentals: 3, major: "A", minor: "F♯", spec: "A" },
  { accidentals: 4, major: "E", minor: "C♯", spec: "E" },
  { accidentals: 5, major: "B", minor: "G♯", spec: "B" },
  { accidentals: 6, major: "F♯", minor: "D♯", spec: "F#" },
  { accidentals: 7, major: "C♯", minor: "A♯", spec: "C#" },
  { accidentals: -1, major: "F", minor: "D", spec: "F" },
  { accidentals: -2, major: "B♭", minor: "G", spec: "Bb" },
  { accidentals: -3, major: "E♭", minor: "C", spec: "Eb" },
  { accidentals: -4, major: "A♭", minor: "F", spec: "Ab" },
  { accidentals: -5, major: "D♭", minor: "B♭", spec: "Db" },
  { accidentals: -6, major: "G♭", minor: "E♭", spec: "Gb" },
  { accidentals: -7, major: "C♭", minor: "A♭", spec: "Cb" },
];
