import { useState } from "react";

import { ChoiceButtons } from "@/components/choice-buttons";
import { CHORD_KINDS, type ChordKind, type ExampleRequest, type NoteName } from "@/lib/engine";
import { CHORD_LABELS, degreeLabel, pitchLabel } from "@/lib/pitch-labels";

import { ExampleStaff } from "./example-staff";
import { ExplorerInstrument } from "./explorer-instrument";
import { KindSelect } from "./kind-select";
import { ListenButton } from "./listen-button";
import { RootSelect, noteNameLabel } from "./root-select";
import { chord, pitchChord, pitchNote } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";
import { useTheoryExample } from "./use-theory-example";

const INVERSIONS = [
  { id: "0", label: "Root position" },
  { id: "1", label: "1st inversion" },
  { id: "2", label: "2nd inversion" },
  { id: "3", label: "3rd inversion" },
] as const;
type InversionId = (typeof INVERSIONS)[number]["id"];

/** Which chord tone is lowest in each inversion. */
const LOWEST = ["root", "3rd", "5th", "7th"];

const toneCount = (c: ChordKind) => CHORD_LABELS[c].tones.split(" ").length;

function ChordExplorer() {
  const [kind, setKind] = useState<ChordKind>("major");
  const [inversionId, setInversionId] = useState<InversionId>("0");
  const [root, setRoot] = useState<NoteName>({ letter: "c", accidental: 0 });
  // A triad has no 3rd inversion: show its last one instead.
  const inversion = Math.min(Number(inversionId), toneCount(kind) - 1);
  const request: ExampleRequest = { kind: "chord", chord: kind, root, inversion };
  const { example, error } = useTheoryExample(request);
  const label = CHORD_LABELS[kind];
  const bass = example?.notes[0];
  const symbol = `${noteNameLabel(root)}${label.symbol}${
    inversion > 0 && bass ? `/${pitchLabel(bass.written, false)}` : ""
  }`;
  const doubled = example?.notes.some((n) => Math.abs(n.written.accidental) === 2) ?? false;
  const names = example?.notes.map((n) => pitchLabel(n.written, false)).join(", ") ?? "";

  return (
    <TheoryCard
      title="Try any chord"
      description="Pick a chord, an inversion and a root to see it note by note and stacked, and hear it as an arpeggio."
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <KindSelect
          label="Chord"
          value={kind}
          options={CHORD_KINDS}
          optionLabel={(c) => `${CHORD_LABELS[c].name} (C${CHORD_LABELS[c].symbol})`}
          onChange={setKind}
        />
        <RootSelect label="Root" value={root} onChange={setRoot} />
      </div>
      <ChoiceButtons
        label="Inversion"
        options={INVERSIONS.slice(0, toneCount(kind))}
        value={String(inversion) as InversionId}
        onChange={setInversionId}
      />
      {example && (
        <>
          <ExampleStaff
            label={`${symbol}: ${names}, first one at a time, then together.`}
            score={{
              clef: example.clef,
              bars: [
                example.notes.map((n) =>
                  pitchNote(n.written, [
                    pitchLabel(n.written, false),
                    n.degree ? degreeLabel(n.degree) : "",
                  ]),
                ),
                [pitchChord(example.notes.map((n) => n.written), [symbol])],
              ],
            }}
          />
          <p className="text-muted-foreground">
            {label.name}: {label.tones}.{" "}
            {inversion === 0
              ? "Root position: the root is the lowest note."
              : `${INVERSIONS[inversion].label}: the ${LOWEST[inversion]} is the lowest note.`}
          </p>
          {doubled && (
            <p className="text-amber-600 dark:text-amber-400">
              This chord needs a double sharp or flat to stay in thirds. Practice skips roots like
              this one.
            </p>
          )}
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ListenButton request={request} />
      <ExplorerInstrument />
    </TheoryCard>
  );
}

/** Chords: triads, sevenths, symbols, inversions and chords in a key. */
export function ChordsTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["chords"]}>
        A chord is three or more notes sounding together. Most chords are built by stacking 3rds
        on top of a root.
      </PractiseIn>

      <TheoryCard title="Triads">
        <p>
          A <strong>triad</strong> has three notes: the <strong>root</strong>, the{" "}
          <strong>3rd</strong> and the <strong>5th</strong> above it. On the staff a triad in root
          position sits on three lines or three spaces in a row. The size of the two 3rds decides
          its quality:
        </p>
        <TheoryTable
          head={["Triad", "3rds, bottom to top", "Degrees", "Symbol", "On C"]}
          rows={[
            ["Major", "Major 3rd + minor 3rd", "1 3 5", "C", "C E G"],
            ["Minor", "Minor 3rd + major 3rd", "1 ♭3 5", "Cm", "C E♭ G"],
            ["Diminished", "Minor 3rd + minor 3rd", "1 ♭3 ♭5", "C°", "C E♭ G♭"],
            ["Augmented", "Major 3rd + major 3rd", "1 3 ♯5", "C+", "C E G♯"],
          ]}
        />
        <ExampleStaff
          label="C major, C minor, C diminished and C augmented triads."
          score={{
            clef: "treble",
            bars: [
              [
                chord(["C4", "E4", "G4"], ["Major", "C"]),
                chord(["C4", "Eb4", "G4"], ["Minor", "Cm"]),
                chord(["C4", "Eb4", "Gb4"], ["Dim.", "C°"]),
                chord(["C4", "E4", "G#4"], ["Aug.", "C+"]),
              ],
            ],
          }}
        />
        <p>
          Major sounds bright and stable, minor darker, diminished tense, augmented unsettled. The
          5th is perfect in major and minor triads, diminished (♭5) or augmented (♯5) in the other
          two.
        </p>
      </TheoryCard>

      <TheoryCard title="Seventh chords">
        <p>
          Stack one more 3rd and you get a <strong>seventh chord</strong>: a triad plus the 7th
          above the root.
        </p>
        <TheoryTable
          head={["Chord", "Triad + 7th", "Degrees", "Symbol", "On C"]}
          rows={[
            ["Dominant 7th", "Major + minor 7th", "1 3 5 ♭7", "C7", "C E G B♭"],
            ["Major 7th", "Major + major 7th", "1 3 5 7", "Cmaj7", "C E G B"],
            ["Minor 7th", "Minor + minor 7th", "1 ♭3 5 ♭7", "Cm7", "C E♭ G B♭"],
            ["Half-diminished 7th", "Diminished + minor 7th", "1 ♭3 ♭5 ♭7", "Cm7♭5 (Cø)", "C E♭ G♭ B♭"],
            ["Diminished 7th", "Diminished + diminished 7th", "1 ♭3 ♭5 𝄫7", "C°7", "C E♭ G♭ B𝄫"],
          ]}
        />
        <ExampleStaff
          label="Seventh chords on C: C7, Cmaj7, Cm7, Cm7 flat 5 and C diminished 7."
          score={{
            clef: "treble",
            bars: [
              [
                chord(["C4", "E4", "G4", "Bb4"], "C7"),
                chord(["C4", "E4", "G4", "B4"], "Cmaj7"),
                chord(["C4", "Eb4", "G4", "Bb4"], "Cm7"),
                chord(["C4", "Eb4", "Gb4", "Bb4"], "Cm7♭5"),
                chord(["C4", "Eb4", "Gb4", "Bbb4"], "C°7"),
              ],
            ],
          }}
        />
        <p>
          The diminished 7th is all minor 3rds; its B𝄫 sounds like A but is written as a B to keep
          the chord in 3rds.
        </p>
        <InTheApp>
          <p>
            Chords skips roots whose chord would need a double sharp or flat, like C diminished 7th
            (B𝄫). The explorer below shows them anyway.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Chord symbols">
        <p>
          A chord symbol is the root's letter followed by its kind: <strong>C</strong> (major),{" "}
          <strong>Cm</strong> (minor), <strong>C°</strong> (diminished), <strong>C+</strong>{" "}
          (augmented), <strong>C7</strong> (dominant 7th), <strong>Cmaj7</strong>,{" "}
          <strong>Cm7</strong>, <strong>Cm7♭5</strong> or <strong>Cø</strong> (half-diminished),{" "}
          <strong>C°7</strong>. A slash names the lowest note when it is not the root:{" "}
          <strong>C/E</strong> is a C major chord with E at the bottom.
        </p>
      </TheoryCard>

      <TheoryCard title="Inversions">
        <p>
          The same chord tones can be stacked in a different order. Which tone is lowest names the{" "}
          <strong>inversion</strong>:
        </p>
        <Bullets>
          <li>Root position: the root is lowest (C E G).</li>
          <li>1st inversion: the 3rd is lowest (E G C), written C/E.</li>
          <li>2nd inversion: the 5th is lowest (G C E), written C/G.</li>
          <li>3rd inversion, seventh chords only: the 7th is lowest (B♭ C E G), written C7/B♭.</li>
        </Bullets>
        <ExampleStaff
          label="C major in root position, first inversion and second inversion."
          score={{
            clef: "treble",
            bars: [
              [
                chord(["C4", "E4", "G4"], ["Root pos.", "C"]),
                chord(["E4", "G4", "C5"], ["1st inv.", "C/E"]),
                chord(["G4", "C5", "E5"], ["2nd inv.", "C/G"]),
              ],
            ],
          }}
        />
        <p>The chord keeps its name and quality; it just sounds lighter or more open.</p>
      </TheoryCard>

      <TheoryCard title="Arpeggios">
        <p>
          Playing a chord's notes one after another instead of together is an{" "}
          <strong>arpeggio</strong>. It is how chords are practised on single-note instruments, and
          how guitarists and pianists often play accompaniments.
        </p>
        <InTheApp>
          <p>
            The app hears one note at a time, so Chords asks for arpeggios: play the chord's notes
            from the lowest up, starting in any octave. "Inversions" adds 1st, 2nd and 3rd
            inversions; "Show the notes" turns building chords into reading them.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Chords in a key">
        <p>
          Build a triad on every degree of a major scale using only its notes, and you get the
          chords of that key. Roman numerals name them by degree: capitals for major, small letters
          for minor, ° for diminished.
        </p>
        <ExampleStaff
          label="The triads of C major: I C, ii D minor, iii E minor, IV F, V G, vi A minor, vii diminished B."
          score={{
            clef: "treble",
            bars: [
              [
                chord(["C4", "E4", "G4"], ["I", "C"]),
                chord(["D4", "F4", "A4"], ["ii", "Dm"]),
                chord(["E4", "G4", "B4"], ["iii", "Em"]),
                chord(["F4", "A4", "C5"], ["IV", "F"]),
                chord(["G4", "B4", "D5"], ["V", "G"]),
                chord(["A4", "C5", "E5"], ["vi", "Am"]),
                chord(["B4", "D5", "F5"], ["vii°", "B°"]),
              ],
            ],
          }}
        />
        <p>
          Every major key has the same pattern: major on I, IV and V; minor on ii, iii and vi;
          diminished on vii. With 7ths added, the chord on V is a dominant 7th (G7 in C major),
          which is where that chord gets its name: it is built on the dominant.
        </p>
      </TheoryCard>

      <ChordExplorer />
    </div>
  );
}
