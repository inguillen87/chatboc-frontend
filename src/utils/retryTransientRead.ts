const TRANSIENT_READ_STATUSES = new Set([500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS = [250, 750] as const;

const isTransientReadFailure = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const typedError = error as { name?: unknown; status?: unknown };
    if (typedError.name === 'NetworkError') return true;
    const status = Number(typedError.status);
    return TRANSIENT_READ_STATUSES.has(status);
  }

  return false;
};

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });

/**
 * Retry only idempotent demo reads when an edge/runtime cold start fails.
 * Business mutations deliberately do not use this helper.
 */
export const retryTransientRead = async <T>(
  request: () => Promise<T>,
  retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> => {
  let attempt = 0;

  while (true) {
    try {
      return await request();
    } catch (error) {
      const retryDelay = retryDelaysMs[attempt];
      if (retryDelay === undefined || !isTransientReadFailure(error)) throw error;
      attempt += 1;
      await wait(retryDelay);
    }
  }
};
