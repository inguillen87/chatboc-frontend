import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { invalidateDemoCatalogRequestCache, requestDemoCatalog } from '@/services/demoCatalogRequest';
import { apiFetch } from './api';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';
import { retryTransientRead } from './retryTransientRead';

vi.mock('@/utils/api', async (importOriginal) => importOriginal<typeof import('@/utils/api')>());
vi.mock('@/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config')>()),
  API_BASE_CANDIDATES: ['/api', 'https://api.example.invalid'],
  BASE_API_URL: '/api',
  SAME_ORIGIN_PROXY_BASE: '/api',
}));

const originalFetch = global.fetch;
const backendMessage = 'El servicio de datos no está disponible en este momento.';
const terminal = {
  contract_version: 'shared.error.v1',
  status_code: 503,
  reason_code: 'tenant_context_unavailable',
  retryable: false,
  error: { code: 503, message: backendMessage },
};
const response = (body: unknown, status = 503) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Request-Id': 'availability-request-1',
  },
});

beforeEach(() => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  localStorage.clear();
  sessionStorage.clear();
  invalidateDemoCatalogRequestCache({ revalidate: false });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetBackendBootstrapGateForTests();
  localStorage.clear();
  sessionStorage.clear();
  invalidateDemoCatalogRequestCache({ revalidate: false });
});

describe('non-retryable availability across real read consumers and transport', () => {
  it('stops a catalog read after one request and permits an explicit later retry', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response(terminal));
    global.fetch = fetcher;

    await expect(requestDemoCatalog()).rejects.toMatchObject({
      status: 503,
      message: backendMessage,
      requestId: 'availability-request-1',
      body: { ...terminal, request_id: 'availability-request-1' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    fetcher.mockImplementation(async () => response({ catalog: [] }, 200));
    await expect(requestDemoCatalog()).resolves.toMatchObject({ catalog: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('keeps a bootstrap dependency rejection on its original base and preserves its error body', async () => {
    global.fetch = vi.fn().mockImplementation(async () => response(terminal));

    await expect(apiClient.getWidgetBootstrap('availability-peer')).rejects.toMatchObject({
      status: 503,
      message: backendMessage,
      requestId: 'availability-request-1',
      body: { ...terminal, request_id: 'availability-request-1' },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('retires a read while inspecting a 503 with retryable=%s', async (retryable) => {
    let current = true;
    const first = response({ ...terminal, retryable });
    const clone = first.clone.bind(first);
    vi.spyOn(first, 'clone').mockImplementation(() => {
      current = false;
      return clone();
    });
    global.fetch = vi.fn().mockResolvedValueOnce(first)
      .mockImplementationOnce(async () => response({ stale: true }, 200));

    await expect(apiFetch('/auth/widget/bootstrap', { isCurrent: () => current }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves an abort received while inspecting a terminal 503', async () => {
    const controller = new AbortController();
    const first = response(terminal);
    const clone = first.clone.bind(first);
    vi.spyOn(first, 'clone').mockImplementation(() => {
      controller.abort(new DOMException('Request cancelled', 'AbortError'));
      return clone();
    });
    global.fetch = vi.fn().mockResolvedValueOnce(first)
      .mockImplementationOnce(async () => response({ stale: true }, 200));

    await expect(apiFetch('/auth/widget/bootstrap', { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'explicitly retryable', body: { ...terminal, retryable: true } },
    { name: 'legacy', body: { error: 'Gateway unavailable' } },
  ])('retains base fallback and read backoff for a $name 503', async ({ body }) => {
    const fetcher = vi.fn()
      .mockImplementationOnce(async () => response(body))
      .mockImplementationOnce(async () => response(body))
      .mockImplementationOnce(async () => response({ ok: true }, 200));
    global.fetch = fetcher;
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await expect(retryTransientRead(() => apiFetch('/api/v2/demo/catalog'), [1]))
      .resolves.toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toContain('https://api.example.invalid/');
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1);
  });

  it.each([
    { ...terminal, retryable: 'false' },
    { ...terminal, contract_version: 'unknown.error.v1' },
  ])('does not interpret malformed or unrelated retry policy: %j', async (body) => {
    global.fetch = vi.fn()
      .mockImplementationOnce(async () => response(body))
      .mockImplementationOnce(async () => response({ ok: true }, 200));

    await expect(apiFetch('/auth/widget/bootstrap')).resolves.toMatchObject({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
