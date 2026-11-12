# Practice

Practice has subsections, shown as tabs. Currently: **Rhythm**. More
subsections (e.g. note reading) are added through the `PRACTICE_SECTIONS`
registry, see [CODING_RULES.md](../CODING_RULES.md).

## Rhythm

Play along with a generated rhythm. Only note **lengths** matter; pitch is
ignored, so any note on any instrument works.

### Settings (saved)

| Setting | Values | Default |
| --- | --- | --- |
| Tempo | 40–200 BPM (quarter note = beat) | 80 |
| Time signature | 2/4, 3/4, 4/4 | 4/4 |
| Bars | 1–64 | 16 |
| Difficulty | Easy, Medium, Hard, Custom | Easy |

Difficulty presets (sixteenth is the shortest value; `crates/rhythm`):

| Level | Note values | Dotted | Rests |
| --- | --- | --- | --- |
| Easy | whole, half, quarter | no | no |
| Medium | whole, half, quarter, eighth, sixteenth | no | no |
| Hard | all of the above | yes (dotted whole, half, quarter, eighth) | yes, every length |
| Custom | any selection of the five values | optional | optional |

Values that do not fit the time signature are never generated (a whole note
needs a 4/4 bar, a dotted whole never fits). If a custom selection cannot fill
a bar (for example only half notes in 3/4) the screen says so instead of
generating.

### Generation rules

Bars are filled exactly (no ties across bar lines) by a seeded, randomized
backtracking search:

- Values of one beat or longer start on a beat.
- Values shorter than a beat stay inside one beat; undotted eighths start on
  an eighth position and sixteenths on any sixteenth.
- Every bar contains at least one played note (never a bar of only rests).
- Rests and dotted values are chosen less often than plain notes.

A new exercise is generated whenever a setting changes, or with **New
exercise**.

### Playing

1. Press **Start**. The engine plays 4 count-in clicks (always four, in any
   time signature; the first is accented), then one click per beat for the
   whole exercise, accenting beat 1 of every bar. Clicks play on the default
   output device.
2. During the count-in the screen counts 1–4; then the note being played is
   highlighted in the score and the bar/beat is shown.
3. The session ends when the last bar is over, or with **Stop**. Settings
   are locked while it runs.

Timing uses the audio clock (ADR 0003, ADR 0006): the cursor position is the
latest input capture time minus the first click's playback time. Practice
therefore needs a running input device; the Start button is disabled
otherwise. Calibration and practice cannot run at the same time.

### Notation

Drawn with VexFlow (ADR 0007) in `features/practice/rhythm/render-score.ts`:
percussion clef, all notes on the middle line, stems up, beams grouped per
beat, dots and rests of every length, time signature on the first bar and a
final bar line. The number of bars per line follows the window width, and the
score scrolls to keep the highlighted note's line visible.

Staff lines are drawn thin and faded (`.vf-stave` in `src/index.css`) so the
notes stand out.

### Timing judgement (ADR 0008)

While you play, the engine detects each note you strike on the input
(`OnsetDetector`, energy rise; pitch is ignored) and `rhythm::TimingJudge`
matches it to the exercise:

| Result | Rule | Colour in the score |
| --- | --- | --- |
| On time | within ±40 ms of the note | green |
| Early / late | inside the note's window, more than 40 ms off | amber |
| Missed | no onset inside the window | red |
| Extra | an onset matching no note (double hit, playing in a rest) | counted |

- A note's window is `min(150 ms, half the gap to its neighbouring note)`.
- Onset times are corrected by the saved latency calibration
  (`settings.latency`); without one the screen warns that results include
  the setup's latency.
- Rests are not judged. The note being played is highlighted in blue.
- Live counters (on time / early / late / missed) update while playing.

### Analysis (after the last bar)

- **Accuracy**: % of notes on time. **Notes played**: % of notes hit at all.
- **Average offset**: mean of the hit offsets; below −15 ms is "rushing",
  above +15 ms "dragging".
- **Consistency**: standard deviation of the offsets (lower is steadier).
- **Extra hits** count.
- **Chart**: each note's offset in order (late up, early down), the ±40 ms
  band shaded green, missed notes as red crosses, bar boundaries as faint
  lines.
- **Tips** based on the numbers (calibrate, check the level, mute between
  notes, slow down, try a faster tempo).

Stopping early discards the analysis. Generating a new exercise hides the
previous results.
