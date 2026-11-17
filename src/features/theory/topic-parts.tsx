import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Panel, PanelLabel } from "@/components/rack";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/providers/navigation-context";
// Types only: `@/sections` imports the topics, which import this file.
import type { SectionId, SubsectionId } from "@/sections";

type TheoryCardProps = {
  title: string;
  description?: string;
  /** An explorer (try any example): marked and outlined in amber. */
  explorer?: boolean;
  children: ReactNode;
  className?: string;
};

/** One concept: a titled panel of text, tables and examples. */
export function TheoryCard({ title, description, explorer, children, className }: TheoryCardProps) {
  return (
    <Panel
      aria-label={title}
      className={cn(
        "flex flex-col gap-3.5 rounded-[14px] sm:p-5",
        explorer && "border-amber-500/45",
        className,
      )}
    >
      <div>
        {explorer && <PanelLabel tone="signal">Explorer</PanelLabel>}
        <h2 className="text-xl leading-snug font-extrabold">{title}</h2>
        {description && <p className="mt-0.5 text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-3.5 leading-relaxed">{children}</div>
    </Panel>
  );
}

type SectionLinkProps<Id extends SectionId> = {
  section: Id;
  subsection?: SubsectionId<Id>;
  children: ReactNode;
};

/** Text that takes the user to another page of the app. */
export function SectionLink<Id extends SectionId>({
  section,
  subsection,
  children,
}: SectionLinkProps<Id>) {
  const { go } = useNavigation();
  return (
    <button
      type="button"
      className="cursor-pointer font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
      onClick={() => go(section, subsection)}
    >
      {children}
    </button>
  );
}

type PractiseInProps = {
  /** The Practice pages that exercise this topic. */
  exercises: SubsectionId<"practice">[];
  children: ReactNode;
};

/** A topic's introduction, with links to the Practice pages that use it. */
export function PractiseIn({ exercises, children }: PractiseInProps) {
  const { sections, go } = useNavigation();
  const pages = sections.find((s) => s.id === "practice")?.subsections ?? [];
  const label = (id: string) => pages.find((s) => s.id === id)?.label ?? id;
  return (
    <Panel className="flex flex-col gap-3 rounded-[14px]">
      <nav aria-label="Practise it in Practice" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          PRACTISE IT IN PRACTICE
        </span>
        {exercises.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => go("practice", id)}
            className="flex h-[34px] items-center gap-1.5 rounded-[7px] border-b-[3px] border-primary bg-secondary px-3 font-mono text-xs font-bold uppercase outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {label(id)}
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        ))}
      </nav>
      <p className="leading-relaxed">{children}</p>
    </Panel>
  );
}

/** How the app uses a concept, set apart from the theory itself. */
export function InTheApp({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
      <span className="flex-none pt-1 font-mono text-[10px] font-bold tracking-[0.12em] text-amber-600 dark:text-amber-400">
        IN THE APP
      </span>
      <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2">{children}</div>
    </div>
  );
}

type TheoryTableProps = {
  head: ReactNode[];
  rows: ReactNode[][];
  className?: string;
};

/** A small reference table. */
export function TheoryTable({ head, rows, className }: TheoryTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-[10px] bg-inset", className)}>
      <table className="w-full text-left text-sm">
        <thead className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3.5 py-2.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-card odd:bg-card/40">
              {row.map((cell, c) => (
                <td key={c} className={cn("px-3.5 py-2 align-top", c === 0 && "font-bold")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A bulleted list with the app's spacing. */
export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}
