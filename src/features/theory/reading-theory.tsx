import { ExampleStaff } from "./example-staff";
import { note } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";

/** Sight reading: how to read a melody you have not seen before. */
export function ReadingTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["reading"]}>
        Sight reading is playing music you have never seen before, straight from the page. It
        brings everything together: notes, key, rhythm and intervals.
      </PractiseIn>

      <TheoryCard title="Before you play">
        <p>Take a few seconds to look the music over. Check, in this order:</p>
        <Bullets>
          <li>
            <strong>Clef</strong>: which notes the lines and spaces are.
          </li>
          <li>
            <strong>Key signature</strong>: which notes are sharp or flat everywhere, and which key
            that is.
          </li>
          <li>
            <strong>Time signature and tempo</strong>: how to count, and how fast.
          </li>
          <li>
            <strong>Range</strong>: the highest and lowest notes, so you know where to place your
            hand.
          </li>
          <li>
            <strong>Hard spots</strong>: accidentals, big leaps, dotted notes, rests and short
            notes. Tap or count the rhythm of those bars first.
          </li>
        </Bullets>
      </TheoryCard>

      <TheoryCard title="Read by steps and leaps">
        <p>
          Don't name every note. Read each one from the one before: the same line or space is a
          repeated note, the next line or space a <strong>step</strong> (a 2nd), anything further
          a <strong>leap</strong>. Count leaps by lines and spaces: line to the next line is a 3rd,
          line to the line after that a 5th.
        </p>
        <ExampleStaff
          label="A melody in G major with the interval between neighbouring notes written under each note."
          score={{
            clef: "treble",
            key: "G",
            time: "4/4",
            end: true,
            bars: [
              [
                note("G4", ["G", "start"], "q"),
                note("A4", ["↑ 2nd"], "q"),
                note("B4", ["↑ 2nd"], "q"),
                note("G4", ["↓ 3rd"], "q"),
              ],
              [note("D5", ["↑ 5th"], "q"), note("B4", ["↓ 3rd"], "q"), note("A4", ["↓ 2nd"], "h")],
              [
                note("B4", ["↑ 2nd"], "q"),
                note("C5", ["↑ 2nd"], "q"),
                note("D5", ["↑ 2nd"], "q"),
                note("B4", ["↓ 3rd"], "q"),
              ],
              [note("G4", ["↓ 3rd"], "w")],
            ],
          }}
        />
        <p>
          Melodies move mostly by step. Leaps often outline a chord (G B D above), and many
          melodies start and end on the tonic.
        </p>
        <InTheApp>
          <p>
            Reading builds melodies like this one: they start on the tonic, move by the intervals
            you choose, and end on the tonic when they can. Start with 2nds and 3rds, then add
            larger leaps.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Tab (guitar and bass guitar)">
        <p>
          <strong>Tab</strong> (tablature) shows <em>where</em> to play rather than which note:
          each line is a string, the highest string on top, and a number on a line is the fret to
          press on that string. <strong>0</strong> is the open string. Guitar tab has six lines,
          bass guitar tab four.
        </p>
        <TheoryTable
          head={["Tab line", "Guitar string", "Bass guitar string"]}
          rows={[
            ["1 (top)", "High E (sounds E4)", "G (sounds G2)"],
            ["2", "B (B3)", "D (D2)"],
            ["3", "G (G3)", "A (A1)"],
            ["4", "D (D3)", "Low E (E1)"],
            ["5", "A (A2)", "–"],
            ["6 (bottom)", "Low E (E2)", "–"],
          ]}
        />
        <p>
          The same note can often be played in more than one place: the open B string sounds the
          same as the 4th fret on the G string. Players choose by <strong>position</strong>: with
          the index finger on fret 1, the four fingers cover frets 1 to 4 (first position), and the
          hand moves up the neck only when the music goes higher.
        </p>
        <p>
          Tab on its own does not show rhythm or the key, and a number does not tell you the name
          of the note. Reading it under the notation lets you check where a note is while you learn
          to read the staff.
        </p>
        <InTheApp>
          <p>
            On guitar and bass guitar, Reading can show the tab under the notes (
            <strong>Show tab</strong>). The positions stay as low on the neck as the melody allows,
            use open strings where they fit, and move the hand as little as possible.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Keep going">
        <Bullets>
          <li>Keep your eyes a little ahead of the note you are playing.</li>
          <li>
            With a metronome, the beat does not wait: if you miss a note, leave it and come in again
            on the next one. Rhythm matters more than every pitch.
          </li>
          <li>Count rests and long notes all the way through.</li>
          <li>Choose a tempo slow enough to play without stopping.</li>
        </Bullets>
        <InTheApp>
          <p>
            A good order for each new melody: <strong>Listen</strong> to hear how it goes,{" "}
            <strong>At my own pace</strong> to get the notes right (the next note waits for
            you), then <strong>With metronome</strong>, which judges timing and pitch together.
          </p>
        </InTheApp>
      </TheoryCard>
    </div>
  );
}
