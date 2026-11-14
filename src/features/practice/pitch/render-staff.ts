/**
 * Draws a pitch task as whole notes on one stave with VexFlow (ADR 0007).
 * Rendering only: the notes come from the Rust `theory` crate.
 */
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow/bravura";

import type { Clef, Pitch } from "@/lib/engine";

/** Largest drawing scale: few notes are drawn big so they are easy to read. */
const MAX_SCALE = 1.5;
/** Smallest drawing scale: long tasks (scales up and down) shrink to this to fit. */
const MIN_SCALE = 1;
/** Height in layout units: room for four ledger lines above and below the staff. */
const HEIGHT = 150;
/** Width reserved for the clef, px. */
const CLEF_WIDTH = 50;
/** Preferred width per note, px (squeezed when the container is narrower). */
const NOTE_WIDTH = 56;
/** Fewest note slots the stave is sized for, so one note is not cramped. */
const MIN_SLOTS = 3;
const PADDING = 8;

export const ACCIDENTAL_CODES: Record<number, string> = { [-2]: "bb", [-1]: "b", 1: "#", 2: "##" };

/** VexFlow key such as "c#/4". */
export function vexKey(p: Pitch): string {
  return `${p.letter}${ACCIDENTAL_CODES[p.accidental] ?? ""}/${p.octave}`;
}

/** Draw `notes` on a `clef` stave; returns each note's SVG group (for colouring). */
export function renderStaff(
  container: HTMLElement,
  clef: Clef,
  notes: Pitch[],
  maxWidth: number,
): (SVGElement | undefined)[] {
  container.replaceChildren();
  const wanted = CLEF_WIDTH + Math.max(MIN_SLOTS, notes.length) * NOTE_WIDTH + 2 * PADDING;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, maxWidth / wanted));
  const width = Math.max(200, Math.min(maxWidth / scale, wanted));

  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width * scale, HEIGHT * scale);
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  const stave = new Stave(PADDING, 0, width - 2 * PADDING);
  stave.addClef(clef);
  stave.setContext(ctx).draw();

  let elements: (SVGElement | undefined)[] = [];
  if (notes.length > 0) {
    const staveNotes = notes.map((p) => {
      const note = new StaveNote({ keys: [vexKey(p)], duration: "w", clef });
      const code = ACCIDENTAL_CODES[p.accidental];
      if (code) note.addModifier(new Accidental(code), 0);
      return note;
    });
    const voice = new Voice({ numBeats: 4 * notes.length, beatValue: 4 });
    voice.addTickables(staveNotes);
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);
    voice.draw(ctx, stave);
    elements = staveNotes.map((n) => n.getSVGElement());
  }

  // Follow the theme: VexFlow draws in black.
  for (const el of container.querySelectorAll<SVGElement>("[fill],[stroke]")) {
    for (const attr of ["fill", "stroke"]) {
      const v = el.getAttribute(attr)?.toLowerCase();
      if (v === "black" || v === "#000" || v === "#000000") el.setAttribute(attr, "currentColor");
    }
  }
  return elements;
}
