import { useCallback, useEffect, useState } from "react";

import { type InputDeviceInfo, listInputDevices } from "@/lib/engine";

/** The available input devices, with a manual refresh. */
export function useInputDevices() {
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await listInputDevices());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { devices, loading, error, refresh };
}
