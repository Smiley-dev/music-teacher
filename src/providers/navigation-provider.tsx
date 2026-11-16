import { type ReactNode, useMemo, useState } from "react";

import { SECTIONS, type Section, type SectionId, subsectionsOf } from "@/sections";

import { NavigationContext, type NavigationValue } from "./navigation-context";

const SECTION_KEY = "music-teacher:section";
/** Last subsection shown in each section, e.g. "music-teacher:subsection:theory". */
const subsectionKey = (section: string) => `music-teacher:subsection:${section}`;

const ALL: readonly (Section & { id: SectionId })[] = SECTIONS;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage unavailable: start from the defaults.
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered across restarts; harmless.
  }
}

const find = (id: string) => ALL.find((s) => s.id === id);

function initialSection(): SectionId {
  return find(load(SECTION_KEY) ?? "")?.id ?? ALL[0].id;
}

/** The remembered subsection of every section that has them (else its first). */
function initialSubsections(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const section of ALL) {
    const subs = subsectionsOf(section);
    if (subs.length === 0) continue;
    const saved = load(subsectionKey(section.id));
    result[section.id] = subs.find((s) => s.id === saved)?.id ?? subs[0].id;
  }
  return result;
}

/** Holds the selected section and subsections, remembered in localStorage.
 * Navigating never starts or stops audio by itself. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [sectionId, setSectionId] = useState<SectionId>(initialSection);
  const [subsections, setSubsections] = useState<Record<string, string>>(initialSubsections);

  const value = useMemo<NavigationValue>(() => {
    const section = find(sectionId) ?? ALL[0];
    const subs = subsectionsOf(section);
    const go: NavigationValue["go"] = (id, subsection) => {
      setSectionId(id);
      save(SECTION_KEY, id);
      const target = find(id);
      if (subsection && target && subsectionsOf(target).some((s) => s.id === subsection)) {
        setSubsections((current) => ({ ...current, [id]: subsection }));
        save(subsectionKey(id), subsection);
      }
      window.scrollTo({ top: 0 });
    };
    return {
      sections: ALL,
      section,
      subsection: subs.find((s) => s.id === subsections[section.id]) ?? subs[0] ?? null,
      go,
    };
  }, [sectionId, subsections]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
