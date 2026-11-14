/**
 * Draws a sight-reading melody in standard notation with VexFlow (ADR 0007,
 * ADR 0012): clef and key signature on every line, time signature at the
 * start, beams per beat, rests, dots, and accidentals where the key needs
 * them. Rendering only: the melody comes from the Rust `theory` crate.
 */
import {
  Accidental,
  BarlineType,
  Beam,
  Dot,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow/bravura";

import { vexKey } from "@/features/practice/pitch/render-staff";
import type { Clef, KeySignature, NoteValue, Pitch, ReadingExercise } from "@/lib/engine";

/** Height of one line of staves, px: room for ledger lines and stems. */
const ROW_HEIGHT = 140;
/** Minimum width per beat, px; decides how many bars fit on a line. */
const MIN_BEAT_WIDTH = 72;
const CLEF_WIDTH = 40;
/** Width per sharp or flat of the key signature, px. */
const KEY_ACCIDENTAL_WIDTH = 11;
const TIME_SIGNATURE_WIDTH = 30;
const PADDING = 8;

const DURATIONS: Record<NoteValue, string> = {
  whole: "w",
  half: "h",
  quarter: "q",
  eighth: "8",
  sixteenth: "16",
};

/** Rests sit on the middle line of each clef. */
const REST_KEYS: Record<Clef, string> = { treble: "b/4", bass: "d/3", alto: "c/4" };

/** VexFlow key-signature spec, named by the major key: "Bb", "F#", "C". */
export function keySpec(key: KeySignature): string {
  const sign = key.major.accidental > 0 ? "#" : key.major.accidental < 0 ? "b" : "";
  return key.major.letter.toUpperCase() + sign;
}

export type RenderedReading = {
  /** SVG group per symbol, `[bar][symbol]`. */
  notes: (SVGElement | undefined)[][];
  /** Top of each bar's line within the container, px. */
  barTops: number[];
};

export function renderReading(
  container: HTMLElement,
  exercise: ReadingExercise,
  width: number,
): RenderedReading {
  container.replaceChildren();
  const { rhythm, clef, key } = exercise;
  const beats = rhythm.timeSignature.beatsPerBar;
  const spec = keySpec(key);
  const keyWidth = CLEF_WIDTH + Math.abs(key.accidentals) * KEY_ACCIDENTAL_WIDTH + 8;
  const usable = Math.max(240, width - 2 * PADDING);
  const barsPerRow = Math.max(
    1,
    Math.floor((usable - keyWidth - TIME_SIGNATURE_WIDTH) / (beats * MIN_BEAT_WIDTH)),
  );
  const rows = Math.ceil(rhythm.bars.length / barsPerRow);
  if (rows === 0) return { notes: [], barTops: [] };

  const pitches = new Map<string, Pitch>();
  for (const n of exercise.notes) pitches.set(`${n.bar}:${n.symbol}`, n.written);

  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, rows * ROW_HEIGHT + PADDING);
  const ctx = renderer.getContext();

  const notes: (SVGElement | undefined)[][] = [];
  const barTops: number[] = [];

  rhythm.bars.forEach((bar, index) => {
    const row = Math.floor(index / barsPerRow);
    const col = index % barsPerRow;
    const rowExtra = keyWidth + (row === 0 ? TIME_SIGNATURE_WIDTH : 0);
    const barWidth = (usable - rowExtra) / barsPerRow;
    const x = PADDING + (col === 0 ? 0 : rowExtra + col * barWidth);
    const y = row * ROW_HEIGHT;

    const stave = new Stave(x, y, col === 0 ? barWidth + rowExtra : barWidth);
    if (col === 0) stave.addClef(clef).addKeySignature(spec);
    if (index === 0) stave.addTimeSignature(`${beats}/4`);
    if (index === rhythm.bars.length - 1) stave.setEndBarType(BarlineType.END);
    stave.setContext(ctx).draw();

    const staveNotes = bar.symbols.map((s, i) => {
      const pitch = pitches.get(`${index}:${i}`);
      const note = new StaveNote({
        keys: [s.rest || !pitch ? REST_KEYS[clef] : vexKey(pitch)],
        duration: DURATIONS[s.value] + (s.rest ? "r" : ""),
        dots: s.dotted ? 1 : 0,
        clef,
        autoStem: true,
      });
      if (s.dotted) Dot.buildAndAttach([note], { all: true });
      return note;
    });

    const voice = new Voice({ numBeats: beats, beatValue: 4 });
    voice.addTickables(staveNotes);
    // Accidentals only where the key needs them, per bar.
    Accidental.applyAccidentals([voice], spec);
    const beams = Beam.generateBeams(staveNotes, { groups: [new Fraction(1, 4)] });
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);
    voice.draw(ctx, stave);
    beams.forEach((b) => b.setContext(ctx).draw());

    notes.push(staveNotes.map((n) => n.getSVGElement()));
    barTops.push(y);
  });

  // Follow the theme: VexFlow draws in black.
  for (const el of container.querySelectorAll<SVGElement>("[fill],[stroke]")) {
    for (const attr of ["fill", "stroke"]) {
      const v = el.getAttribute(attr)?.toLowerCase();
      if (v === "black" || v === "#000" || v === "#000000") el.setAttribute(attr, "currentColor");
    }
  }

  return { notes, barTops };
}
