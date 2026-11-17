import { useState } from "react";

import { ChoiceButtons } from "@/components/choice-buttons";
import type { Clef } from "@/lib/engine";

import { CircleOfFifths } from "./circle-of-fifths";
import { ExampleStaff } from "./example-staff";
import { FLAT_ORDER, KEYS, type KeyInfo, SHARP_ORDER, keyAccidentals } from "./key-signatures";
import { note } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard } from "./topic-parts";

const CLEF_OPTIONS = [
  { id: "treble", label: "Treble" },
  { id: "bass", label: "Bass" },
  { id: "alto", label: "Alto" },
] as const satisfies readonly { id: Clef; label: string }[];

function KeyTile({ info, clef }: { info: KeyInfo; clef: Clef }) {
  const n = Math.abs(info.accidentals);
  const count =
    info.accidentals === 0
      ? "No sharps or flats"
      : `${n} ${info.accidentals > 0 ? "sharp" : "flat"}${n === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-col items-center gap-1 rounded-[10px] bg-inset p-2 text-center">
      <ExampleStaff
        className="p-0"
        label={`Key signature of ${info.major} major and ${info.minor} minor: ${keyAccidentals(info.accidentals)}.`}
        score={{ clef, key: info.spec, bars: [[]] }}
      />
      <span className="font-bold">
        {info.major} major · {info.minor} minor
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

/** Keys and key signatures. */
export function KeysTheory() {
  const [clef, setClef] = useState<Clef>("treble");
  const sharps = KEYS.filter((k) => k.accidentals >= 0);
  const flats = KEYS.filter((k) => k.accidentals < 0);

  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["reading", "ear"]}>
        A piece in a <em>key</em> uses the notes of one scale and comes home to its tonic: in D
        major, D is home and the notes come from the D major scale. The key signature shows which
        notes are sharp or flat.
      </PractiseIn>

      <TheoryCard title="Key signatures">
        <p>
          Instead of writing the same sharps or flats again and again, they are written once at the
          start of every line: the <strong>key signature</strong>. They count for every octave
          until the end of the piece. D major has F♯ and C♯, so with its key signature every F and
          every C is played sharp.
        </p>
        <p>Sharps and flats always appear in the same order, at the same places on the staff:</p>
        <Bullets>
          <li>
            Sharps: <strong>{SHARP_ORDER.join(" ")}</strong> (Father Charles Goes Down And Ends
            Battle).
          </li>
          <li>
            Flats: <strong>{FLAT_ORDER.join(" ")}</strong>, the same letters backwards (Battle Ends
            And Down Goes Charles' Father).
          </li>
        </Bullets>
      </TheoryCard>

      <TheoryCard title="Which key is it?">
        <Bullets>
          <li>
            <strong>Sharps</strong>: the last sharp is the 7th degree; the key is a half step above
            it. F♯ C♯: the last sharp is C♯, so D major.
          </li>
          <li>
            <strong>Flats</strong>: the second-to-last flat names the key. B♭ E♭ A♭: E♭ major. One
            flat (B♭) is F major.
          </li>
          <li>
            <strong>None</strong>: C major (or A minor).
          </li>
          <li>
            Every signature is also a <strong>minor</strong> key: the relative minor, three half
            steps below the major tonic (D major and B minor). The music tells which: a minor piece
            usually starts and ends on its tonic, and often raises its 7th (A♯ in B minor) with an
            accidental.
          </li>
        </Bullets>
      </TheoryCard>

      <TheoryCard title="The circle of fifths">
        <p>
          Going up a perfect 5th adds one sharp: C, G, D, A, E, B, F♯, C♯. Going down a perfect 5th
          adds one flat: C, F, B♭, E♭, A♭, D♭, G♭, C♭. Arranged in a circle, the two meet at the
          bottom, where keys like F♯ and G♭ major sound the same but are written differently.
        </p>
        <CircleOfFifths />
        <p>
          Neighbours on the circle share all but one note, which is why music often moves to the
          key next door.
        </p>
      </TheoryCard>

      <TheoryCard title="All key signatures">
        <ChoiceButtons label="Clef" options={CLEF_OPTIONS} value={clef} onChange={setClef} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {sharps.map((k) => (
            <KeyTile key={k.spec} info={k} clef={clef} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {flats.map((k) => (
            <KeyTile key={k.spec} info={k} clef={clef} />
          ))}
        </div>
      </TheoryCard>

      <TheoryCard title="Modes and minor scales">
        <p>
          A mode is written with the key signature of the major scale it comes from: D Dorian uses
          C major's notes, so it has no sharps or flats; E Dorian uses D major's, two sharps.
          Harmonic and melodic minor use the natural minor's signature, and their raised 6th and
          7th are written as accidentals.
        </p>
        <InTheApp>
          <p>
            Reading draws every melody with its key signature: choose the scales and how many sharps
            or flats a key may have. The line above the score names the key, for example "E Dorian".
            In Ear training, "a major key" melodies use only the notes of the key named in the task.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Accidentals in a key">
        <p>
          A sharp, flat or natural written in the music overrides the key signature for that note
          until the end of the bar. A <strong>natural</strong> cancels the key's sharp or flat; in
          the next bar the key signature counts again.
        </p>
        <ExampleStaff
          label="In G major: F sharp from the key, then F natural, F still natural in the same bar, and F sharp again in the next bar."
          score={{
            clef: "treble",
            key: "G",
            time: "4/4",
            end: true,
            bars: [
              [
                note("F4", "F♯ (key)", "q"),
                note("Fn4", "F♮", "q"),
                note("F4", "still F♮", "q"),
                note("G4", "G", "q"),
              ],
              [note("F4", "F♯ again", "h"), note("G4", "G", "h")],
            ],
          }}
        />
      </TheoryCard>
    </div>
  );
}
