import { useState } from "react";
import { AudioLines } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SECTIONS, type SectionId } from "@/sections";

const LAST_SECTION_KEY = "music-teacher:section";

function initialSection(): SectionId {
  try {
    const saved = localStorage.getItem(LAST_SECTION_KEY);
    const match = SECTIONS.find((s) => s.id === saved);
    if (match) return match.id;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return SECTIONS[0].id;
}

/** App shell: main menu plus the active section. Audio is unaffected by navigation. */
function App() {
  const [active, setActive] = useState<SectionId>(initialSection);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  const select = (id: SectionId) => {
    setActive(id);
    try {
      localStorage.setItem(LAST_SECTION_KEY, id);
    } catch {
      // Not remembered across restarts; harmless.
    }
  };

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
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const selected = id === active;
          return (
            <Button
              key={id}
              variant={selected ? "secondary" : "ghost"}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "justify-start gap-3",
                selected ? "font-semibold" : "text-muted-foreground",
              )}
              onClick={() => select(id)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          );
        })}
      </nav>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{section.label}</h1>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </header>
        <section.Screen />
      </main>
    </div>
  );
}

export default App;
