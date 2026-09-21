import { readRuntimeRecoveryUI, type RuntimeRecoveryUI } from '@/config/runtimeRecovery';

let cached: RuntimeRecoveryUI | null = null;
let pending: Promise<RuntimeRecoveryUI | null> | null = null;
let generation = 0;
export const getRuntimeRecoveryUI = (): RuntimeRecoveryUI | null => cached;

/** Public, same-origin configuration shared for this document only.
 * This is not a connectivity receipt and never reads/writes tenant or session storage.
 */
export function loadRuntimeRecoveryUI(): Promise<RuntimeRecoveryUI | null> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  const current = generation;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, 8000);
  });
  const request = async (): Promise<RuntimeRecoveryUI | null> => {
    try {
      const response = await fetch('/api/config/runtime-recovery', {
        method: 'GET', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
      const body = await response.text();
      if (body.length > 16384) return null;
      return readRuntimeRecoveryUI(JSON.parse(body));
    } catch { return null; }
  };
  const operation = Promise.race([request(), deadline]).then(copy => {
    if (current === generation && copy) cached = copy;
    return copy;
  }).finally(() => {
    clearTimeout(timer);
    if (pending === operation) pending = null;
  });
  pending = operation;
  return operation;
}

export function resetRuntimeRecoveryUIForTests(): void {
  ++generation; cached = null; pending = null;
}
