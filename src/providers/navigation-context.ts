import { createContext, useContext } from "react";

import type { Section, SectionId, Subsection } from "@/sections";

export type NavigationValue = {
  /** Every main menu entry, in order. */
  sections: readonly (Section & { id: SectionId })[];
  section: Section & { id: SectionId };
  /** The subsection shown, when the section has subsections. */
  subsection: Subsection | null;
  /** Show `section`, at `subsection` if given and known (else where it was
   * left), and scroll back to the top. Links written by hand use
   * `SubsectionId` to have their ids checked. */
  go: (section: SectionId, subsection?: string) => void;
};

export const NavigationContext = createContext<NavigationValue | null>(null);

/** Where the app is, and a way to go elsewhere. */
export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useNavigation must be used inside <NavigationProvider>");
  return value;
}
