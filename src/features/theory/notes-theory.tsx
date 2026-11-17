import { ExampleStaff } from "./example-staff";
import { KeyboardDiagram } from "./keyboard-diagram";
import { note } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";

const CLEFS = [
  {
    clef: "treble",
    name: "Treble clef (G clef)",
    curl: "Its curl circles the second line from the bottom: that line is G above middle C (G4).",
    lines: ["E4", "G4", "B4", "D5", "F5"],
    spaces: ["F4", "A4", "C5", "E5"],
    remember: "Lines: Every Good Boy Does Fine. Spaces spell FACE.",
    used: "Guitar, violin, keyboard right hand.",
  },
  {
    clef: "bass",
    name: "Bass clef (F clef)",
    curl: "Its two dots sit either side of the fourth line from the bottom: that line is F below middle C (F3).",
    lines: ["G2", "B2", "D3", "F3", "A3"],
    spaces: ["A2", "C3", "E3", "G3"],
    remember: "Lines: Good Boys Do Fine Always. Spaces: All Cows Eat Grass.",
    used: "Bass guitar, cello, double bass, keyboard left hand.",
  },
  {
    clef: "alto",
    name: "Alto clef (C clef)",
    curl: "Its centre points at the middle line: that line is middle C (C4).",
    lines: ["F3", "A3", "C4", "E4", "G4"],
    spaces: ["G3", "B3", "D4", "F4"],
    remember: "Lines: F A C E G. Spaces: G B D F.",
    used: "Viola.",
  },
] as const;

const letter = (name: string) => name[0];

