import { useEffect, useState } from "react";

import { type ExampleRequest, type TheoryExample, theoryExample } from "@/lib/engine";
import { useEngine } from "@/providers/audio-engine-context";

/** `request` spelled by the engine for the saved instrument; refreshed when
 * either changes. */
export function useTheoryExample(request: ExampleRequest) {
  const instrument = useEngine().settings.instrument;
  const [example, setExample] = useState<TheoryExample | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Requests are built inline; ask again only when one differs.
  const key = JSON.stringify([instrument, request]);

  useEffect(() => {
    let alive = true;
    theoryExample(instrument, request)
      .then((e) => {
        if (!alive) return;
        setExample(e);
        setError(null);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [key]);

  return { example, error };
}
