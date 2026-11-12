import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PRACTICE_SECTIONS } from "./practice-sections";

export function PracticeScreen() {
  return (
    <Tabs defaultValue={PRACTICE_SECTIONS[0].id} className="flex flex-col gap-6">
      <TabsList>
        {PRACTICE_SECTIONS.map((s) => (
          <TabsTrigger key={s.id} value={s.id}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {PRACTICE_SECTIONS.map(({ id, Component }) => (
        <TabsContent key={id} value={id}>
          <Component />
        </TabsContent>
      ))}
    </Tabs>
  );
}
