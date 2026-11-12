# 0007. Music notation rendered with VexFlow

- Status: Accepted
- Date: 2026-11-13

## Context

Rhythm practice shows exercises in standard music notation: note heads,
stems, flags, beams grouped by beat, dots, rests of every length, bar lines,
clef and time signature. Engraving this correctly by hand is a large job.

## Decision

Use **VexFlow 5** (MIT), imported from `vexflow/bravura`, which bundles the
Bravura music font as a data URI so the app works offline. Rendering lives
in `src/features/practice/rhythm/render-score.ts`:

- One percussion-clef stave per bar, all notes on the middle line (rhythm
  only), beams generated per beat, dots attached with `Dot.buildAndAttach`.
- Bars per line adapt to the container width; the score re-renders on
  resize and when the exercise changes, never per frame.
- The current note is highlighted by toggling a CSS class on the note's SVG
  group, so the 30 Hz cursor updates do not re-render the score.
- Colors follow the theme: black fills/strokes are rewritten to
  `currentColor` after drawing.

## Alternatives considered

- **Hand-drawn SVG**: no dependency, but beams, dots and rest glyphs would
  need to be reimplemented and would look rougher.
- **OpenSheetMusicDisplay / abcjs**: built around importing MusicXML or ABC
  text; heavier, and we generate the music ourselves.
- **`vexflow` default entry**: also embeds Petaluma and Gonville fonts we do
  not use (~800 KB of fonts instead of ~400 KB).

## Consequences

- One frontend dependency, pinned to an exact version.
- VexFlow is only used for drawing; rhythm data comes from Rust
  (`crates/rhythm`), so swapping the renderer later does not affect logic.
