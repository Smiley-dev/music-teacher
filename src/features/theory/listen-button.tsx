import { useState } from "react";
import { Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type ExampleRequest, playTheoryExample } from "@/lib/engine";
import { useEngine } from "@/providers/audio-engine-context";

type ListenButtonProps = {
  request: ExampleRequest;
  label?: string;
  variant?: "default" | "outline";
};

/** Plays an example's notes as the saved instrument sounds them. Pressing
 * again starts it over. */
export function ListenButton({ request, label = "Listen", variant = "outline" }: ListenButtonProps) {
  const { settings } = useEngine();
  const [error, setError] = useState<string | null>(null);
  const listen = () => {
    setError(null);
    playTheoryExample(settings.practice.pitch.instrument, request).catch((e) => setError(String(e)));
  };
  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant={variant} className="w-fit" onClick={listen}>
        <Volume2 />
        {label}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
