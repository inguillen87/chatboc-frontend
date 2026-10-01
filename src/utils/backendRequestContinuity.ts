import { ensureBackendRuntimeReady, invalidateBackendRuntimeReady } from './backendBootstrapGate';

export const STARTUP_CONTINUITY_BUDGET_MS = 30_000;

export const isStartupResponse = (response: Response): boolean =>
  response.status === 503 && response.headers.get('X-Chatboc-Bootstrap') === 'initializing';

// This is evidence from the WSGI boundary, not a generic transient HTTP error.
export const hasUndispatchedStartupReceipt = async (response: Response): Promise<boolean> => {
  if (!isStartupResponse(response) || !response.headers.get('Content-Type')?.includes('application/json')) return false;
  const reader = response.clone().body?.getReader();
  if (!reader) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const content = async () => {
    let size = 0;
    let text = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 4096) return false;
        text += decoder.decode(part.value, { stream: true });
      }
      const value = JSON.parse(text + decoder.decode());
      return value?.contract_version === 'chatboc.bootstrap.v1' && value.ok === false &&
        value.status_code === 503 && value.reason_code === 'application_initializing' &&
        value.retryable === true && value.request_dispatched === false && value.action_hint === 'retry_after';
    } catch { return false; }
  };
  try {
    return await Promise.race([content(), new Promise<false>(resolve => {
      timer = setTimeout(() => resolve(false), 2000);
    })]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
  }
};

export const isClerkSessionRequest = (url: string, method: string): boolean => {
  if (method !== 'POST') return false;
  try {
    return ['/api/auth/clerk/session', '/auth/clerk/session'].includes(
      new URL(url, 'https://request.invalid').pathname,
    );
  } catch { return false; }
};

export const abortablePause = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });

type ContinuityOptions = {
  singleAttempt?: boolean;
  isCurrent?: () => boolean;
  fetcher?: typeof fetch;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  ready?: typeof ensureBackendRuntimeReady;
};

/** Same URL and identity only. No network-error, denied, generic 5xx or write replay. */
export const fetchWithStartupContinuity = async (
  url: string, init: RequestInit, options: ContinuityOptions = {},
): Promise<Response> => {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const wait = options.wait ?? abortablePause;
  const ready = options.ready ?? ensureBackendRuntimeReady;
  const method = (init.method ?? 'GET').toUpperCase();
  const clerkExchange = isClerkSessionRequest(url, method);
  const canRecover = !options.singleAttempt && (method === 'GET' || method === 'HEAD' || clerkExchange);
  const signal = init.signal ?? undefined;
  const assertCurrent = () => {
    signal?.throwIfAborted();
    if (options.isCurrent?.() === false) throw new DOMException('Request context retired', 'AbortError');
  };
  const deadline = Date.now() + STARTUP_CONTINUITY_BUDGET_MS;
  for (let attempt = 0; ; attempt += 1) {
    assertCurrent();
    // Never redirect an exchange carrying a Clerk credential.
    const response = await fetcher(url, clerkExchange ? { ...init, redirect: 'error' } : init);
    if (!isStartupResponse(response)) return response;
    invalidateBackendRuntimeReady(url);
    if (!canRecover || attempt >= 2 || !(await hasUndispatchedStartupReceipt(response))) return response;
    assertCurrent();
    const seconds = Number(response.headers.get('Retry-After') ?? '2');
    const delay = Number.isFinite(seconds) && seconds >= 0 ? Math.max(250, seconds * 1000) : 2000;
    // Do not shorten a server-requested wait or continue an expired recovery.
    if (delay > 5000 || Date.now() + delay >= deadline) return response;
    await wait(delay, signal);
    assertCurrent();
    await ready({ baseUrl: url, enabled: true, timeoutMs: Math.min(20_000, deadline - Date.now()) });
    assertCurrent();
    if (Date.now() >= deadline) return response;
  }
};
