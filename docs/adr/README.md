# Architecture Decision Records

One file per decision, numbered in order: `NNNN-short-title.md`. Records are
never deleted; a decision that changes gets a new ADR that supersedes the old
one (update the old one's status).

## Index

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-pitch-detection-mcleod.md) | Pitch detection with the McLeod Pitch Method | Accepted |
| [0002](0002-native-audio-threads.md) | Audio processing on native Rust threads | Accepted |
| [0003](0003-latency-calibration-audio-clock.md) | Latency calibration on the audio clock | Accepted (detector: 0010) |
| [0004](0004-settings-persistence-json.md) | Settings persisted as JSON by the Rust backend | Accepted |
| [0005](0005-single-audio-engine.md) | One shared audio engine with a single event stream | Accepted |
| [0006](0006-rhythm-exercises-and-practice-sessions.md) | Rhythm exercises generated in Rust, played as engine sessions | Accepted |
| [0007](0007-notation-rendering-vexflow.md) | Music notation rendered with VexFlow | Accepted |
| [0008](0008-rhythm-timing-judgement.md) | Judging rhythm practice timing from input onsets | Accepted |
| [0009](0009-written-custom-rhythms.md) | User-written custom rhythms stored as a symbol sequence | Accepted |
| [0010](0010-spectral-flux-onsets.md) | Spectral-flux onset detection | Accepted |
| [0011](0011-pitch-exercises.md) | Pitch exercises: theory crate, note judge and pitch sessions | Accepted |
| [0012](0012-sight-reading.md) | Sight reading: generated melodies, played from the page | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context

What problem or force makes a decision necessary.

## Decision

What we chose, stated precisely.

## Alternatives considered

- Option: why not.

## Consequences

What becomes easier, what becomes harder, follow-up work.
```
