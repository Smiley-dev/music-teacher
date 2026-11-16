import { ExampleStaff } from "./example-staff";
import { beat, rest } from "./score-notes";
import { Bullets, InTheApp, PractiseIn, TheoryCard, TheoryTable } from "./topic-parts";

/** Rhythm: beat, tempo, bars, time signatures, note values, rests and dots. */
export function RhythmTheory() {
  return (
    <div className="flex flex-col gap-6">
      <PractiseIn exercises={["rhythm", "reading"]}>
        How long notes last and how music is counted: the beat, tempo, bars and time signatures,
        note values, rests and dots.
      </PractiseIn>

      <TheoryCard title="Beat and tempo">
        <p>
          The <strong>beat</strong> is the steady pulse you would tap your foot to. The{" "}
          <strong>tempo</strong> says how fast it goes, in beats per minute (<strong>BPM</strong>):
          at 60 BPM there is one beat every second, at 120 BPM two.
        </p>
        <InTheApp>
          <p>
            In Rhythm and Reading the quarter note is the beat. The metronome clicks once per beat,
            and every exercise starts with a <strong>count-in</strong> of four clicks: start playing
            on the next beat.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Bars and time signatures">
        <p>
          Beats are grouped into <strong>bars</strong> (measures), separated by bar lines. Every bar
          holds the same number of beats. A thin line followed by a thick one ends the piece.
        </p>
        <p>
          The <strong>time signature</strong> at the start says how: the top number is the number
          of beats in a bar, the bottom number which note gets one beat (4 = a quarter note). The
          first beat of each bar is the strongest.
        </p>
        <TheoryTable
          head={["Time signature", "Beats per bar", "Counted", "Feels like"]}
          rows={[
            ["2/4", "2 quarter notes", "1 2 | 1 2", "A march"],
            ["3/4", "3 quarter notes", "1 2 3 | 1 2 3", "A waltz"],
            ["4/4", "4 quarter notes", "1 2 3 4 | 1 2 3 4", "Most pop, rock and folk music"],
          ]}
        />
        <div className="flex flex-col gap-2">
          {(
            [
              ["2/4", 2],
              ["3/4", 3],
              ["4/4", 4],
            ] as const
          ).map(([time, beats]) => (
            <ExampleStaff
              key={time}
              label={`Two bars of ${time}, counted in quarter notes.`}
              score={{
                clef: "percussion",
                time,
                end: true,
                bars: [0, 1].map(() =>
                  Array.from({ length: beats }, (_, i) => beat("q", String(i + 1))),
                ),
              }}
            />
          ))}
        </div>
        <InTheApp>
          <p>
            The metronome accents beat 1 of every bar with a higher click. Rhythm and Reading
            offer 2/4, 3/4 and 4/4.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Note values">
        <p>
          The shape of a note says how long it lasts. Each value is half as long as the one before
          it. A note has a <strong>head</strong> (hollow for whole and half notes, filled for
          shorter ones), most have a <strong>stem</strong>, and eighths and sixteenths add one or
          two <strong>flags</strong>.
        </p>
        <ExampleStaff
          label="Whole note: 4 beats. Half note: 2. Quarter note: 1. Eighth note: half a beat. Sixteenth note: a quarter of a beat."
          score={{
            clef: "percussion",
            bars: [
              [
                beat("w", ["Whole", "4 beats"]),
                beat("h", ["Half", "2"]),
                beat("q", ["Quarter", "1"]),
                beat("8", ["Eighth", "½"]),
                beat("16", ["Sixteenth", "¼"]),
              ],
            ],
          }}
        />
        <p>One bar of 4/4 can be filled with any of them. Below each note is the beat it starts on:</p>
        <ExampleStaff
          label="A bar of 4/4 as one whole note, two half notes, four quarter notes and eight eighth notes."
          score={{
            clef: "percussion",
            time: "4/4",
            end: true,
            bars: [
              [beat("w", "1")],
              [beat("h", "1"), beat("h", "3")],
              ["1", "2", "3", "4"].map((n) => beat("q", n)),
              ["1", "&", "2", "&", "3", "&", "4", "&"].map((n) => beat("8", n)),
            ],
          }}
        />
      </TheoryCard>

      <TheoryCard title="Rests">
        <p>
          A <strong>rest</strong> is a silence with the same lengths as the notes. The whole rest
          hangs below a line, the half rest sits on top of one. Count rests just like notes.
        </p>
        <ExampleStaff
          label="Whole rest: 4 beats. Half rest: 2. Quarter rest: 1. Eighth rest: half a beat. Sixteenth rest: a quarter of a beat."
          score={{
            clef: "percussion",
            bars: [
              [
                rest("w", ["Whole", "4"]),
                rest("h", ["Half", "2"]),
                rest("q", ["Quarter", "1"]),
                rest("8", ["Eighth", "½"]),
                rest("16", ["Sixteenth", "¼"]),
              ],
            ],
          }}
        />
        <ExampleStaff
          label="A bar of 4/4: a quarter note on 1, a quarter rest on 2, two eighth notes on 3 and 'and', a quarter rest on 4."
          score={{
            clef: "percussion",
            time: "4/4",
            end: true,
            bars: [[beat("q", "1"), rest("q", "(2)"), beat("8", "3"), beat("8", "&"), rest("q", "(4)")]],
          }}
        />
      </TheoryCard>

      <TheoryCard title="Dotted notes">
        <p>
          A <strong>dot</strong> after a note adds half of its length: a dotted half note lasts 2 +
          1 = 3 beats, a dotted quarter 1 + ½ = 1½ beats, a dotted eighth ¾ of a beat. Rests can be
          dotted too.
        </p>
        <ExampleStaff
          label="A dotted half note (3 beats) and a quarter note; then a dotted quarter (1 and a half beats), an eighth and a half note."
          score={{
            clef: "percussion",
            time: "4/4",
            end: true,
            bars: [
              [beat("h", "3 beats", true), beat("q", "1")],
              [beat("q", "1½", true), beat("8", "½"), beat("h", "2")],
            ],
          }}
        />
        <InTheApp>
          <p>
            Dotted notes and rests come with <strong>Hard</strong> or as a Custom option. A dotted
            whole note (6 beats) never fits in a bar of these time signatures, so it is never used.
          </p>
        </InTheApp>
      </TheoryCard>

      <TheoryCard title="Beams and counting">
        <p>
          Eighths and sixteenths next to each other are joined by <strong>beams</strong> instead of
          flags, grouped by beat, so you can see where each beat starts. To count them, split the
          beat into syllables:
        </p>
        <Bullets>
          <li>
            Quarter notes: <strong>1 2 3 4</strong>
          </li>
          <li>
            Eighth notes: <strong>1 & 2 & 3 & 4 &</strong> ("one and two and")
          </li>
          <li>
            Sixteenth notes: <strong>1 e & a 2 e & a</strong> ("one ee and a")
          </li>
        </Bullets>
        <ExampleStaff
          label="A bar of 4/4: a quarter note on 1, two eighths on 2 and 'and', four sixteenths on 3 e and a, a quarter note on 4."
          score={{
            clef: "percussion",
            time: "4/4",
            end: true,
            bars: [
              [
                beat("q", "1"),
                beat("8", "2"),
                beat("8", "&"),
                beat("16", "3"),
                beat("16", "e"),
                beat("16", "&"),
                beat("16", "a"),
                beat("q", "4"),
              ],
            ],
          }}
        />
      </TheoryCard>

      <TheoryCard title="Playing in time">
        <Bullets>
          <li>Count along, out loud or in your head, from the count-in to the last bar.</li>
          <li>
            Feel the smallest value in the piece: with eighth notes, think "1 & 2 &" even during
            long notes and rests.
          </li>
          <li>
            Keep the beat steady. Getting faster is <strong>rushing</strong>, getting slower is{" "}
            <strong>dragging</strong>.
          </li>
          <li>Start at a slow tempo you can play without mistakes, then speed up.</li>
        </Bullets>
        <InTheApp>
          <p>
            Rhythm practice listens for when each note starts. A note within 40 ms of its time is
            on time; further off is early or late; no note at all is missed. After the last bar the
            analysis shows whether you tend to rush or drag and how steady you are.
          </p>
        </InTheApp>
      </TheoryCard>
    </div>
  );
}