/** Notes and the staff: names, clefs, octaves, steps and accidentals. */
export function NotesTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["notes", "reading"]}>
        How notes are named and written down: the staff and its clefs, octaves, half and whole
        steps, sharps and flats, and why some instruments sound lower than written.
      </PractiseIn>

      <TheoryCard title="Note names">
        <p>
          Music uses seven letters, <strong>A B C D E F G</strong>. After G the letters start again
          at A, one <strong>octave</strong> higher: the same note name, higher in pitch. Going up the
          letters, the sound goes up.
        </p>
        <p>
          On a keyboard the white keys are these seven <strong>natural</strong> notes. C is always
          the white key just left of a group of two black keys. The black keys sit between them and
          take their names from their neighbours (C♯ or D♭), see below.
        </p>
        <KeyboardDiagram />
      </TheoryCard>

      <TheoryCard title="The staff and clefs">
        <p>
          Notes are written on a <strong>staff</strong> of five lines and four spaces. Every line
          and every space is one letter: going from a line to the space just above it is the next
          letter. The higher a note sits, the higher it sounds.
        </p>
        <p>
          The <strong>clef</strong> at the start of the staff says which line is which note.
          Everything else follows by counting letters up or down from it.
        </p>
        {CLEFS.map((c) => (
          <div key={c.clef} className="flex flex-col gap-2 border-t pt-4">
            <p>
              <strong>{c.name}.</strong> {c.curl} {c.used}
            </p>
            <ExampleStaff
              label={`${c.name}: the lines are ${c.lines.join(", ")}; the spaces are ${c.spaces.join(", ")}.`}
              score={{
                clef: c.clef,
                bars: [
                  c.lines.map((n, i) => note(n, i === 0 ? [letter(n), "lines"] : letter(n))),
                  c.spaces.map((n, i) => note(n, i === 0 ? [letter(n), "spaces"] : letter(n))),
                ],
              }}
            />
            <p className="text-muted-foreground">{c.remember}</p>
          </div>
        ))}
      </TheoryCard>

      <TheoryCard title="Ledger lines and middle C">
        <p>
          Notes above or below the staff get short extra lines of their own,{" "}
          <strong>ledger lines</strong>. Read them the same way: count letters line, space, line
          from the staff outwards.
        </p>
        <ExampleStaff
          label="Treble clef with ledger lines: A3, B3 and C4 below the staff, A5, B5 and C6 above it."
          score={{
            clef: "treble",
            bars: [
              [note("A3", "A3"), note("B3", "B3"), note("C4", "C4")],
              [note("A5", "A5"), note("B5", "B5"), note("C6", "C6")],
            ],
          }}
        />
        <p>
          <strong>Middle C</strong> (C4) sits between the treble and bass staffs: one ledger line
          below the treble staff, one above the bass staff, and on the middle line of the alto clef.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["treble", "Treble clef"],
              ["bass", "Bass clef"],
              ["alto", "Alto clef"],
            ] as const
          ).map(([clef, name]) => (
            <div key={clef} className="flex flex-col items-center gap-1">
              <ExampleStaff
                label={`Middle C in the ${name.toLowerCase()}.`}
                score={{ clef, bars: [[note("C4", "C4")]] }}
              />
              <span className="text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
        <InTheApp>
          <p>
            The <strong>Ledger lines</strong> option in Notes and Reading adds notes above and below
            the staff, up to the range of your instrument. Without it, notes stay on the staff and
            the spaces just above and below it.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Octaves and note numbers">
        <p>
          A number after the letter says which octave a note is in (scientific pitch notation):
          middle C is <strong>C4</strong>. The number goes up at every C, so B3 is just below C4.
        </p>
        <p>
          Each octave up doubles the frequency. The tuning reference is <strong>A4 = 440 Hz</strong>
          , the same the Tuner uses; A3 is 220 Hz and A5 880 Hz. A guitar's low E string is E2.
        </p>
        <ExampleStaff
          label="A3 at 220 Hz, A4 at 440 Hz and A5 at 880 Hz."
          score={{
            clef: "treble",
            bars: [
              [
                note("A3", ["A3", "220 Hz"]),
                note("A4", ["A4", "440 Hz"]),
                note("A5", ["A5", "880 Hz"]),
              ],
            ],
          }}
        />
      </TheoryCard>

      <TheoryCard title="Half steps and whole steps">
        <p>
          A <strong>half step</strong> (semitone) is the smallest distance in Western music: from
          one key to the very next key on a keyboard, black or white, or one fret on a guitar. A{" "}
          <strong>whole step</strong> (tone) is two half steps. Twelve half steps make an octave.
        </p>
        <p>
          Between the natural notes there is a black key everywhere except between{" "}
          <strong>E and F</strong> and between <strong>B and C</strong>: those two pairs are only a
          half step apart. All other neighbouring letters are a whole step apart.
        </p>
        <KeyboardDiagram steps />
      </TheoryCard>

      <TheoryCard title="Sharps, flats and naturals">
        <Bullets>
          <li>
            A <strong>sharp</strong> (♯) raises a note by a half step; a <strong>flat</strong> (♭)
            lowers it by a half step.
          </li>
          <li>
            A <strong>natural</strong> (♮) cancels a sharp or flat: the plain letter again.
          </li>
          <li>
            A <strong>double sharp</strong> (𝄪) or <strong>double flat</strong> (𝄫) moves a note by
            two half steps. They are rare, but some keys and chords need them.
          </li>
          <li>
            The sign is written before the note on the staff but said after it: "F sharp". In the
            music, a sign lasts until the end of the bar.
          </li>
        </Bullets>
        <ExampleStaff
          label="F and F sharp; B, B flat and B natural; F double sharp and B double flat."
          score={{
            clef: "treble",
            bars: [
              [note("F4", "F"), note("F#4", "F♯")],
              [note("B4", "B"), note("Bb4", "B♭"), note("Bn4", "B♮")],
              [note("F##4", "F𝄪"), note("Bbb4", "B𝄫")],
            ],
          }}
        />
        <p>
          Two names for the same key are <strong>enharmonic</strong>: C♯ and D♭ sound the same. Even
          E♯ is F and C♭ is B, because E–F and B–C are only a half step apart. Which name is right
          depends on the music around it: a scale uses every letter once, so F major has B♭, never
          A♯.
        </p>
        <ExampleStaff
          label="Enharmonic pairs: C sharp and D flat, F sharp and G flat, E sharp and F, C flat and B."
          score={{
            clef: "treble",
            bars: [
              [note("C#4", "C♯"), note("Db4", "D♭")],
              [note("F#4", "F♯"), note("Gb4", "G♭")],
              [note("E#4", "E♯"), note("F4", "F")],
              [note("Cb5", "C♭"), note("B4", "B")],
            ],
          }}
        />
        <InTheApp>
          <p>
            With <strong>Sharps and flats</strong> on, Notes also shows sharps and flats, but never
            E♯, B♯, C♭ or F♭. Notes you play are named the way the staff spells them: if it shows
            B♭, playing that key is called B♭, not A♯.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Written and sounding pitch">
        <p>
          Some instruments sound lower than their music is written, so that it fits on the staff
          without many ledger lines. Guitar, bass guitar and double bass sound an{" "}
          <strong>octave lower</strong> than written. That is why the Tuner calls a guitar's low
          string E2 while guitar music writes it as E3.
        </p>
        <TheoryTable
          head={["Instrument", "Clef", "Sounds", "Range in the exercises (written)"]}
          rows={[
            ["Guitar", "Treble", "An octave lower", "E3–C6: open low E to the 8th fret on high E"],
            ["Bass guitar", "Bass", "An octave lower", "E2–D4: open E to the 7th fret on G"],
            ["Keyboard (treble clef)", "Treble", "As written", "C4–C6"],
            ["Keyboard (bass clef)", "Bass", "As written", "C2–C4"],
            ["Violin", "Treble", "As written", "G3–B5, first position"],
            ["Viola", "Alto", "As written", "C3–D5, first position"],
            ["Cello", "Bass", "As written", "C2–D4, first position"],
            ["Double bass", "Bass", "An octave lower", "E2–D4"],
          ]}
        />
        <InTheApp>
          <p>
            Choose your instrument in the top bar; every section uses it. Exercises and
            examples show notes as written for it, and exercises judge what it sounds, so you read
            the music the way your instrument's music is printed.
          </p>
        </InTheApp>
      </TheoryCard>
    </div>
  );
}
