import { useState } from "react";

import { ChoiceButtons } from "@/components/choice-buttons";
import {
  type Direction,
  type ExampleRequest,
  INTERVAL_NAMES,
  type IntervalName,
  type Letter,
  type NoteName,
  type Pitch,
} from "@/lib/engine";
import { INTERVAL_LABELS, pitchLabel } from "@/lib/pitch-labels";

import { ExampleStaff } from "./example-staff";
import { ExplorerInstrument } from "./explorer-instrument";
import { KindSelect } from "./kind-select";
import { ListenButton } from "./listen-button";
import { RootSelect } from "./root-select";
import { note, pitchNote } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";
import { useTheoryExample } from "./use-theory-example";

/** Half steps, the interval up from C, and a well-known tune that starts with it. */
const INTERVAL_FACTS: Record<IntervalName, { halfSteps: number; fromC: string; tune: string }> = {
  minorSecond: { halfSteps: 1, fromC: "C–D♭", tune: "Jaws (theme)" },
  majorSecond: { halfSteps: 2, fromC: "C–D", tune: "Happy Birthday (\"-py birth-\")" },
  minorThird: { halfSteps: 3, fromC: "C–E♭", tune: "Greensleeves (\"A-las\")" },
  majorThird: { halfSteps: 4, fromC: "C–E", tune: "When the Saints Go Marching In (\"Oh when\")" },
  perfectFourth: { halfSteps: 5, fromC: "C–F", tune: "Here Comes the Bride" },
  tritone: { halfSteps: 6, fromC: "C–F♯", tune: "The Simpsons (theme)" },
  perfectFifth: { halfSteps: 7, fromC: "C–G", tune: "Twinkle, Twinkle, Little Star" },
  minorSixth: { halfSteps: 8, fromC: "C–A♭", tune: "The Entertainer (3rd to 4th note)" },
  majorSixth: { halfSteps: 9, fromC: "C–A", tune: "My Bonnie Lies over the Ocean (\"My Bon-\")" },
  minorSeventh: { halfSteps: 10, fromC: "C–B♭", tune: "Somewhere, West Side Story (\"There's a\")" },
  majorSeventh: { halfSteps: 11, fromC: "C–B", tune: "Take On Me (chorus, \"Take on\")" },
  octave: { halfSteps: 12, fromC: "C–C", tune: "Somewhere over the Rainbow (\"Some-where\")" },
};

const DIRECTIONS = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
] as const satisfies readonly { id: Direction; label: string }[];

const LETTERS: Letter[] = ["c", "d", "e", "f", "g", "a", "b"];

/** The letters from `from`, `steps` letters up (or down): C, 2 → C D E. */
function lettersFrom(from: Pitch, steps: number): string {
  const start = LETTERS.indexOf(from.letter);
  const sign = steps < 0 ? -1 : 1;
  return Array.from({ length: Math.abs(steps) + 1 }, (_, i) =>
    LETTERS[(start + sign * i + 70) % 7].toUpperCase(),
  ).join(" ");
}

