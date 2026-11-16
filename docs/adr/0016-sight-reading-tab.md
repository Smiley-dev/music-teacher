# 0016. Tab for sight reading on guitar and bass guitar

- Status: Accepted
- Date: 2026-11-16

## Context

Guitar and bass players often read tab (tablature): one line per string,
with fret numbers on the lines. Many learn notation by reading it with the
tab underneath. Sight reading (ADR 0012) only showed standard notation.
The request was an option to show tab in Reading when the instrument
(ADR 0015) is guitar or bass guitar.

Tab is not just another rendering of the same notes. A note can usually be
played on two or three strings, so someone has to choose where each note
is played, and that choice is a fingering decision. The coding rules put
note mapping in Rust, in a pure, tested crate.

## Decision

- **Tuning lives on the instrument.** `Instrument::tab_strings()` gives the
  open strings as sounding MIDI notes, highest first (tab order). Guitar is
  E4 B3 G3 D3 A2 E2 and bass guitar G2 D2 A1 E1. Every other instrument
  returns `None` (not written in tab). Alternate tunings are not offered.
- **Fingering in `crates/theory` (`tab.rs`)**: `tablature(instrument,
  midis)` returns a `Tablature` (`strings`, one `TabPosition { string,
  fret }` per note, string 1 = top line), or `None`. It works by dynamic
  programming over every (string, fret) choice of each note (frets
  0–`MAX_TAB_FRET` = 12) and every hand position. A position is the index
  finger at fret *p*, and it reaches frets *p* to *p*+3. Open strings fit
  any position. The costs, all named constants:
  - each position shift: 4, plus 1 per fret moved;
  - each note: 1 per fret the position is above the first;
  - each fretted note: 1 (so an open string wins when it is in reach).

  The result is the lowest-position fingering a reader would use, with few
  shifts. Ties go to the earlier string and the lower position, so the
  result is deterministic. Tests pin first position with open strings
  (C major), staying in fifth position (C5 B4 A4 G4 ends on the B string's
  8th fret), the return to first position, and that every position sounds
  its note.
- **Every guitar or bass melody carries its tab.** `ReadingExercise` gains
  `tab: Option<Tablature>` (`#[serde(default)]`; `validate` checks one
  position per note). The engine computes it in `generate_reading` whether
  or not the tab is shown, so turning it on and off needs no IPC and never
  changes the melody.
- **Display setting**: `practice.reading.showTab` (default off). It sits
  next to the tempo, not in `ReadingOptions`, because changing the melody
  options generates a new melody. The **Show tab** checkbox appears only
  when the current melody has a tab.
- **Rendering** (`render-reading.ts`): a VexFlow `TabStave` under each
  bar's `Stave`, at the same x and width. Both staves get the same note
  start x, and the notation voice and the tab voice (`TabNote`, with
  `GhostNote` for rests) are formatted together, so each fret number sits
  under its note. A connector joins the two staves at the start of each
  line. VexFlow only has the six-line "TAB" sign, so 4-string tab uses the
  SMuFL four-string glyph, centred on the middle line. The white box
  VexFlow draws behind each fret number is filled with the card colour
  (CSS), so it works in dark mode. Note-state classes go on the fret
  number too.

## Alternatives considered

- **Lowest fret for each note on its own**: no hand model, so the
  fingering would jump between strings and positions mid-phrase.
- **Fingering in TypeScript**: this is note mapping, which the coding rules
  put in Rust. It would also be untested.
- **Tab only (no notation)**: Reading exists to practise notation. Showing
  tab under the notation helps without replacing it. A tab-only mode can
  be added later as another display option.
- **Tab as a melody option**: toggling it would generate a new melody.
- **Fingering hints for violin, viola and cello**: they are not written in
  tab. Positions on unfretted instruments are a separate topic.

## Consequences

- Other pages could show tab from the same `tablature()` call: the note
  exercises, and the Theory examples, which would need a tab mode in
  `render-example.ts`.
- If players dislike particular fingerings, the cost constants are the
  place to tune them. A test should pin each change.
- Rows of notation get taller with the tab, so fewer lines fit before the
  score scrolls.
