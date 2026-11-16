import { AudioLines, ChevronRight } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/providers/navigation-context";
import { subsectionsOf } from "@/sections";

/** App shell: main menu (sections, and the selected section's subsections)
 * plus the page shown. Audio is unaffected by navigation. */
function App() {
  const { sections, section, subsection, go } = useNavigation();
  const Content = subsection?.Component ?? section.Screen;

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Main menu"
        className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-1 border-r bg-muted/30 p-3"
      >
        <div className="mb-4 flex items-center gap-2 px-2 pt-2 font-semibold">
          <AudioLines className="size-5 text-emerald-500" />
          Music Teacher
        </div>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const selected = s.id === section.id;
            const subs = subsectionsOf(s);
            const open = selected && subs.length > 0;
            return (
              <div key={s.id} className="flex flex-col gap-1">
                <Button
                  variant={selected ? "secondary" : "ghost"}
                  aria-current={selected && subs.length === 0 ? "page" : undefined}
                  aria-expanded={subs.length > 0 ? open : undefined}
                  className={cn(
                    "justify-start gap-3",
                    selected ? "font-semibold" : "text-muted-foreground",
                  )}
                  onClick={() => go(s.id)}
                >
                  <Icon className="size-4" />
                  {s.label}
                  {subs.length > 0 && (
                    <ChevronRight
                      className={cn("ml-auto size-4 transition-transform", open && "rotate-90")}
                    />
                  )}
                </Button>
                {open && (
                  <ul
                    aria-label={`${s.label} sections`}
                    className="mb-1 ml-[1.1rem] flex flex-col gap-0.5 border-l pl-2"
                  >
                    {subs.map((sub) => {
                      const current = sub.id === subsection?.id;
                      return (
                        <li key={sub.id}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "h-8 w-full justify-start px-2 font-normal",
                              current
                                ? "bg-secondary font-medium text-foreground"
                                : "text-muted-foreground",
                            )}
                            onClick={() => go(s.id, sub.id)}
                          >
                            {sub.label}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <ThemeToggle className="mt-2" />
      </nav>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
        <header>
          {subsection && (
            <p className="text-sm font-medium text-muted-foreground">{section.label}</p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">
            {subsection?.label ?? section.label}
          </h1>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </header>
        {Content && <Content key={`${section.id}/${subsection?.id ?? ""}`} />}
      </main>
    </div>
  );
}

export default App;
