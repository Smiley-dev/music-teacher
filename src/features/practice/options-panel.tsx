import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Panel, PanelLabel } from "@/components/rack";
import { useNavigation } from "@/providers/navigation-context";
import type { SubsectionId } from "@/sections";

import { InstrumentNote } from "./instrument-note";

/** The options panel of a Practice page: which instrument the exercise is
 * written for, then the options, separated by dashed lines, and a link to
 * the Theory topic behind the exercise. Options are saved; they are locked
 * while the exercise runs. */
export function OptionsPanel({
  title = "Options",
  locked,
  error,
  theory,
  instrument = true,
  children,
}: {
  /** What the panel holds ("Options", "Melody"). */
  title?: string;
  locked: boolean;
  error?: string | null;
  theory?: { topic: SubsectionId<"theory">; label: string };
  /** Show which instrument the exercise is written for (not for rhythm). */
  instrument?: boolean;
  children: ReactNode;
}) {
  const { go } = useNavigation();
  return (
    <Panel aria-label={title} className="flex flex-col gap-4">
      <PanelLabel tone={locked ? "signal" : "muted"}>
        {`${title} · ${locked ? "locked while running" : "saved"}`}
      </PanelLabel>
      {instrument && <InstrumentNote />}
      <div className="flex flex-col gap-4 [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:pt-4">
        {children}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {theory && (
        <button
          type="button"
          onClick={() => go("theory", theory.topic)}
          className="flex items-center justify-between gap-3 rounded-[10px] bg-inset px-3.5 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span>
            <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
              THEORY
            </span>
            {theory.label}
          </span>
          <ArrowRight className="size-4 text-signal" aria-hidden />
        </button>
      )}
    </Panel>
  );
}
