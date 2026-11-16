import type { ExampleRequest, NoteName } from "@/lib/engine";

import { ListenButton } from "./listen-button";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";

const C: NoteName = { letter: "c", accidental: 0 };

/** Pairs of sounds that are worth hearing side by side. */
const PAIRS: { listenFor: string; a: [string, ExampleRequest]; b: [string, ExampleRequest] }[] = [
  {
    listenFor: "Steps move to the next note of the scale; leaps jump over notes.",
    a: ["Steps: C major scale", { kind: "scale", scale: "major", root: C, upAndDown: false }],
    b: ["Leaps: C major arpeggio", { kind: "chord", chord: "major", root: C, inversion: 0 }],
  },
  {
    listenFor: "A major 3rd sounds bright, a minor 3rd darker.",
    a: ["Major 3rd", { kind: "interval", interval: "majorThird", direction: "up", root: C }],
    b: ["Minor 3rd", { kind: "interval", interval: "minorThird", direction: "up", root: C }],
  },
  {
    listenFor: "A perfect 5th sounds open and stable, the tritone tense, wanting to move on.",
    a: ["Perfect 5th", { kind: "interval", interval: "perfectFifth", direction: "up", root: C }],
    b: ["Tritone", { kind: "interval", interval: "tritone", direction: "up", root: C }],
  },
  {
    listenFor: "Major and minor scales differ in the 3rd, 6th and 7th; the 3rd decides first.",
    a: ["C major scale", { kind: "scale", scale: "major", root: C, upAndDown: false }],
    b: ["C minor scale", { kind: "scale", scale: "naturalMinor", root: C, upAndDown: false }],
  },
  {
    listenFor: "The same difference in a chord: the middle note is a half step lower in minor.",
    a: ["C major arpeggio", { kind: "chord", chord: "major", root: C, inversion: 0 }],
    b: ["C minor arpeggio", { kind: "chord", chord: "minor", root: C, inversion: 0 }],
  },
];

/** Ear training: how to find notes and melodies you hear. */
export function EarTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn tabs={["Ear training", "Intervals"]}>
        Ear training links what you hear to notes on your instrument: you hear a note or a short
        melody and play it back.
      </PractiseIn>

      <TheoryCard title="Pitch matching: one note">
        <Bullets>
          <li>Sing or hum the note right after you hear it: your voice holds it while you search.</li>
          <li>
            Play any note and ask: is the target <strong>higher or lower</strong>? Move towards it,
            in big jumps first, then by half steps.
          </li>
          <li>
            Close to the right note you hear a slow wobble (beating) between the two sounds; on the
            note it disappears.
          </li>
          <li>Notes an octave apart sound alike. Check the octave last.</li>
        </Bullets>
      </TheoryCard>

      <TheoryCard title="Melodic dictation: several notes">
        <p>Listen for one thing at a time:</p>
        <Bullets>
          <li>
            <strong>Shape</strong>: does each note go up, down or stay the same?
          </li>
          <li>
            <strong>Steps or leaps</strong>: the next note of the scale, or a jump? Leaps are often
            notes of a chord.
          </li>
          <li>
            <strong>The first note</strong>: find it like a single note, then work out the rest
            from it, interval by interval.
          </li>
          <li>
            <strong>The key</strong>: in a major key, the tonic (1) sounds like home and the 7th
            pulls up to it. Hearing which degree a note is helps more than its interval from the
            note before.
          </li>
          <li>Sing the melody back before you play it, and split long melodies into short groups.</li>
        </Bullets>
        <InTheApp>
          <p>
            In Ear training, "Notes from a major key" keeps melodies inside the key named in the
            task (each note in it is one of the key's seven); "Any notes" uses all twelve, which is
            much harder. "Show the first note" gives you the start; "Any octave" accepts the melody
            an octave up or down. Play again repeats the notes.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard
        title="Hear the difference"
        description="Each sound plays the way your instrument would sound it. Listen to both, then try to sing them."
      >
        <TheoryTable
          head={["Listen for", "", ""]}
          rows={PAIRS.map((p) => [
            p.listenFor,
            <ListenButton request={p.a[1]} label={p.a[0]} />,
            <ListenButton request={p.b[1]} label={p.b[0]} />,
          ])}
        />
        <p className="text-muted-foreground">
          The Intervals topic lists a well-known tune for every interval, and lets you hear any
          interval from any note.
        </p>
      </TheoryCard>
    </div>
  );
}
