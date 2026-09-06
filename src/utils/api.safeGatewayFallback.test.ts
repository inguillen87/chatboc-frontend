import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config')>()),
  API_BASE_CANDIDATES: ['/api', 'https://api.chatboc.test'],
  BASE_API_URL: '/api',
  SAME_ORIGIN_PROXY_BASE: '/api',
}));

describe('apiFetch safe gateway fallback', () => {
  const originalFetch = global.fetch;
  let apiFetch: typeof import('@/utils/api').apiFetch;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
    apiFetch = actual.apiFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('moves a GET from a failed same-origin proxy to the direct API candidate', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, total_respuestas: 12 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;

    const response = await apiFetch<{ ok: boolean; total_respuestas: number }>(
      '/api/admin/encuestas/635/analytics/dashboard',
      { method: 'GET', tenantSlug: 'junin' },
    );

    expect(response).toEqual({ ok: true, total_respuestas: 12 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain('/api/admin/encuestas/635/analytics/dashboard');
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain('https://api.chatboc.test/api/admin/encuestas/635/analytics/dashboard');
  });

  it('does not replay a mutating request after an ambiguous gateway failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    ) as unknown as typeof fetch;

    await expect(apiFetch('/api/admin/encuestas/632/publicar', {
      method: 'POST',
      tenantSlug: 'junin',
      suppressInvalidJsonWarning: true,
    })).rejects.toMatchObject({ status: 502 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves Retry-After from the final transient read response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reason_code: 'application_initializing' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '2',
        },
      }),
    ) as unknown as typeof fetch;

    await expect(apiFetch('/api/v2/demo/catalog', {
      method: 'GET',
      suppressInvalidJsonWarning: true,
    })).rejects.toMatchObject({ status: 503, retryAfterMs: 2_000 });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
