/**
 * Draws a Theory example with VexFlow (ADR 0007, ADR 0013): a few bars on one
 * or more lines, with lines of text under the notes (names, degrees,
 * counts). Rendering only: spelled examples come from the Rust `theory`
 * crate, the fixed ones are written out in the topic files.
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
  Stem,
  Voice,
} from "vexflow/bravura";

import type { Clef } from "@/lib/engine";
import { followTheme } from "@/lib/notation";

export type Duration = "w" | "h" | "q" | "8" | "16";

/** One note, chord or rest. */
export type ScoreNote = {
  /** VexFlow keys ("c/4", "f/4"); several make a chord. Ignored for rests. */
  keys: string[];
  duration: Duration;
  dotted?: boolean;
  rest?: boolean;
  /** Accidental drawn before each key ("#", "b", "n", "##", "bb"), or null. */
  accidentals?: (string | null)[];
  /** Lines of text under the note. */
  labels?: string[];
};

export type ExampleScore = {
  /** "percussion" draws rhythm only: every note on the middle line, stems up. */
  clef: Clef | "percussion";
  /** Key signature ("D", "Bb"), at the start of every line. */
  key?: string;
  /** Time signature ("3/4") on the first bar. Without one, bars hold any notes. */
  time?: string;
  bars: ScoreNote[][];
  /** Draw the final bar line (thin, thick) after the last bar. */
  end?: boolean;
};

/** Drawing scale: a little larger than VexFlow's default staff. */
const SCALE = 1.15;
const PADDING = 8;
const CLEF_WIDTH = 44;
/** Width per sharp or flat of a key signature, layout units. */
const KEY_ACCIDENTAL_WIDTH = 11;
const TIME_SIGNATURE_WIDTH = 30;
/** Room for a note of each length, layout units (before accidentals, dots, labels). */
const NOTE_WIDTH: Record<Duration, number> = { w: 52, h: 44, q: 38, "8": 30, "16": 26 };
const ACCIDENTAL_WIDTH = 14;
const DOT_WIDTH = 8;
/** Space at the start and end of every bar, layout units. */
const BAR_PADDING = 22;
/** Width of an empty bar (a clef and key signature on their own). */
const EMPTY_BAR_WIDTH = 24;
/** Height of a line without labels: the staff plus room for ledger lines
 * (VexFlow leaves four line spaces above the staff). */
const MIN_LINE_HEIGHT = 90;
const LABEL_FONT = "Geist Variable, system-ui, sans-serif";
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 15;
/** Rough width of one label character, to leave room for long labels. */
const LABEL_CHAR_WIDTH = 7;
/** Gap between the lowest note and the first label line. */
const LABEL_GAP = 18;
const ROW_GAP = 4;

/** Layout width a note needs. */
function noteWidth(n: ScoreNote): number {
  const accidentals = (n.accidentals ?? []).some((a) => a) ? ACCIDENTAL_WIDTH : 0;
  const glyph = NOTE_WIDTH[n.duration] + accidentals + (n.dotted ? DOT_WIDTH : 0);
  const label = Math.max(0, ...(n.labels ?? []).map((l) => l.length * LABEL_CHAR_WIDTH + 10));
  return Math.max(glyph, label);
}

function barWidth(bar: ScoreNote[]): number {
  if (bar.length === 0) return EMPTY_BAR_WIDTH;
  return bar.reduce((sum, n) => sum + noteWidth(n), 2 * BAR_PADDING);
}

function keyWidth(key: string | undefined): number {
  if (!key) return 0;
  const count = KEY_COUNTS[key] ?? 0;
  return count === 0 ? 0 : count * KEY_ACCIDENTAL_WIDTH + 8;
}

/** Sharps or flats per key-signature spec. */
const KEY_COUNTS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: 1,
  Bb: 2,
  Eb: 3,
  Ab: 4,
  Db: 5,
  Gb: 6,
  Cb: 7,
};

function makeNote(n: ScoreNote, clef: ExampleScore["clef"]): StaveNote {
  const percussion = clef === "percussion";
  const restKey = clef === "bass" ? "d/3" : clef === "alto" ? "c/4" : "b/4";
  const note = new StaveNote({
    keys: n.rest || percussion ? [restKey] : n.keys,
    duration: n.duration + (n.rest ? "r" : ""),
    dots: n.dotted ? 1 : 0,
    clef: percussion ? "treble" : clef,
    ...(percussion ? { stemDirection: Stem.UP, autoStem: false } : { autoStem: true }),
  });
  if (!n.rest) {
    (n.accidentals ?? []).forEach((code, i) => {
      if (code) note.addModifier(new Accidental(code), i);
    });
  }
  if (n.dotted) Dot.buildAndAttach([note], { all: true });
  return note;
}

