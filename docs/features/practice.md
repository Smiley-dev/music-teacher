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
| Bars | 1–64 (not used for written rhythms) | 16 |
| Difficulty | Easy, Medium, Hard, Custom | Easy |
| Custom mode | Random, Write your own | Random |

Difficulty presets (sixteenth is the shortest value; `crates/rhythm`):

| Level | Note values | Dotted | Rests |
| --- | --- | --- | --- |
| Easy | whole, half, quarter | no | no |
| Medium | whole, half, quarter, eighth, sixteenth | no | no |
| Hard | all of the above | yes (dotted whole, half, quarter, eighth) | yes, every length |
| Custom → Random | any selection of the five values | optional | optional |
| Custom → Write your own | whatever the user writes | yes | yes |

Values that do not fit the time signature are never generated (a whole note
needs a 4/4 bar, a dotted whole never fits). If a custom selection cannot fill
a bar (for example only half notes in 3/4) the screen says so instead of
generating.

### Writing your own rhythm (Custom → Write your own, ADR 0009)

- Choose **Notes** or **Rests**, optionally **Dotted**, then click a length
  (whole … sixteenth, shown as music glyphs) to add it at the end. Lengths
  that do not fit in the rest of the current bar are disabled; dotted
  sixteenths are not available. Bars fill up automatically.
- **Undo** removes the last symbol, **Clear** removes all. The score below
  shows the rhythm as it grows (an unfinished last bar is drawn as is).
- The rhythm can be listened to and practised once every bar is full and it
  contains at least one note. Its length is whatever was written; the Bars
  setting does not apply, and **New exercise** is hidden.
- It is saved as a sequence of symbols. Changing the time signature lays the
  same sequence out again; if a symbol would then cross a bar line, the
  editor says which one and offers Undo/Clear.
- Up to 1024 symbols / 64 bars. Practice judging and the analysis work the
  same as for generated exercises.

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

### Listening

**Listen** plays the exercise back before practicing it: the same count-in
and metronome, plus every note as a soft plucked tone (a few harmonics,
decaying) on one random pitch between A2 and A4, chosen anew each time and
shown on screen ("Listening on E3"). Tones sound for 90% of their length so
repeated notes are distinct; rests are silent. The score cursor follows the
playback. Nothing is judged and no analysis is shown; Stop ends it. It is the
same engine session as practice (`SessionMode::Listen`), so it also needs a
running input device for its clock.

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
(`OnsetDetector`, spectral flux, ADR 0010; pitch is ignored) and `rhythm::TimingJudge`
matches it to the exercise:

| Result | Rule | Colour in the score |
| --- | --- | --- |
| On time | within ±40 ms of the note | green |
| Early / late | inside the note's window, more than 40 ms off | amber |
| Missed | no onset inside the window | red |
| Extra | an onset matching no note (double hit, playing in a rest) | counted |

- A note's window is `min(150 ms, half the gap to its neighbouring note)`.
- Onset times are corrected by the saved latency calibration
  (`settings.latency`). Above the score a line shows the latency in use
  (value and whether it was measured or entered) with a **Recalibrate**
  button, or a warning with **Calibrate now** when there is none. The button
  opens the same calibration as in Settings in a dialog (closing it while the
  clicks play cancels the calibration). A new value applies from the next
  session; calibration is unavailable while a session runs.
- Rests are not judged. The note being played is highlighted in blue.
- Live counters (on time / early / late / missed) update while playing.

### Accuracy and warnings

Measured on synthetic plucked strings (`cargo run -p dsp --example
onset_accuracy --release`, ADR 0010), sixteenths at 60–200 BPM:

| Notes | Detected | Timing error |
| --- | --- | --- |
| High (E4, A4) | 88–100 % | 1–5 ms |
| Low (E2–D3) | 56–100 % | 5–20 ms |

The judge adds a limit: a note's window is half the gap to its neighbour, so
below 80 ms between notes (sixteenths above ~188 BPM) the window is narrower
than the ±40 ms on-time zone and early/late cannot be told apart.

The Rhythm screen therefore uses the exercise's shortest gap between played
notes (`Exercise::min_note_gap_beats`, converted with the tempo):

- **< 100 ms** (`FAST_NOTE_GAP_MS`, e.g. sixteenths above 150 BPM): amber
  "Fast notes: results are less reliable", advising higher, clearly picked
  notes or a lower tempo.
- **< 80 ms** (`MIN_JUDGEABLE_GAP_MS`): red "Too fast to judge early or
  late"; results mostly show hit or missed.

The warning updates live with the tempo slider, and the analysis repeats it
as a tip. A collapsible **Tips for accurate results** box recommends playing
higher notes (G/B/high E string or above the 5th fret on guitar, above middle
C on keys), picking clearly and muting between notes, calibrating with the
same kind of note, and headphones with a microphone. The "many notes missed"
tip also suggests higher notes.

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
