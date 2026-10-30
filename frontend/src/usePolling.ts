import { useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Polls `fetcher` every `intervalMs` without ever running two requests at
 * once (the in-flight guard drops a tick if the previous one is still
 * running, so slow responses cannot stack up overlapping loops).
 *
 * Pass a stable `fetcher` (e.g. a module-level function or useCallback).
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
): PollState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null }>(
    { data: null, error: null },
  );
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await fetcher();
        if (!cancelled) setState({ data: result, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            data: prev.data,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetcher, intervalMs]);

  return {
    data: state.data,
    error: state.error,
    loading: state.data === null && state.error === null,
  };
}
