import { useState } from "react";

import { OptionCheckbox } from "@/components/option-checkbox";
import {
  type ExampleNote,
  type ExampleRequest,
  type KeySignature,
  type NoteName,
  SCALE_KINDS,
  type ScaleKind,
} from "@/lib/engine";
import { SCALE_LABELS, degreeLabel, pitchLabel } from "@/lib/pitch-labels";

import { ExampleStaff } from "./example-staff";
import { keyAccidentals } from "./key-signatures";
import { KeyboardDiagram } from "./keyboard-diagram";
import { KindSelect } from "./kind-select";
import { ListenButton } from "./listen-button";
import { RootSelect, noteNameLabel } from "./root-select";
import { pitchNote } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";
import { useTheoryExample } from "./use-theory-example";

/** Step sizes between neighbouring notes, by half steps. */
function stepLabel(halfSteps: number): string {
  switch (Math.abs(halfSteps)) {
    case 1:
      return "H";
    case 2:
      return "W";
    case 3:
      return "W+H";
    default:
      return `${Math.abs(halfSteps)} half steps`;
  }
}

/** The degrees below the octave, going up: "1 2 ♭3 4 5 ♭6 ♭7". */
function formula(notes: ExampleNote[]): string {
  let letters = 0;
  const up: string[] = [];
  for (const n of notes) {
    letters += n.steps;
    if (letters >= 7 || !n.degree) break;
    up.push(degreeLabel(n.degree));
  }
  return up.join(" ");
}

function keyLine(scale: ScaleKind, key: KeySignature | null): string {
  if (!key) {
    return "This key would need more than seven sharps or flats, so music is written in the key that sounds the same with fewer (A♭ major instead of G♯ major).";
  }
  const major = pitchLabel(key.major, false);
  const parent = scale === "major" ? "" : `, the signature of ${major} major`;
  const raised =
    scale === "harmonicMinor" || scale === "melodicMinor"
      ? " Its raised notes are written as accidentals in the music."
      : "";
  return `Key signature: ${keyAccidentals(key.accidentals)}${parent}.${raised}`;
}

function ScaleExplorer() {
  const [scale, setScale] = useState<ScaleKind>("major");
  const [root, setRoot] = useState<NoteName>({ letter: "c", accidental: 0 });
  const [upAndDown, setUpAndDown] = useState(false);
  const request: ExampleRequest = { kind: "scale", scale, root, upAndDown };
  const { example, error } = useTheoryExample(request);
  const title = `${noteNameLabel(root)} ${SCALE_LABELS[scale].name.toLowerCase()}`;
  const doubled = example?.notes.some((n) => Math.abs(n.written.accidental) === 2) ?? false;

  return (
    <TheoryCard
      title="Try any scale"
      description="Pick a scale and a root to see its notes, degrees and steps for your instrument, and hear it."
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <KindSelect
          label="Scale or mode"
          value={scale}
          options={SCALE_KINDS}
          optionLabel={(s) => SCALE_LABELS[s].name}
          onChange={setScale}
        />
        <RootSelect label="Root" value={root} onChange={setRoot} />
        <OptionCheckbox
          id="theory-scale-up-and-down"
          label="Up and down"
          description="Back down to the root."
          checked={upAndDown}
          onChange={setUpAndDown}
        />
      </div>
      {example && (
        <>
          <ExampleStaff
            label={`${title}: ${example.notes.map((n) => pitchLabel(n.written, false)).join(", ")}.`}
            score={{
              clef: example.clef,
              bars: [
                example.notes.map((n) =>
                  pitchNote(n.written, [
                    pitchLabel(n.written, false),
                    n.degree ? degreeLabel(n.degree) : "",
                  ]),
                ),
              ],
            }}
          />
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Steps between the notes">
            {example.notes.map((n, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span
                    className={
                      Math.abs(n.semitones) === 1
                        ? "rounded bg-emerald-500/15 px-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                        : "rounded bg-muted px-1.5 text-xs text-muted-foreground"
                    }
                  >
                    {stepLabel(n.semitones)}
                  </span>
                )}
                <span className="font-medium">{pitchLabel(n.written, false)}</span>
              </span>
            ))}
          </div>
          <p className="text-muted-foreground">
            Degrees going up: {formula(example.notes)}. {keyLine(scale, example.key)}
          </p>
          {doubled && (
            <p className="text-amber-600 dark:text-amber-400">
              This scale needs a double sharp or flat to keep one letter per degree. Practice skips
              roots like this one.
            </p>
          )}
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ListenButton request={request} />
    </TheoryCard>
  );
}

