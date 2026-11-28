import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';

vi.mock('@/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config')>()),
  API_BASE_CANDIDATES: ['/api', 'https://api.chatboc.test'],
  BASE_API_URL: '/api',
  SAME_ORIGIN_PROXY_BASE: '/api',
}));

describe('apiFetch and a 404 from the backend', () => {
  const originalFetch = global.fetch;
  let apiFetch: typeof import('@/utils/api').apiFetch;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
    apiFetch = actual.apiFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    resetBackendBootstrapGateForTests();
  });

  it('keeps a JSON 404 as the answer instead of replaying the write on another origin', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
    ) as unknown as typeof fetch;

    await expect(apiFetch('/api/admin/tenants/demo/vouchers/redeem', {
      method: 'POST', body: { code: 'X' }, tenantSlug: 'demo',
    })).rejects.toMatchObject({ status: 404 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('still moves on when the proxy itself is missing (non-JSON 404)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;

    await expect(apiFetch('/api/admin/tenants/demo/catalog', { method: 'GET', tenantSlug: 'demo' })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
