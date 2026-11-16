# Theory

The music theory behind every Practice exercise (ADR 0013), in the main menu
under Practice. Its topics are listed under it in the menu when Theory is
selected (ADR 0014); it opens on the topic last shown. Each topic explains
its concepts with text, tables and examples in notation, ends its cards with
"In the app" notes on how Practice uses the concept, and starts with links
to the Practice pages that exercise it ("Practise it in Practice: Intervals,
Ear training"). New topics are added through the `THEORY_TOPICS` registry,
see [CODING_RULES.md](../CODING_RULES.md).

## Topics

| Topic | Covers | Practised in |
| --- | --- | --- |
| Notes | Note names, the keyboard, the staff, treble/bass/alto clefs (with mnemonics), ledger lines, middle C, octave numbers and A4 = 440 Hz, half and whole steps, sharps/flats/naturals/doubles, enharmonic notes, written vs sounding pitch per instrument | Notes, Reading |
| Rhythm | Beat, tempo (BPM), count-in, bars, 2/4 3/4 4/4, note values, rests, dotted notes, beams and counting (1 e & a), playing in time (rushing, dragging, how timing is judged) | Rhythm, Reading |
| Intervals | Number (counting letters, seeing it on the staff), quality (perfect, major, minor, augmented, diminished, tritone), a table with half steps, the interval from C and a well-known tune for each, spelling, intervals down and inversion; **interval explorer** | Intervals, Ear training, Reading |
| Scales | Degrees and their names, the major scale (W W H W W W H, one letter per degree), natural/harmonic/melodic minor, relative and parallel minor, pentatonic scales, the seven modes; **scale explorer** | Scales, Reading, Ear training |
| Keys | Key signatures, order of sharps and flats, naming the key, relative minor, a circle-of-fifths diagram, all 15 key signatures (treble, bass or alto clef), modes' and minors' signatures, accidentals in a bar | Reading, Ear training |
| Chords | Triads and their qualities, seventh chords, chord symbols (incl. slash chords), inversions, arpeggios, chords in a major key (I ii iii IV V vi vii°); **chord explorer** | Chords |
| Sight reading | What to check before playing, reading by steps and leaps (example melody with its intervals), keeping going, a practice order for Reading | Reading |
| Ear training | Pitch matching, melodic dictation (shape, steps or leaps, first note, key), "Hear the difference" pairs with Listen buttons | Ear training, Intervals |

## Explorers

Intervals, Scales and Chords end with a card to try any example:

| Explorer | Choices | Shows |
| --- | --- | --- |
| Interval | Any of the 12 intervals, up or down, start note | Both notes, "C up a major 3rd is E: 3 letters (C D E) and 4 half steps" |
| Scale | Any of the 11 scales and modes, root, up and down | Notes with names and degrees (1 2 ♭3 …), the steps between them (W, H, W+H; half steps highlighted), the degree formula and the key signature it is written with |
| Chord | Any of the 9 chords, inversion (root position … 3rd for seventh chords), root | The notes one by one with names and degrees, then stacked with the chord symbol (C/E for inversions), which tone is lowest |

- Roots: C, C♯, D♭, D, D♯, E♭, E, F, F♯, G♭, G, G♯, A♭, A, A♯, B♭, B.
- Examples are spelled by the engine (`theory::spell_example`) and written
  for the saved instrument (clef, range, transposition; the card has the
  same instrument select as the note exercises and changes it for them too).
  The octave is chosen to stay in the instrument's range with the fewest
  ledger lines.
- Unlike Practice, double sharps and flats are shown (G♯ major has F𝄪, C
  diminished 7th has B𝄫), with a note that Practice skips such roots. A key
  beyond seven sharps or flats is named as such.
- Choices are not saved.

## Listen

**Listen** (explorers and "Hear the difference") plays the example's notes
one after another, 0.6 s each, as soft tones on the default output device, at
the pitch the instrument would sound (guitar an octave below the written
note). Chords are played as arpeggios. Pressing again starts over; another
example replaces the one playing.

- Needs only an output device; no input device and nothing is judged.
- Refused with a message while an exercise or calibration runs ("Stop the
  exercise that is running first."). Starting an exercise stops an example
  still playing.
- If the output cannot be opened, the message under the button says so and
  asks to check speakers or headphones and the default output device.

## Notation

Drawn with VexFlow (ADR 0007) by `features/theory/render-example.ts`: any
clef or percussion (rhythm examples: notes on the middle line, stems up), key
and time signatures, chords, rests, dots, beams per beat, one or more lines
of text under each note (aligned in a row), a final bar line when asked.
Bars wrap onto new lines (clef and key repeated) when the window is narrow;
lines that wrapped fill the width. Examples without a time signature space
their notes evenly. Staff lines are faded and labels muted (`.theory-staff`
in `src/index.css`), and everything follows the light/dark theme. The piano
keyboard and circle of fifths are inline SVG.
