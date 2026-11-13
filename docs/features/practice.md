# Practice

Practice has subsections, shown as tabs: **Rhythm** (timing) and the pitch
exercises: **Notes**, **Intervals**, **Scales** and **Chords**. More are
added through the `PRACTICE_SECTIONS` registry, see
[CODING_RULES.md](../CODING_RULES.md); ideas are listed in
[exercise-catalog.md](exercise-catalog.md).

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

## Pitch exercises (ADR 0011)

In these exercises *which* note you play matters, not when. Each tab has its
options and a **Read and play**-style card; they share how tasks are shown,
judged and scored.

### Instrument (saved, shared by every pitch exercise)

Notation is written for the instrument and judged on what sounds:

| Instrument | Clef | Sounds | Range used (written) |
| --- | --- | --- | --- |
| Guitar | treble | an octave lower | E3–C6 (open low E to 8th fret on the high E) |
| Bass guitar | bass | an octave lower | E2–D4 (open E to 7th fret on the G string) |
| Keyboard (treble clef) | treble | as written | C4–C6 |
| Keyboard (bass clef) | bass | as written | C2–C4 |
| Violin | treble | as written | G3–B5 (first position) |
| Viola | alto | as written | C3–D5 (first position) |
| Cello | bass | as written | C2–D4 (first position) |
| Double bass | bass | an octave lower | E2–D4 |

Note names on screen (what you played, wrong notes) are written pitches for
the instrument, spelled like the task's note of the same name (B♭, not A♯,
when the staff shows B♭), otherwise with sharps.

### A session

1. **Start** generates the first task (options are locked while it runs).
   The task is shown as whole notes on one staff; notes you must work out
   yourself stay hidden until played.
2. Play the notes in order and hold each one briefly. A note turns green
   once it has been heard steadily for 80 ms. A wrong note held for 250 ms
   is named ("Not quite: that was D♯4. Try again.") and counted; the task
   waits for the right note.
3. Once every note is played: **Correct!**, and 1.2 s later the next task.
4. **Hear it** plays the task's notes (soft tones, 0.7 s each) on the
   default output and restarts the task; judging resumes 0.3 s after the
   last tone so a microphone hearing the speakers is not judged.
   **Skip** shows the answer in amber for 3 s, then moves on.
5. **Stop** ends the session and shows the score. Leaving the tab (or the
   Practice screen) stops it too.

The live line shows the note being heard ("Hearing G♯3"). The score counts
tasks solved, solved without a wrong note ("first try"), skipped, and wrong
notes.

Judging rules (`theory::NoteJudge`): the last correct note heard again (or
its octave, usually its harmonic while it rings) is ignored; a note already
sounding when a task starts is ignored until it stops or changes; tasks
never repeat the previous note. Needs a running input device; calibration,
rhythm practice and pitch exercises cannot run at the same time.

## Notes (note reading)

A single note appears on the staff; play it. Covers note-name, piano-key,
fretboard and fingerboard reading drills for every instrument above.

| Option (saved) | Effect | Default |
| --- | --- | --- |
| Ledger lines | Notes above and below the staff, up to the instrument's range. Off: the staff plus the spaces just below and above it | off |
| Sharps and flats | Also sharps and flats (never E♯, B♯, C♭, F♭) | off |
| Any octave | Accept the note name in any octave | off |

The next note is never the same note name as the previous one.

## Intervals

A note is shown with an interval name, e.g. **Major 3rd up**: play the note,
then the note at that interval from it. The second note is hidden until it
is played (unless **Show both notes** is on). Any octave is accepted as long
as the second note is the right distance from the first
(`Matching::AnyOctave`).

| Option (saved) | Effect | Default |
| --- | --- | --- |
| Intervals | Any of minor 2nd … octave, including the tritone (spelled as an augmented 4th) | M2, m3, M3, P4, P5, octave |
| Direction | Up, down or both | up |
| Show both notes | The second note is shown too: interval reading instead of building | off |

Generation (`theory::interval`): each selected interval (and direction)
comes up equally often; the start note is any natural, sharp or flat in the
instrument's range (with ledger lines). The second note is spelled by the
interval (E♭ + major 3rd = G, C♯ − minor 6th = E♯), never with a double
sharp or flat, and must be in range too. A task never starts on the
previous task's last note, and the same task is not asked twice in a row.
With nothing selected, Start is disabled and the card says so.

## Scales

A scale is named with its root, e.g. **E♭ major, up**, and only the root is
shown (unless **Show the notes** is on). Play the scale note by note from
the root to its octave, and back down with **Up and down**. Any octave is
accepted for the root; the rest must follow in that octave
(`Matching::AnyOctave`). Each note appears on the staff as it is played.

| Option (saved) | Effect | Default |
| --- | --- | --- |
| Scales and modes | Major, natural/harmonic/melodic minor, major/minor pentatonic, Dorian, Phrygian, Lydian, Mixolydian, Locrian | major, natural minor |
| Up and down | Up to the octave, then back down to the root | off |
| Show the notes | Every note is shown: scale reading instead of building | off |

Generation (`theory::scale`): each selected scale comes up equally often;
the root is any natural, sharp or flat (never E♯, B♯, C♭, F♭) whose whole
scale fits the instrument's range. Notes are spelled by degree, one letter
per degree (F♯ major has E♯, E♭ major has A♭), and roots whose scale would
need a double sharp or flat (G♯ major) are not used. Melodic minor comes
back down as natural minor. A task never starts on the previous task's last
note, and the same scale is not asked twice in a row. The staff shrinks
(down to normal size) so a 15-note scale fits on one line.

## Chords

A chord is named, e.g. **A minor 7th (Am7), 2nd inversion**: play its notes
one at a time from the lowest up (an arpeggio, since pitch detection hears
one note at a time). Root position starts on the root, 1st inversion on the
3rd, 2nd on the 5th, 3rd on the 7th. No note is shown until played (unless
**Show the notes** is on); any octave is accepted for the first note, the
others must go up from it (`Matching::AnyOctave`).

| Option (saved) | Effect | Default |
| --- | --- | --- |
| Chords | Major, minor, diminished, augmented, dominant 7th, major 7th, minor 7th, half-diminished 7th, diminished 7th | major, minor |
| Inversions | Every inversion as well as root position | off |
| Show the notes | Every note is shown: chord reading instead of building | off |

Generation (`theory::chord`): each selected chord comes up equally often,
then each of its positions; the root is any natural, sharp or flat whose
chord fits the instrument's range. Notes are spelled in thirds from the
root (C augmented has G♯, B diminished 7th has A♭); chords that would need
a double sharp or flat (C diminished 7th: B𝄫) are not used. A task never
starts on the previous task's last note, and the same chord and position
are not asked twice in a row.
