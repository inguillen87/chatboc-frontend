export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Request aborted', 'AbortError');
}

/** Abort only this caller's wait; never cancel shared backend readiness. */
export function waitForAbort<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return task;
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason ?? new DOMException('Request aborted', 'AbortError'));
    if (signal.aborted) { task.catch(() => undefined); stop(); return; }
    signal.addEventListener('abort', stop, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
  });
}
