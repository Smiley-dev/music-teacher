/**
 * Helpers shared by the VexFlow renderers (ADR 0007): note keys, key
 * signatures and theme colours. Rendering only; spelling comes from Rust.
 */
import type { KeySignature, Pitch } from "@/lib/engine";

/** VexFlow accidental codes by `Pitch.accidental`. */
export const ACCIDENTAL_CODES: Record<number, string> = { [-2]: "bb", [-1]: "b", 1: "#", 2: "##" };

/** VexFlow key such as "c#/4". */
export function vexKey(p: Pitch): string {
  return `${p.letter}${ACCIDENTAL_CODES[p.accidental] ?? ""}/${p.octave}`;
}

/** VexFlow key-signature spec, named by the major key: "Bb", "F#", "C". */
export function keySpec(key: KeySignature): string {
  const sign = key.major.accidental > 0 ? "#" : key.major.accidental < 0 ? "b" : "";
  return key.major.letter.toUpperCase() + sign;
}

/** VexFlow draws in black; switch it to `currentColor` so the theme applies. */
export function followTheme(container: HTMLElement) {
  for (const el of container.querySelectorAll<SVGElement>("[fill],[stroke]")) {
    for (const attr of ["fill", "stroke"]) {
      const v = el.getAttribute(attr)?.toLowerCase();
      if (v === "black" || v === "#000" || v === "#000000") el.setAttribute(attr, "currentColor");
    }
  }
}