function IntervalExplorer() {
  const [interval, setIntervalName] = useState<IntervalName>("majorThird");
  const [direction, setDirection] = useState<Direction>("up");
  const [root, setRoot] = useState<NoteName>({ letter: "c", accidental: 0 });
  const request: ExampleRequest = { kind: "interval", interval, direction, root };
  const { example, error } = useTheoryExample(request);
  const name = INTERVAL_LABELS[interval].name;
  const article = /^[aeiou]/i.test(name) ? "an" : "a";

  const [first, second] = example?.notes ?? [];
  return (
    <TheoryCard
      title="Try any interval"
      description="Pick an interval and a start note to see it written for your instrument and hear it."
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <KindSelect
          label="Interval"
          value={interval}
          options={INTERVAL_NAMES}
          optionLabel={(i) => `${INTERVAL_LABELS[i].name} (${INTERVAL_LABELS[i].short})`}
          onChange={setIntervalName}
        />
        <ChoiceButtons label="Direction" options={DIRECTIONS} value={direction} onChange={setDirection} />
        <RootSelect label="Start note" value={root} onChange={setRoot} />
      </div>
      {example && first && second && (
        <>
          <ExampleStaff
            label={`${name} ${direction} from ${pitchLabel(first.written)}: ${pitchLabel(second.written)}.`}
            score={{
              clef: example.clef,
              bars: [example.notes.map((n) => pitchNote(n.written, [pitchLabel(n.written)]))],
            }}
          />
          <p>
            {pitchLabel(first.written, false)} {direction} {article} {name.toLowerCase()} is{" "}
            <strong>{pitchLabel(second.written, false)}</strong>:{" "}
            {Math.abs(second.steps) + 1} letters ({lettersFrom(first.written, second.steps)}) and{" "}
            {Math.abs(second.semitones)} half steps.
          </p>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ListenButton request={request} />
      <ExplorerInstrument />
    </TheoryCard>
  );
}

/** Intervals: number, quality, spelling and direction. */
export function IntervalsTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["intervals", "ear", "reading"]}>
        An interval is the distance between two notes. Its name has two parts, a number and a
        quality: a <em>major third</em>, a <em>perfect fifth</em>.
      </PractiseIn>

      <TheoryCard title="The number: count the letters">
        <p>
          Count the letters from the first note to the second, counting both: C to E is C D E,
          three letters, so a <strong>3rd</strong>. C to G is a 5th. The same note again is a
          unison (a repeated note), eight letters an octave.
        </p>
        <p>On the staff you can see the number without naming the notes:</p>
        <Bullets>
          <li>2nd: from a line to the next space (or a space to the next line), a step.</li>
          <li>3rd: line to the next line, or space to the next space, skipping one.</li>
          <li>4th: line to space, skipping two. 5th: line to line, skipping one line.</li>
          <li>Octave: line to space, or space to line, eight letters up.</li>
        </Bullets>
        <ExampleStaff
          label="From G: a 2nd up is A, a 3rd B, a 4th C, a 5th D, an octave G."
          score={{
            clef: "treble",
            bars: [
              [note("G4", "G"), note("A4", "2nd")],
              [note("G4", "G"), note("B4", "3rd")],
              [note("G4", "G"), note("C5", "4th")],
              [note("G4", "G"), note("D5", "5th")],
              [note("G4", "G"), note("G5", "Octave")],
            ],
          }}
        />
        <InTheApp>
          <p>
            Reading counts the intervals between neighbouring notes this way (2nd, 3rd …), because
            the melody stays in its scale and the scale decides whether a 3rd is major or minor.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="The quality: count the half steps">
        <p>
          Two intervals with the same number can differ by a half step: C–E is 4 half steps, C–E♭
          only 3. The quality tells them apart:
        </p>
        <Bullets>
          <li>
            Unisons, 4ths, 5ths and octaves are <strong>perfect</strong>.
          </li>
          <li>
            2nds, 3rds, 6ths and 7ths are <strong>major</strong> or, a half step smaller,{" "}
            <strong>minor</strong>.
          </li>
          <li>
            A half step larger than perfect or major is <strong>augmented</strong>; a half step
            smaller than perfect or minor is <strong>diminished</strong>.
          </li>
          <li>
            The <strong>tritone</strong> (6 half steps, three whole steps) is an augmented 4th (C–F♯)
            or a diminished 5th (C–G♭). The app writes it as an augmented 4th.
          </li>
        </Bullets>
        <TheoryTable
          head={["Interval", "Short", "Half steps", "From C", "Sounds like (going up)"]}
          rows={INTERVAL_NAMES.map((i) => [
            INTERVAL_LABELS[i].name,
            INTERVAL_LABELS[i].short,
            INTERVAL_FACTS[i].halfSteps,
            INTERVAL_FACTS[i].fromC,
            <span className="text-muted-foreground">{INTERVAL_FACTS[i].tune}</span>,
          ])}
        />
      </TheoryCard>

      <TheoryCard title="Spelling an interval">
        <p>
          First count the letters, then fix the half steps with a sharp or flat. Never the other
          way round: the letter comes from the number.
        </p>
        <Bullets>
          <li>
            E♭ up a major 3rd: three letters from E is G (E F G). E♭ to G is 4 half steps, a major
            3rd already: <strong>G</strong>.
          </li>
          <li>
            C♯ down a minor 6th: six letters down from C is E (C B A G F E). E up to C♯ is 9 half
            steps, one too many for a minor 6th (8), so raise the E: <strong>E♯</strong>.
          </li>
        </Bullets>
        <p>
          That is why intervals sometimes need notes like E♯ or B♯: with another letter the
          interval would have the wrong number.
        </p>
      </TheoryCard>

      <TheoryCard title="Up and down">
        <p>
          An interval down is the same distance measured downwards: a perfect 5th down from C is
          F. A shortcut: an interval and its <strong>inversion</strong> (the same two notes, the
          lower one moved up an octave) add up to 9 and swap major and minor. So a major 6th down
          is a minor 3rd up, then an octave down. Perfect stays perfect: a 5th down is a 4th up,
          then an octave down.
        </p>
        <InTheApp>
          <p>
            In Intervals, play the shown note, then the note at the named interval from it, in any
            octave. Choose Up, Down or both; <strong>Show both notes</strong> turns building
            intervals into reading them.
          </p>
        </InTheApp>
      </TheoryCard>

      <IntervalExplorer />
    </div>
  );
}
