import { EngineStatusBanner } from "@/components/engine-status-banner";
import { TallMeters } from "@/components/level-meter";
import { Waveform } from "@/components/waveform";
import { useEngine, useFrame } from "@/providers/audio-engine-context";

import { NoteDisplay } from "./note-display";

export function TunerScreen() {
  const { status } = useEngine();
  const frame = useFrame();

  return (
    <div className="flex flex-col gap-5">
      <EngineStatusBanner status={status} />

      <div className="flex flex-wrap items-stretch gap-5">
        <section
          aria-label="Tuner display"
          className="min-w-0 flex-[999_1_34rem] rounded-2xl border bg-card p-4"
        >
          <NoteDisplay note={frame?.note ?? null} />
        </section>

        <aside className="flex flex-[1_1_16rem] flex-col gap-5">
          <section
            aria-label="Input levels"
            className="flex min-h-64 flex-1 flex-col gap-3.5 rounded-2xl border bg-card p-[18px]"
          >
            <div className="rack-label">Level · peak hold</div>
            <TallMeters meters={frame?.meters ?? []} />
          </section>
          <section
            aria-label="Waveform"
            className="flex flex-col gap-3 rounded-2xl border bg-card p-[18px]"
          >
            <div className="rack-label">
              {frame ? `Wave · input ${frame.waveformChannel + 1}` : "Wave · waiting for input"}
            </div>
            <Waveform points={frame?.waveform ?? []} />
          </section>
        </aside>
      </div>

      <footer className="flex flex-wrap gap-x-7 gap-y-2 rounded-xl border bg-topbar px-5 py-3 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        <span>A4 = 440 Hz</span>
        <span>One note at a time</span>
      </footer>
    </div>
  );
}
