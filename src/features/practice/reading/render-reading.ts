/**
 * Draws a sight-reading melody in standard notation with VexFlow (ADR 0007,
 * ADR 0012): clef and key signature on every line, time signature at the
 * start, beams per beat, rests, dots, and accidentals where the key needs
 * them. With `showTab` and a melody that has a tab (guitar, bass guitar;
 * ADR 0016), a tab staff under each line gives the string and fret of every
 * note, aligned with it. Rendering only: the melody and its tab come from
 * the Rust `theory` crate.
 */
import {
  Accidental,
  BarlineType,
  Beam,
  Clef as ClefSign,
  Dot,
  Formatter,
  Fraction,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TabNote,
  TabStave,
  Voice,
} from "vexflow/bravura";

import type { Clef, NoteValue, Pitch, ReadingExercise, TabPosition } from "@/lib/engine";
import { followTheme, keySpec, vexKey } from "@/lib/notation";

/** Height of one line of staves, px: room for ledger lines and stems. */
const ROW_HEIGHT = 140;
/** From the notation's bottom line to the tab's top line, px: room for low
 * notes on ledger lines in between. */
const TAB_GAP = 55;
/** Space under the tab's bottom line, px. */
const TAB_BOTTOM = 24;
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

/** SMuFL "TAB" clef sized for four lines (VexFlow only has the six-line one). */
const FOUR_STRING_TAB_CLEF = "";

/** The "TAB" sign at the start of a tab staff, sized and centred for its
 * number of lines. */
function tabClef(strings: number): ClefSign {
  const sign = new ClefSign("tab");
  if (strings === 4) {
    sign.code = FOUR_STRING_TAB_CLEF;
    sign.setText(FOUR_STRING_TAB_CLEF);
  }
  sign.line = (strings - 1) / 2;
  return sign;
}

export type RenderedReading = {
  /** SVG groups per symbol, `[bar][symbol]`: the note, plus its tab number
   * when the tab is shown. */
  notes: SVGElement[][][];
  /** Top of each bar's line within the container, px. */
  barTops: number[];
};

/** Height of a line of staves and where its tab staff starts, px. */
function rowLayout(strings: number | null): { height: number; tabY: number } {
  if (strings === null) return { height: ROW_HEIGHT, tabY: 0 };
  const staffBottom = new Stave(0, 0, 100).getYForLine(4);
  const probe = new TabStave(0, 0, 100, { numLines: strings });
  const tabTop = probe.getYForLine(0);
  const tabHeight = probe.getYForLine(strings - 1) - tabTop;
  return {
    height: staffBottom + TAB_GAP + tabHeight + TAB_BOTTOM,
    tabY: staffBottom + TAB_GAP - tabTop,
  };
}

export function renderReading(
  container: HTMLElement,
  exercise: ReadingExercise,
  width: number,
  showTab: boolean,
): RenderedReading {
  container.replaceChildren();
  const { rhythm, clef, key } = exercise;
  const tab = showTab ? exercise.tab : null;
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
  const layout = rowLayout(tab?.strings ?? null);

  const pitches = new Map<string, Pitch>();
  const positions = new Map<string, TabPosition>();
  exercise.notes.forEach((n, i) => {
    const slot = `${n.bar}:${n.symbol}`;
    pitches.set(slot, n.written);
    const position = tab?.positions[i];
    if (position) positions.set(slot, position);
  });

  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, rows * layout.height + PADDING);
  const ctx = renderer.getContext();

  const notes: SVGElement[][][] = [];
  const barTops: number[] = [];

  rhythm.bars.forEach((bar, index) => {
    const row = Math.floor(index / barsPerRow);
    const col = index % barsPerRow;
    const rowExtra = keyWidth + (row === 0 ? TIME_SIGNATURE_WIDTH : 0);
    const barWidth = (usable - rowExtra) / barsPerRow;
    const x = PADDING + (col === 0 ? 0 : rowExtra + col * barWidth);
    const y = row * layout.height;
    const staveWidth = col === 0 ? barWidth + rowExtra : barWidth;
    const last = index === rhythm.bars.length - 1;

    const stave = new Stave(x, y, staveWidth);
    if (col === 0) stave.addClef(clef).addKeySignature(spec);
    if (index === 0) stave.addTimeSignature(`${beats}/4`);
    if (last) stave.setEndBarType(BarlineType.END);

    const strings = tab?.strings ?? 0;
    const tabStave = tab
      ? new TabStave(x, y + layout.tabY, staveWidth, { numLines: strings })
      : null;
    if (tabStave) {
      if (col === 0) tabStave.addModifier(tabClef(strings));
      if (last) tabStave.setEndBarType(BarlineType.END);
      // Notes line up only if both staves start them at the same x.
      const start = Math.max(stave.getNoteStartX(), tabStave.getNoteStartX());
      stave.setNoteStartX(start);
      tabStave.setNoteStartX(start);
    }
    stave.setContext(ctx).draw();
    if (tabStave) {
      tabStave.setContext(ctx).draw();
      if (col === 0) {
        new StaveConnector(stave, tabStave).setType("singleLeft").setContext(ctx).draw();
      }
    }

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
    // Rests take their time in the tab but draw nothing there.
    const tabNotes = tabStave
      ? bar.symbols.map((s, i) => {
          const position = positions.get(`${index}:${i}`);
          const timing = { duration: DURATIONS[s.value], dots: s.dotted ? 1 : 0 };
          if (s.rest || !position) return new GhostNote(timing);
          return new TabNote({
            ...timing,
            positions: [{ str: position.string, fret: position.fret }],
          });
        })
      : [];

    const voice = new Voice({ numBeats: beats, beatValue: 4 });
    voice.addTickables(staveNotes);
    // Accidentals only where the key needs them, per bar.
    Accidental.applyAccidentals([voice], spec);
    const beams = Beam.generateBeams(staveNotes, { groups: [new Fraction(1, 4)] });
    const formatter = new Formatter().joinVoices([voice]);
    if (tabStave) {
      const tabVoice = new Voice({ numBeats: beats, beatValue: 4 });
      tabVoice.addTickables(tabNotes);
      // Formatted together, so each fret number sits under its note.
      formatter.joinVoices([tabVoice]).formatToStave([voice, tabVoice], stave);
      voice.draw(ctx, stave);
      tabVoice.draw(ctx, tabStave);
    } else {
      formatter.formatToStave([voice], stave);
      voice.draw(ctx, stave);
    }
    beams.forEach((b) => b.setContext(ctx).draw());

    notes.push(
      staveNotes.map((n, i) => {
        const tabNote = tabNotes[i];
        const fret = tabNote instanceof TabNote ? tabNote.getSVGElement() : undefined;
        return [n.getSVGElement(), fret].filter((g): g is SVGElement => g !== undefined);
      }),
    );
    barTops.push(y);
  });

  followTheme(container);
  return { notes, barTops };
}
