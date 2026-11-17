/**
 * Building blocks of the studio-rack look (ADR 0017): panels, the displays
 * set into them, read-outs, lamps and the two-column page layout. Styling
 * only; no state.
 */
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A rack panel: the card every page section sits in. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border bg-card p-4 sm:p-[18px]", className)} {...props} />;
}

/** Small spaced caps over a panel or display ("OPTIONS · SAVED"). `signal`
 * lights it amber, for a state worth noticing. */
export function PanelLabel({
  tone = "muted",
  className,
  children,
}: {
  tone?: "muted" | "signal";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rack-label", tone === "signal" && "text-signal", className)}>
      {children}
    </div>
  );
}

/** A display set into a panel (dark glass in the dark theme). */
export function Display({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border bg-inset px-5 py-5 sm:px-6", className)} {...props} />;
}

export type Tone = "plain" | "signal" | "ok" | "warn" | "bad" | "info" | "pitch";

const TONE_TEXT: Record<Tone, string> = {
  plain: "text-foreground",
  signal: "text-signal",
  ok: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
  info: "text-sky-500",
  pitch: "text-violet-500",
};

/** The text colour of a tone, for read-outs and status lines. */
export const toneText = (tone: Tone) => TONE_TEXT[tone];

/** A labelled number on a small display ("SOLVED 08"). */
export function Readout({
  label,
  value,
  unit,
  tone = "plain",
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-inset px-3 py-2 font-mono", className)}>
      <div className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{label}</div>
      <div
        className={cn(
          "leading-tight font-bold tabular-nums",
          size === "lg" ? "text-[28px]" : "text-2xl",
          TONE_TEXT[tone],
        )}
      >
        {value}
        {unit && <span className="text-[13px] text-muted-foreground"> {unit}</span>}
      </div>
    </div>
  );
}

const LAMP_ON: Record<"ok" | "signal" | "bad" | "info", string> = {
  ok: "bg-emerald-500 shadow-[0_0_8px_var(--color-emerald-500)]",
  signal: "bg-primary shadow-[0_0_8px_var(--primary)]",
  bad: "bg-red-500 shadow-[0_0_8px_var(--color-red-500)]",
  info: "bg-sky-500 shadow-[0_0_8px_var(--color-sky-500)]",
};

/** An LED: lit in its colour, or dark. */
export function Lamp({
  on,
  tone = "ok",
  className,
}: {
  on: boolean;
  tone?: keyof typeof LAMP_ON;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        on ? LAMP_ON[tone] : "bg-muted-foreground/35",
        className,
      )}
    />
  );
}

/** Two columns that stack on narrow windows: the main panel (display,
 * transport) and a narrower one (options). `asideFirst` puts the narrow
 * one on the left. */
export function SplitLayout({
  aside,
  asideFirst = false,
  children,
}: {
  aside: ReactNode;
  asideFirst?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start gap-5", asideFirst && "flex-row-reverse")}>
      <div className="flex min-w-0 flex-[999_1_34rem] flex-col gap-5">{children}</div>
      <div className="flex min-w-0 flex-[1_1_17rem] flex-col gap-5">{aside}</div>
    </div>
  );
}

/** Coloured status strip on a display: the outcome of the last thing played. */
export function StatusStrip({
  tone,
  children,
  className,
}: {
  tone: "ok" | "bad" | "warn" | "info";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-2.5 font-mono text-[13px] font-bold tracking-[0.04em]",
        tone === "ok" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        tone === "bad" && "border-red-500/40 bg-red-500/10 text-red-500",
        tone === "warn" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        tone === "info" && "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
        className,
      )}
    >
      {children}
    </div>
  );
}
