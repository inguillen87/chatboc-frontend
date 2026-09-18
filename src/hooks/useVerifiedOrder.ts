import { useCallback, useEffect, useState } from 'react';

export const ORDER_REFRESH_DELAYS_MS = [2000, 4000, 8000, 15000, 15000, 15000] as const;
type Snapshot<T> = {
  scope: string | null; data: T | null; isLoading: boolean;
  error: string | null; lastCheckedAt: number | null; autoRefreshStopped: boolean;
};
const emptySnapshot = <T,>(scope: string | null): Snapshot<T> => ({
  scope, data: null, isLoading: Boolean(scope), error: null,
  lastCheckedAt: null, autoRefreshStopped: false,
});

/** Sequential, bounded reads. A route/tenant change cannot reveal old data. */
export function useVerifiedOrder<T>(
  scope: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  shouldPoll: (data: T) => boolean,
) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => emptySnapshot<T>(scope));
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    setSnapshot(emptySnapshot<T>(scope));
    const check = async (): Promise<void> => {
      if (controller.signal.aborted) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(check, 15000);
        return;
      }
      setSnapshot((previous) => ({ ...previous, isLoading: true, error: null }));
      try {
        const data = await load(controller.signal);
        if (controller.signal.aborted) return;
        const pending = shouldPoll(data);
        const delay = ORDER_REFRESH_DELAYS_MS[retries];
        setSnapshot({ scope, data, isLoading: false, error: null,
          lastCheckedAt: Date.now(), autoRefreshStopped: pending && delay === undefined });
        if (pending && delay !== undefined) {
          retries += 1;
          timer = setTimeout(check, delay);
        }
      } catch {
        if (controller.signal.aborted) return;
        setSnapshot((previous) => ({ ...previous, isLoading: false,
          error: 'No pudimos verificar el pedido. Reintentá la consulta.', autoRefreshStopped: true }));
      }
    };
    void check();
    return () => { controller.abort(); if (timer !== undefined) clearTimeout(timer); };
  }, [scope, load, shouldPoll, revision]);
  const current = snapshot.scope === scope ? snapshot : emptySnapshot<T>(scope);
  return { ...current, refresh };
}
