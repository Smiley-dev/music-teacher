import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { THEORY_TOPICS } from "./theory-topics";

/** The theory behind every Practice exercise, one topic per tab. */
export function TheoryScreen() {
  return (
    <Tabs defaultValue={THEORY_TOPICS[0].id} className="flex flex-col gap-6">
      <TabsList className="h-auto flex-wrap">
        {THEORY_TOPICS.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {THEORY_TOPICS.map(({ id, Component }) => (
        <TabsContent key={id} value={id}>
          <Component />
        </TabsContent>
      ))}
    </Tabs>
  );
}
