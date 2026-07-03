import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const STORAGE_PREFIX = 'chatboc_omnichannel_identity';

describe('apiFetch omnichannel tenant persistence', () => {
  let realApiFetch: typeof import('@/utils/api').apiFetch;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    const actualApi = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
    realApiFetch = actualApi.apiFetch;
  });

  beforeEach(() => {
    safeLocalStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('persists response identity snapshot using response tenant header', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': 'tenant-b',
          'X-Contact-Key': 'contact-b',
          'X-Conversation-Id': 'conv-b',
        },
      }),
    ) as unknown as typeof fetch;

    await realApiFetch('/public/ping', {
      method: 'GET',
      skipAuth: true,
      omitCredentials: true,
      tenantSlug: 'tenant-a',
    });

    expect(safeLocalStorage.getItem(`${STORAGE_PREFIX}:tenant-a`)).toBeNull();
    const tenantBRecord = safeLocalStorage.getItem(`${STORAGE_PREFIX}:tenant-b`);
    expect(tenantBRecord).not.toBeNull();
    expect(JSON.parse(tenantBRecord as string)).toMatchObject({
      contactKey: 'contact-b',
      conversationId: 'conv-b',
    });
  });

  it('persists payload identity keys using response tenant header when headers are absent', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          contact_key: 'payload-contact',
          conversation_id: 'payload-conv',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Slug': 'tenant-c',
          },
        },
      ),
    ) as unknown as typeof fetch;

    await realApiFetch('/public/ping', {
      method: 'GET',
      skipAuth: true,
      omitCredentials: true,
      tenantSlug: 'tenant-a',
    });

    expect(safeLocalStorage.getItem(`${STORAGE_PREFIX}:tenant-a`)).toBeNull();
    const tenantCRecord = safeLocalStorage.getItem(`${STORAGE_PREFIX}:tenant-c`);
    expect(tenantCRecord).not.toBeNull();
    expect(JSON.parse(tenantCRecord as string)).toMatchObject({
      contactKey: 'payload-contact',
      conversationId: 'payload-conv',
    });
  });

  it('suppresses invalid JSON warnings for optional advisory requests', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    global.fetch = vi.fn().mockResolvedValue(
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: {
          'Content-Type': 'text/html',
        },
      }),
    ) as unknown as typeof fetch;

    await expect(
      realApiFetch('/admin/tickets/44/ai-enrichment', {
        method: 'POST',
        body: { scope: 'municipio' },
        suppressInvalidJsonWarning: true,
      }),
    ).rejects.toMatchObject({ status: 502 });

    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('skips frontend HTML shells for API requests and retries the next backend candidate', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html><body>Vite preview shell</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<html><body>Vite preview shell without /api</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            contract_version: 'operations.heatmap.v1',
            points: [{ lat: -34.58, lng: -60.94, weight: 2 }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ) as unknown as typeof fetch;

    const payload = await realApiFetch<{
      contract_version: string;
      points: Array<{ lat: number; lng: number; weight: number }>;
    }>('/api/v2/analytics/operations/heatmap', {
      method: 'GET',
      skipAuth: true,
      omitCredentials: true,
      tenantSlug: 'junin',
    });

    expect(payload.contract_version).toBe('operations.heatmap.v1');
    expect(payload.points[0]).toMatchObject({ lat: -34.58, lng: -60.94, weight: 2 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/api/v2/analytics/operations/heatmap');
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain('/v2/analytics/operations/heatmap');
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[2][0]).toContain('/api/v2/analytics/operations/heatmap');
  });
});
