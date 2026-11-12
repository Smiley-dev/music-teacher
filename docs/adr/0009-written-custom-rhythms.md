# 0009. User-written custom rhythms stored as a symbol sequence

- Status: Accepted
- Date: 2026-11-13

## Context

Custom difficulty generated random exercises from selected note values. Users
also want to write their own rhythm, note by note (including rests and dotted
values), and keep the random option.

## Decision

- `RhythmPracticeSettings` gains `customMode` (`random` | `written`) and
  `written: Vec<Symbol>`, persisted like the other settings (ADR 0004).
- The written rhythm is stored as a **plain sequence of symbols**, not as
  bars. `rhythm::layout(symbols, time signature)` (pure, tested) fills bars
  in order and fails with `DoesNotFit(index)` if a symbol would cross a bar
  line, so no ties are ever needed. Changing the time signature re-lays the
  same sequence out.
- `generate_rhythm_exercise` returns an `ExerciseDraft { exercise, remaining,
  complete }`: generated exercises are always complete; a written one may
  have an unfinished last bar while editing. Only complete drafts can be
  practised or listened to; they go through the same `Exercise::validate`,
  session and judging as generated ones.
- Written rhythms are not subject to the generator's readability rules: the
  user chose them. The bar count setting does not apply to them.
- Editing happens in the UI (append, undo, clear), each change saved through
  `set_rhythm_settings`; the score shows the draft as it grows.

## Alternatives considered

- **Store bars**: a time-signature change would leave bars of the wrong
  length; re-flowing a sequence is simpler and always well defined.
- **Auto-tie notes across bar lines**: correct notation, but ties are not
  supported elsewhere (generator, judge) and add complexity for little gain.
- **Click-to-edit any position**: more powerful; append/undo covers writing a
  rhythm and can be extended later.

## Consequences

- Up to `MAX_WRITTEN_SYMBOLS` (1024) symbols and `MAX_BARS` bars.
- A time signature change can make a written rhythm invalid (a symbol no
  longer fits); the UI explains which symbol and offers undo/clear.