/** Scales and modes: degrees, step patterns, minors, pentatonics and modes. */
export function ScalesTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["scales", "reading", "ear"]}>
        A scale is a set of notes in order, from a starting note to its octave. Each kind of scale
        has its own pattern of steps, which gives it its sound.
      </PractiseIn>

      <TheoryCard title="Degrees">
        <p>
          The notes of a scale are its <strong>degrees</strong>, numbered from the starting note,
          the <strong>tonic</strong> or <strong>root</strong> (1). The octave is the tonic again.
          Other scales are often described against the major scale: <strong>♭3</strong> means the
          3rd is a half step lower than in major, <strong>♯4</strong> a half step higher.
        </p>
        <TheoryTable
          head={["Degree", "Name", "In C major"]}
          rows={[
            ["1", "Tonic", "C"],
            ["2", "Supertonic", "D"],
            ["3", "Mediant", "E"],
            ["4", "Subdominant", "F"],
            ["5", "Dominant", "G"],
            ["6", "Submediant", "A"],
            ["7", "Leading tone (a half step below the tonic)", "B"],
          ]}
        />
      </TheoryCard>

      <TheoryCard title="The major scale">
        <p>
          Every major scale has the same pattern of whole (W) and half (H) steps:{" "}
          <strong>W W H W W W H</strong>. From C it uses only the white keys, because the half steps
          fall exactly on E–F and B–C.
        </p>
        <KeyboardDiagram steps />
        <p>
          From any other root the pattern needs sharps or flats. A scale uses each letter{" "}
          <strong>once</strong>, so the spelling follows from the degrees: F♯ major has E♯ (not F)
          as its 7th, and E♭ major has A♭ (not G♯) as its 4th.
        </p>
        <InTheApp>
          <p>
            Scales asks for scales on roots that need at most single sharps or flats: G♯ major
            would need F𝄪, so it is skipped (A♭ major sounds the same).
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Minor scales">
        <p>
          Minor scales have a minor 3rd (♭3), which makes them sound darker. There are three common
          forms:
        </p>
        <TheoryTable
          head={["Scale", "Degrees", "Steps", "From A"]}
          rows={[
            ["Natural minor", "1 2 ♭3 4 5 ♭6 ♭7", "W H W W H W W", "A B C D E F G"],
            ["Harmonic minor", "1 2 ♭3 4 5 ♭6 7", "W H W W H W+H H", "A B C D E F G♯"],
            ["Melodic minor (going up)", "1 2 ♭3 4 5 6 7", "W H W W W W H", "A B C D E F♯ G♯"],
          ]}
        />
        <Bullets>
          <li>
            <strong>Harmonic minor</strong> raises the 7th, so it leads up to the tonic like in
            major. Between ♭6 and 7 is a gap of three half steps (W+H).
          </li>
          <li>
            <strong>Melodic minor</strong> also raises the 6th to smooth that gap going up, and
            comes back down as natural minor.
          </li>
          <li>
            Every major scale has a <strong>relative minor</strong> with the same notes, starting on
            its 6th degree, three half steps below: C major and A minor, G major and E minor.
          </li>
          <li>
            The <strong>parallel minor</strong> starts on the same tonic: C major and C minor.
          </li>
        </Bullets>
      </TheoryCard>

      <TheoryCard title="Pentatonic scales">
        <p>
          Pentatonic scales have five notes and no half steps between neighbours, which makes them
          easy to improvise with; they are everywhere in folk, blues and rock.
        </p>
        <TheoryTable
          head={["Scale", "Degrees", "Steps", "Example"]}
          rows={[
            ["Major pentatonic", "1 2 3 5 6", "W W W+H W W+H", "C D E G A"],
            ["Minor pentatonic", "1 ♭3 4 5 ♭7", "W+H W W W+H W", "A C D E G"],
          ]}
        />
        <p>
          The major pentatonic is the major scale without its 4th and 7th; the minor pentatonic is
          the natural minor without its 2nd and 6th. Like major and minor, C major pentatonic and A
          minor pentatonic share their notes.
        </p>
      </TheoryCard>

      <TheoryCard title="Modes">
        <p>
          Play the notes of a major scale but start on another degree, and you get a{" "}
          <strong>mode</strong>: the same notes, a different tonic, a different pattern and sound.
          On the white keys:
        </p>
        <TheoryTable
          head={["Mode", "Starts on", "White keys", "Compared with major", "Sound"]}
          rows={[
            ["Ionian", "1st degree", "C to C", "The major scale", "Bright"],
            ["Dorian", "2nd", "D to D", "♭3 ♭7", "Minor, with a brighter 6th"],
            ["Phrygian", "3rd", "E to E", "♭2 ♭3 ♭6 ♭7", "Dark, Spanish-sounding ♭2"],
            ["Lydian", "4th", "F to F", "♯4", "Bright and floating"],
            ["Mixolydian", "5th", "G to G", "♭7", "Major with a bluesy 7th"],
            ["Aeolian", "6th", "A to A", "♭3 ♭6 ♭7", "The natural minor"],
            ["Locrian", "7th", "B to B", "♭2 ♭3 ♭5 ♭6 ♭7", "Unstable (diminished 5th)"],
          ]}
        />
        <p>
          On another root a mode keeps its pattern. E Dorian is the 2nd mode of D major, so it uses
          D major's notes from E: E F♯ G A B C♯ D. Ionian, Lydian and Mixolydian have a major 3rd;
          Dorian, Phrygian and Aeolian a minor 3rd; Locrian also a diminished 5th.
        </p>
        <InTheApp>
          <p>
            Reading writes modes with their parent major's key signature (D Dorian has none, E
            Dorian two sharps). In Scales, "Show the notes" turns building a scale into reading it.
          </p>
        </InTheApp>
      </TheoryCard>

      <ScaleExplorer />
    </div>
  );
}
