import { useCallback, useEffect, useState } from 'react';

export const ORDER_REFRESH_DELAYS_MS = [2000, 4000, 8000, 15000, 15000, 15000] as const;
export const ORDER_REQUEST_TIMEOUT_MS = 15000;
export class OrderIdentityError extends Error {}
type PauseReason = 'hidden' | 'offline' | null;
type Loader<T> = (signal: AbortSignal) => Promise<T>;
type Snapshot<T> = {
  scope: string | null; loader: Loader<T>; data: T | null; isLoading: boolean;
  error: string | null; lastCheckedAt: number | null; autoRefreshStopped: boolean;
  pauseReason: PauseReason;
};
const emptySnapshot = <T,>(scope: string | null, loader: Loader<T>): Snapshot<T> => ({
  scope, loader, data: null, isLoading: Boolean(scope), error: null,
  lastCheckedAt: null, autoRefreshStopped: false, pauseReason: null,
});
const pauseReason = (): PauseReason => navigator.onLine === false ? 'offline'
  : document.visibilityState === 'hidden' ? 'hidden' : null;
const inaccessible = (error: unknown) => error instanceof OrderIdentityError || (
  typeof error === 'object' && error !== null && 'status' in error &&
  [401, 403, 404].includes(Number(error.status))
);

/** Bounded reads; same-order refresh retains data, identity/access changes clear it. */
export function useVerifiedOrder<T>(scope: string | null, load: Loader<T>, shouldPoll: (data: T) => boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => emptySnapshot(scope, load));
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!scope) return;
    let active = true, inFlight = false, finished = false, retries = 0;
    let paused = pauseReason();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
    setSnapshot((previous) => ({
      ...(previous.scope === scope && previous.loader === load ? previous : emptySnapshot(scope, load)),
      error: null, isLoading: !paused, autoRefreshStopped: false, pauseReason: paused,
    }));
    const check = async (): Promise<void> => {
      if (!active || inFlight || finished) return;
      clearTimer();
      paused = pauseReason();
      if (paused) {
        setSnapshot((previous) => ({ ...previous, isLoading: false, pauseReason: paused }));
        return;
      }
      inFlight = true;
      request = new AbortController();
      const controller = request;
      setSnapshot((previous) => ({ ...previous, isLoading: true, error: null, pauseReason: null }));
      try {
        const data = await Promise.race([load(controller.signal), new Promise<never>((_, reject) => {
          deadline = setTimeout(() => { controller.abort(); reject(new Error('read_timeout')); }, ORDER_REQUEST_TIMEOUT_MS);
        })]);
        if (!active) return;
        const pending = shouldPoll(data), delay = ORDER_REFRESH_DELAYS_MS[retries];
        finished = !pending || delay === undefined;
        paused = finished ? null : pauseReason();
        setSnapshot({ scope, loader: load, data, isLoading: false, error: null,
          lastCheckedAt: Date.now(), autoRefreshStopped: pending && finished, pauseReason: paused });
        if (!finished) { retries += 1; if (!paused) timer = setTimeout(check, delay); }
      } catch (error) {
        if (!active) return;
        finished = true;
        const denied = inaccessible(error);
        setSnapshot((previous) => ({ ...previous, isLoading: false, pauseReason: null,
          data: denied ? null : previous.data, lastCheckedAt: denied ? null : previous.lastCheckedAt,
          error: denied ? 'No pudimos acceder al pedido. Revisá tu sesión o el enlace.'
            : 'No pudimos verificar el pedido. Reintentá la consulta.', autoRefreshStopped: true }));
      } finally {
        if (deadline !== undefined) clearTimeout(deadline);
        inFlight = false;
      }
    };
    const onAvailability = () => {
      if (!active || finished) return;
      const next = pauseReason(), wasPaused = paused;
      paused = next;
      if (next) clearTimer();
      setSnapshot((previous) => ({ ...previous, pauseReason: next,
        isLoading: inFlight ? previous.isLoading : false }));
      if (!next && wasPaused && !inFlight) void check();
    };
    document.addEventListener('visibilitychange', onAvailability);
    window.addEventListener('online', onAvailability);
    window.addEventListener('offline', onAvailability);
    void check();
    return () => {
      active = false; request?.abort(); clearTimer();
      if (deadline !== undefined) clearTimeout(deadline);
      document.removeEventListener('visibilitychange', onAvailability);
      window.removeEventListener('online', onAvailability);
      window.removeEventListener('offline', onAvailability);
    };
  }, [scope, load, shouldPoll, revision]);
  const current = snapshot.scope === scope && snapshot.loader === load ? snapshot : emptySnapshot(scope, load);
  const { loader: _loader, ...result } = current;
  return { ...result, refresh };
}
