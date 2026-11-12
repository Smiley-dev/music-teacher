import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useLatency } from "@/providers/audio-engine-context";

export function PracticeScreen() {
  const latencyMs = useLatency();

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Construction className="size-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Coming soon</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Practice exercises with timing feedback are on the way.
          {latencyMs === null
            ? " Calibrate your instrument in Settings so timing can be corrected."
            : ` Your saved latency (${Math.round(latencyMs)} ms) will be used to correct timing.`}
        </p>
      </CardContent>
    </Card>
  );
}
