import type { ReactNode } from "react";
import { Dumbbell, Lightbulb } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/providers/navigation-context";
// Types only: `@/sections` imports the topics, which import this file.
import type { SectionId, SubsectionId } from "@/sections";

type TheoryCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** One concept: a titled card of text, tables and examples. */
export function TheoryCard({ title, description, children, className }: TheoryCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm leading-6">{children}</CardContent>
    </Card>
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
  const { sections } = useNavigation();
  const pages = sections.find((s) => s.id === "practice")?.subsections ?? [];
  const label = (id: string) => pages.find((s) => s.id === id)?.label ?? id;
  return (
    <div className="flex flex-col gap-2 text-sm leading-6">
      <p>{children}</p>
      <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
        <Dumbbell className="size-4 shrink-0" />
        <span>Practise it in Practice:</span>
        {exercises.map((id, i) => (
          <span key={id}>
            <SectionLink section="practice" subsection={id}>
              {label(id)}
            </SectionLink>
            {i < exercises.length - 1 ? "," : ""}
          </span>
        ))}
      </p>
    </div>
  );
}

/** How the app uses a concept, set apart from the theory itself. */
export function InTheApp({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-md border bg-muted/40 p-3 text-muted-foreground">
      <Lightbulb className="mt-1 size-4 shrink-0 text-amber-500" />
      <div className="flex flex-col gap-2">{children}</div>
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
    <div className={cn("overflow-x-auto rounded-md border", className)}>
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-1.5 align-top">
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
