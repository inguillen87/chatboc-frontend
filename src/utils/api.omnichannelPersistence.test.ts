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
});
