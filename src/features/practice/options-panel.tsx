import type { ReactNode } from "react";

import { Panel, PanelLabel } from "@/components/rack";

import { InstrumentNote } from "./instrument-note";

/** The options panel of a Practice page: which instrument the exercise is
 * written for, then the options, separated by dashed lines. Options are
 * saved; they are locked while the exercise runs. */
export function OptionsPanel({
  locked,
  error,
  children,
}: {
  locked: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <Panel aria-label="Options" className="flex flex-col gap-4">
      <PanelLabel tone={locked ? "signal" : "muted"}>
        {locked ? "Options · locked while running" : "Options · saved"}
      </PanelLabel>
      <InstrumentNote />
      <div className="flex flex-col gap-4 [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:pt-4">
        {children}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Panel>
  );
}
