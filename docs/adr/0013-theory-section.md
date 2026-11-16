# 0013. Theory section: reference pages with examples spelled and played by the engine

- Status: Accepted (instrument select moved to the main menu by ADR 0015)
- Date: 2026-11-16

## Context

Practice exercises use many music theory concepts (note names, clefs,
octaves, accidentals, note values, time signatures, intervals, scales and
modes, key signatures, chords and inversions, sight reading, ear training)
without explaining them. Users need a place to learn them, next to where
they practise. Explanations are much clearer with examples drawn on a staff,
and interval, scale and chord examples are much clearer when they can be
heard. Users also want to look up any interval, scale or chord on any root,
not only fixed examples in C.

Spelling those (E♭ up a major 3rd is G; F♯ major has E♯; C diminished 7th
has B𝄫) is music logic, which the coding rules keep in Rust, and the result
must match how Practice spells and places notes for the user's instrument.

## Decision

- **A Theory main-menu section** (`src/features/theory/`), after Practice,
  with one page per topic (`THEORY_TOPICS`, listed in the main menu, ADR
  0014): Notes, Rhythm, Intervals, Scales,
  Keys, Chords, Sight reading, Ear training. Each topic is static text,
  tables and notation examples, plus "In the app" notes on how Practice uses
  the concept and where to practise it.
- **Fixed examples** (the treble staff's lines, note values, a G major
  melody) are written in the topic files as content, drawn by a Theory
  renderer (`render-example.ts`, VexFlow, ADR 0007) that supports any clef or
  percussion, key and time signatures, chords, rests, dots, beams, wrapping
  into lines and lines of text under each note.
- **Explorers** (Intervals, Scales, Chords) let the user pick a kind, a root
  (and direction, up-and-down or inversion). The engine spells them:
  `theory::spell_example(request, instrument)` returns the written notes
  placed on the instrument's staff (the octave that stays in the instrument's
  range, then the fewest ledger lines, then nearest the middle line), the
  sounding MIDI notes, each note's degree against the major scale, letter and
  half steps from the previous note, and a scale's key signature. Unlike the
  exercises it allows double sharps and flats (`ScaleKind::spell`,
  `ChordKind::spell`; `notes` still rejects them), so every root can be shown,
  with a note that Practice skips such roots.
- **Listening**: `play_theory_example(instrument, request)` spells the
  example again and plays its notes one after another (0.6 s each) with
  `ClickPlayer` tones on the default output, as the instrument sounds them.
  Nothing is judged and no input device is needed. The engine keeps the
  player until `ClickPlayer::is_finished()` (set by the output callback once
  every scheduled sound has been rendered) and drops it before any session or
  calibration starts; playing is refused while one runs. Chords are played as
  arpeggios: `ClickPlayer` tones do not overlap.
- **IPC**: `theory_example` (pure; returns `TheoryExample`) and
  `play_theory_example` (async, so opening the output stream does not block
  the main thread). Requests are `ExampleRequest` (`kind`: interval, scale or
  chord) with a `NoteName` root (letter and -1/0/1 accidental). No events: an
  error is the command's result, shown under the Listen button.
- **No new settings**: explorer choices are UI state; the instrument is the
  saved one shared with the pitch exercises (changing it in Theory changes it
  there too).
- Components and helpers now used by both Practice and Theory moved out of
  `features/practice/`: `choice-buttons`, `option-checkbox`,
  `instrument-select` and `use-pitch-settings` to `src/components/`,
  `pitch-labels` to `src/lib/`, and the VexFlow helpers (`vexKey`, `keySpec`,
  theme colours) to `src/lib/notation.ts`.

## Alternatives considered

- **Hard-coded example spellings in TypeScript**: duplicates the spelling
  rules already in `crates/theory`, could disagree with Practice, and cannot
  offer every root.
- **Text only, no examples**: much harder to follow, especially for
  intervals, chords and ear training, which are about sound.
- **Playing examples through a pitch session**: sessions need an input
  device and judge the input; examples only play.
- **Harmonic (stacked) chord playback**: needs overlapping tones in
  `ClickPlayer`; left for later together with chord ear training (see
  [features/exercise-catalog.md](../features/exercise-catalog.md)).
- **Theory in a separate document or website**: separated from the
  exercises, no playback on the user's instrument.

## Consequences

- New concepts added to Practice need a matching Theory topic or section
  (see CODING_RULES.md).
- Topic text is maintained by hand; facts the engine already knows (scale
  degrees, spellings, key signatures of explorer examples) come from Rust.
- Listening uses the same output path as the pitch exercises' "Hear it", so
  the same output-device problems show up the same way.
