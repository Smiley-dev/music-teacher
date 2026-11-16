# 0015. One instrument for the whole app, chosen in the main menu

- Status: Accepted
- Date: 2026-11-16

## Context

The instrument (clef, transposition, range) was a pitch practice option,
`practice.pitch.instrument` (ADR 0011). Sight reading (ADR 0012) and the
Theory examples (ADR 0013) reused it, so it was already one saved value, but
it was chosen through a select repeated on six Practice pages and three
Theory explorers. It looked like a per-page option and could only be found
on pages that happened to show it. The settings model also said the wrong
thing: the instrument belongs to the whole app, not to one exercise family.
Saving it meant sending every pitch exercise option along with it, and
nothing stopped it from changing while an exercise made for the old
instrument was running.

## Decision

- **Setting**: `Settings::instrument` at the top level (`instrument` in
  `settings.json`), next to the input device. `PitchPracticeSettings` no
  longer has it. Everything that writes, plays or judges notes reads it:
  pitch sessions, sight-reading melodies, Theory examples (spelled and
  played).
- **Migration**: when the file is loaded, it is read as JSON, an old
  `practice.pitch.instrument` is moved to the top level (unless a top-level
  one already exists), and then it is deserialized. The next save writes the
  new layout.
- **Command**: `set_instrument(instrument)` saves it and broadcasts the
  settings. It is refused while a rhythm, pitch or sight-reading session
  runs ("Stop the exercise before changing the instrument."), because that
  session's notes were generated for the old instrument and the UI would
  redraw them for the new one.
- **UI**: one `InstrumentSelect` in the main menu, under the app name, on
  every page. It is disabled while an exercise runs, using a new
  `useExerciseRunning()` hook. The hook reads a boolean context from
  `AudioEngineProvider`, so the menu does not re-render on every practice
  tick. Practice pages that depend on the instrument show which one they
  are written for and its range (`InstrumentNote`). The selects on Practice
  pages and Theory explorers are gone. `use-pitch-settings` moves back to
  `features/practice/pitch/`, now that only the pitch pages use it.

## Alternatives considered

- **Keep the setting under `practice.pitch` and only move the select**: the
  global select would have to send every pitch exercise option to change
  one value, and the model would keep implying that the instrument is a
  pitch-practice detail.
- **Put the select in Settings**: it would no longer be visible where it
  matters, and moving between Practice and Theory on another instrument
  would mean a trip to Settings each time.
- **`#[serde(alias)]` or a legacy field for the migration**: serde cannot
  alias a field to a path in another struct. A legacy field would stay in
  the model forever. A small JSON migration before deserializing keeps the
  structs clean.
- **Allow changing it during an exercise**: the running session and the
  page would then disagree about clef and range.

## Consequences

- A section that needs the instrument reads `settings.instrument` and does
  nothing else. The choice is already visible and saved.
- The select is also visible on pages that do not use it (Tuner, Rhythm,
  Settings). Today the Tuner shows sounding pitch for every instrument, which
  is what a tuner should show. Instrument-specific tuning targets (open
  strings) are a possible follow-up that would build on this setting.
- Settings files keep loading across the change. Downgrading to an older
  build after the new layout has been saved falls back to the default
  instrument (guitar).