/** Draw `score` into `container`, at most `maxWidth` px wide. */
export function renderExample(container: HTMLElement, score: ExampleScore, maxWidth: number) {
  container.replaceChildren();
  const usable = Math.max(200, maxWidth / SCALE - 2 * PADDING);
  const lineStart = CLEF_WIDTH + keyWidth(score.key);
  const timeWidth = score.time ? TIME_SIGNATURE_WIDTH : 0;

  // Lay bars out in lines; a bar that does not fit starts a new line, which
  // begins with the clef and key signature again.
  type Placed = { bar: ScoreNote[]; index: number; width: number };
  const lines: Placed[][] = [];
  let used = 0;
  score.bars.forEach((bar, index) => {
    const own = barWidth(bar);
    if (lines.length === 0 || used + own > usable) {
      lines.push([]);
      used = 0;
    }
    const width = own + (used === 0 ? lineStart + (index === 0 ? timeWidth : 0) : 0);
    lines[lines.length - 1].push({ bar, index, width });
    used += width;
  });
  const natural = lines.map((line) => line.reduce((sum, p) => sum + p.width, 0));
  // Lines that wrapped fill the width (the last keeps its own); a line too
  // wide for the window is squeezed.
  const stretchOf = (row: number) =>
    (lines.length > 1 && row < lines.length - 1) || natural[row] > usable
      ? usable / natural[row]
      : 1;
  const drawnWidth = lines.length > 1 ? usable : Math.min(usable, natural[0] ?? usable);
  const widthPx = Math.ceil((drawnWidth + 2 * PADDING) * SCALE);

  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  // Height is set once everything is drawn and the lowest label is known.
  renderer.resize(widthPx, 2000);
  const ctx = renderer.getContext();
  ctx.scale(SCALE, SCALE);

  let top = 0;
  lines.forEach((line, row) => {
    const stretch = stretchOf(row);
    let x = PADDING;
    let lowest = 0;
    const labelled: StaveNote[] = [];
    const labels: string[][] = [];

    line.forEach(({ bar, index, width }, col) => {
      const stave = new Stave(x, top, width * stretch);
      if (col === 0) {
        stave.addClef(score.clef);
        if (score.key) stave.addKeySignature(score.key);
      }
      if (index === 0 && score.time) stave.addTimeSignature(score.time);
      if (index === score.bars.length - 1) {
        stave.setEndBarType(score.end ? BarlineType.END : BarlineType.SINGLE);
      }
      stave.setContext(ctx).draw();
      x += width * stretch;
      lowest = Math.max(lowest, stave.getBottomLineY());

      if (bar.length === 0) return;
      const notes = bar.map((n) => makeNote(n, score.clef));
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      const beams = Beam.generateBeams(notes, {
        groups: [new Fraction(1, 4)],
        ...(score.clef === "percussion" ? { stemDirection: Stem.UP } : {}),
      });
      // Without a time signature the notes are a list, not a rhythm: space
      // them evenly (softmax 1) so short notes keep room for their labels.
      new Formatter(score.time ? {} : { softmaxFactor: 1 })
        .joinVoices([voice])
        .formatToStave([voice], stave);
      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx).draw());

      notes.forEach((note, i) => {
        const box = note.getBoundingBox();
        lowest = Math.max(lowest, box.getY() + box.getH());
        const text = bar[i].labels;
        if (text?.length) {
          labelled.push(note);
          labels.push(text);
        }
      });
    });

    let bottom = Math.max(lowest + 10, top + MIN_LINE_HEIGHT);
    if (labelled.length > 0) {
      const baseline = lowest + LABEL_GAP;
      ctx.save();
      ctx.setFont(LABEL_FONT, LABEL_FONT_SIZE);
      ctx.openGroup("label");
      labelled.forEach((note, i) => {
        const centre = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2;
        labels[i].forEach((text, line) => {
          const w = ctx.measureText(text).width;
          ctx.fillText(text, centre - w / 2, baseline + line * LABEL_LINE_HEIGHT);
        });
      });
      ctx.closeGroup();
      ctx.restore();
      const lineCount = Math.max(...labels.map((l) => l.length));
      bottom = baseline + (lineCount - 1) * LABEL_LINE_HEIGHT + 6;
    }
    top = bottom + ROW_GAP;
  });

  // Fit the drawing's height to what was drawn (VexFlow's resize would
  // scale twice, so set the SVG's size directly).
  const height = top + PADDING;
  const svg = container.querySelector("svg");
  if (svg) {
    svg.setAttribute("height", String(Math.ceil(height * SCALE)));
    svg.style.height = `${Math.ceil(height * SCALE)}px`;
    svg.setAttribute("viewBox", `0 0 ${widthPx / SCALE} ${height}`);
  }
  followTheme(container);
}
