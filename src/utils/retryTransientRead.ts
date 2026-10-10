const TRANSIENT_READ_STATUSES = new Set([500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS = [1_000, 1_500, 2_500, 4_000] as const;
const MAX_SERVER_RETRY_AFTER_MS = 5_000;

const isTransientReadFailure = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const typedError = error as { name?: unknown; status?: unknown };
    if (typedError.name === 'NetworkError' || typedError.name === 'TypeError') return true;
    const status = Number(typedError.status);
    return TRANSIENT_READ_STATUSES.has(status);
  }

  return false;
};

const resolveRetryDelay = (error: unknown, fallbackDelayMs: number): number => {
  if (!error || typeof error !== 'object') return fallbackDelayMs;
  const retryAfterMs = Number((error as { retryAfterMs?: unknown }).retryAfterMs);
  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) return fallbackDelayMs;
  return Math.max(fallbackDelayMs, Math.min(retryAfterMs, MAX_SERVER_RETRY_AFTER_MS));
};

const isApplicationInitializingFailure = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const typedError = error as {
    status?: unknown;
    body?: {
      contract_version?: unknown;
      reason_code?: unknown;
      retryable?: unknown;
    };
  };
  return (
    Number(typedError.status) === 503 &&
    typedError.body?.contract_version === 'chatboc.bootstrap.v1' &&
    typedError.body?.reason_code === 'application_initializing' &&
    typedError.body?.retryable === true
  );
};

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });

const retryWithPolicy = async <T>(
  request: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  retryDelaysMs: readonly number[],
): Promise<T> => {
  let attempt = 0;

  while (true) {
    try {
      return await request();
    } catch (error) {
      const retryDelay = retryDelaysMs[attempt];
      if (retryDelay === undefined || !shouldRetry(error)) throw error;
      attempt += 1;
      await wait(resolveRetryDelay(error, retryDelay));
    }
  }
};

/**
 * Retry only idempotent demo reads when an edge/runtime cold start fails.
 * Business mutations deliberately do not use this helper.
 */
export const retryTransientRead = async <T>(
  request: () => Promise<T>,
  retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> => retryWithPolicy(request, isTransientReadFailure, retryDelaysMs);

/**
 * Retry a request only when the backend explicitly proves it was rejected by
 * the WSGI bootstrap before the Flask application could execute it. This is
 * safe for demo POSTs; ambiguous gateway failures are never replayed.
 */
export const retryApplicationInitializingRequest = async <T>(
  request: () => Promise<T>,
  retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> => retryWithPolicy(request, isApplicationInitializingFailure, retryDelaysMs);
