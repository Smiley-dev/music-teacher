import { AudioLines } from "lucide-react";

import { InputStatus } from "@/components/input-status";
import { InstrumentSelect } from "@/components/instrument-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/providers/navigation-context";
import { subsectionsOf } from "@/sections";

/** App shell: the top bar (sections, instrument, input, theme), the selected
 * section's pages under it, and the page shown. Audio is unaffected by
 * navigation. */
function App() {
  const { sections, section, subsection, go } = useNavigation();
  const Content = subsection?.Component ?? section.Screen;
  const subs = subsectionsOf(section);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-topbar">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-[34px] items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <AudioLines className="size-[18px]" strokeWidth={2.4} aria-hidden />
            </span>
            <span className="font-mono text-[13px] font-bold tracking-[0.14em]">MUSIC TEACHER</span>
          </div>
          <nav
            aria-label="Main menu"
            className="flex flex-wrap gap-1 rounded-[10px] border bg-inset p-1 font-mono text-xs font-bold tracking-[0.1em]"
          >
            {sections.map((s) => {
              const selected = s.id === section.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={selected && subs.length === 0 ? "page" : undefined}
                  aria-expanded={subsectionsOf(s).length > 0 ? selected : undefined}
                  className={cn(
                    "h-9 rounded-[7px] px-4 uppercase transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    selected
                      ? "bg-nav-active text-nav-active-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => go(s.id)}
                >
                  {s.label}
                </button>
              );
            })}
          </nav>
          <div className="flex-1" />
          <InstrumentSelect />
          <InputStatus />
          <ThemeToggle />
        </div>

        {subs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t bg-background/40 px-6 pt-2.5 pb-3">
            <span className="mr-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {section.label} ▸
            </span>
            <ul
              aria-label={`${section.label} sections`}
              className="flex flex-wrap gap-2 font-mono text-xs font-bold tracking-[0.06em]"
            >
              {subs.map((sub) => {
                const current = sub.id === subsection?.id;
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      aria-current={current ? "page" : undefined}
                      onClick={() => go(section.id, sub.id)}
                      className={cn(
                        "flex h-[38px] items-center gap-2 rounded-lg border-b-[3px] px-3.5 uppercase transition-colors",
                        "outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        current
                          ? "border-primary bg-secondary text-foreground"
                          : "border-[var(--key-edge)] bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          current
                            ? "bg-primary shadow-[0_0_8px_var(--primary)]"
                            : "bg-muted-foreground/40",
                        )}
                      />
                      {sub.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-7 pt-5 pb-8">
        <header>
          {subsection && <p className="rack-label tracking-[0.14em]">{section.label}</p>}
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">
            {subsection?.label ?? section.label}
          </h1>
          <p className="text-muted-foreground">{section.description}</p>
        </header>
        {Content && <Content key={`${section.id}/${subsection?.id ?? ""}`} />}
      </main>
    </div>
  );
}

export default App;
