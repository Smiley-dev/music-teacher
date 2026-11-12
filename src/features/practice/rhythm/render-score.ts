/**
 * Draws a rhythm exercise as standard notation with VexFlow (ADR 0007).
 * Rendering only: the exercise comes from the Rust `rhythm` crate.
 */
import {
  BarlineType,
  Beam,
  Dot,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveNote,
  Stem,
  Voice,
} from "vexflow/bravura";

import type { Exercise, NoteValue } from "@/lib/engine";

/** Height of one line of staves, px. */
const ROW_HEIGHT = 110;
/** Minimum width per beat, px; decides how many bars fit on a line. */
const MIN_BEAT_WIDTH = 64;
/** Extra width at the start of a line for the clef (and time signature). */
const CLEF_WIDTH = 40;
const TIME_SIGNATURE_WIDTH = 30;
const PADDING = 8;
/** Rhythm only: every note sits on the middle line. */
const NOTE_KEY = "b/4";

const DURATIONS: Record<NoteValue, string> = {
  whole: "w",
  half: "h",
  quarter: "q",
  eighth: "8",
  sixteenth: "16",
};

/** CSS class on the note being played. */
export const ACTIVE_NOTE_CLASS = "vf-active";

export type RenderedScore = {
  /** SVG group per symbol, `[bar][symbol]`. */
  notes: (SVGElement | undefined)[][];
  /** Top of each bar's line within the container, px. */
  barTops: number[];
};

export function renderScore(container: HTMLElement, exercise: Exercise, width: number): RenderedScore {
  container.replaceChildren();
  const beats = exercise.timeSignature.beatsPerBar;
  const usable = Math.max(200, width - 2 * PADDING);
  const barsPerRow = Math.max(
    1,
    Math.floor((usable - CLEF_WIDTH - TIME_SIGNATURE_WIDTH) / (beats * MIN_BEAT_WIDTH)),
  );
  const rows = Math.ceil(exercise.bars.length / barsPerRow);
  if (rows === 0) return { notes: [], barTops: [] };
  const barLen = beats * 4;

  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, rows * ROW_HEIGHT + PADDING);
  const ctx = renderer.getContext();

  const notes: (SVGElement | undefined)[][] = [];
  const barTops: number[] = [];

  exercise.bars.forEach((bar, index) => {
    const row = Math.floor(index / barsPerRow);
    const col = index % barsPerRow;
    const first = index === 0;
    const rowExtra = CLEF_WIDTH + (row === 0 ? TIME_SIGNATURE_WIDTH : 0);
    const barWidth = (usable - rowExtra) / barsPerRow;
    const x = PADDING + (col === 0 ? 0 : rowExtra + col * barWidth);
    const y = row * ROW_HEIGHT;

    const stave = new Stave(x, y, col === 0 ? barWidth + rowExtra : barWidth);
    if (col === 0) stave.addClef("percussion");
    if (first) stave.addTimeSignature(`${beats}/4`);
    if (index === exercise.bars.length - 1) stave.setEndBarType(BarlineType.END);
    stave.setContext(ctx).draw();

    const staveNotes = bar.symbols.map((s) => {
      const note = new StaveNote({
        keys: [NOTE_KEY],
        duration: DURATIONS[s.value] + (s.rest ? "r" : ""),
        dots: s.dotted ? 1 : 0,
        stemDirection: Stem.UP,
        autoStem: false,
      });
      if (s.dotted) Dot.buildAndAttach([note], { all: true });
      return note;
    });

    const voice = new Voice({ numBeats: beats, beatValue: 4 });
    // A written rhythm's last bar may still be unfinished while editing.
    const filled = bar.symbols.reduce((sum, s) => sum + s.duration, 0);
    if (filled < barLen) voice.setMode(Voice.Mode.SOFT);
    voice.addTickables(staveNotes);
    const beams = Beam.generateBeams(staveNotes, {
      groups: [new Fraction(1, 4)],
      stemDirection: Stem.UP,
    });
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

/** Index of the symbol sounding at `positionBeats`, or null outside the exercise. */
export function symbolAt(
  exercise: Exercise,
  positionBeats: number,
): { bar: number; symbol: number } | null {
  if (positionBeats < 0) return null;
  const barLen = exercise.timeSignature.beatsPerBar * 4;
  const sixteenth = positionBeats * 4;
  const bar = Math.floor(sixteenth / barLen);
  const symbols = exercise.bars[bar]?.symbols;
  if (!symbols) return null;
  const within = sixteenth - bar * barLen;
  const symbol = symbols.findIndex((s) => within >= s.start && within < s.start + s.duration);
  return symbol < 0 ? null : { bar, symbol };
}
