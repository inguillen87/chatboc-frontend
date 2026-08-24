import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock, MockApiError } = vi.hoisted(() => {
  class LocalMockApiError extends Error {
    status: number;
    body: unknown;
    requestId?: string;

    constructor(message: string, status: number, body: unknown, requestId?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
      this.requestId = requestId;
    }
  }

  return {
    apiFetchMock: vi.fn(),
    MockApiError: LocalMockApiError,
  };
});

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: MockApiError,
}));

import { getDemoCatalog } from '@/features/demo/demoApi';
import {
  DEMO_CATALOG_MEMORY_CACHE_MAX_AGE_MS,
  invalidateDemoCatalogRequestCache,
  requestDemoCatalog,
} from '@/services/demoCatalogRequest';
import { enterpriseService } from '@/services/enterpriseService';

const selectorPayload = {
  contract_version: 'demo.catalog.v2',
  sectors: ['gobierno', 'empresas', 'educacion'],
  sector_groups: [
    { key: 'gobierno', label: 'Gobiernos' },
    { key: 'empresas', label: 'Empresas' },
    { key: 'educacion', label: 'Colegios' },
  ],
  rubros: [],
};

const responseWithHeaders = (headers: Record<string, string>): Response => {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    headers: {
      get: (name: string) => normalizedHeaders.get(name.toLowerCase()) ?? null,
    },
  } as Response;
};

const applyPublicCacheHeaders = (
  options: { onResponse?: (response: Response) => void } | undefined,
  cacheControl = 'public, max-age=300',
) => {
  options?.onResponse?.(
    responseWithHeaders({
      'cache-control': cacheControl,
      etag: '"selector-v1"',
    }),
  );
};

describe('demo catalog shared request cache', () => {
  beforeEach(() => {
    vi.useRealTimers();
    invalidateDemoCatalogRequestCache({ revalidate: false });
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    invalidateDemoCatalogRequestCache({ revalidate: false });
  });

  it('coalesces concurrent feature and enterprise consumers into one public request', async () => {
    let resolveRequest!: (value: typeof selectorPayload) => void;
    const pendingResponse = new Promise<typeof selectorPayload>((resolve) => {
      resolveRequest = resolve;
    });
    apiFetchMock.mockImplementationOnce(
      (_path: string, options: { onResponse?: (response: Response) => void }) => {
        applyPublicCacheHeaders(options);
        return pendingResponse;
      },
    );

    const featureConsumer = getDemoCatalog();
    const enterpriseConsumer = enterpriseService.getDemoCatalog();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/demo/catalog?response_profile=selector',
      {
        cache: 'default',
        omitChatSessionId: true,
        omitCredentials: true,
        omitEntityToken: true,
        omitTenant: true,
        onResponse: expect.any(Function),
        skipAuth: true,
      },
    );

    resolveRequest(selectorPayload);
    const [featureCatalog, enterpriseCatalog] = await Promise.all([
      featureConsumer,
      enterpriseConsumer,
    ]);

    expect(featureCatalog.sectors).toEqual(['gobierno', 'empresas', 'educacion']);
    expect(enterpriseCatalog).toMatchObject({ contract_version: 'demo.catalog.v2' });
  });

  it('does not cache a failed request and allows the next consumer to recover', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('catalog unavailable'));

    await expect(requestDemoCatalog()).rejects.toThrow('catalog unavailable');

    apiFetchMock.mockImplementationOnce(
      async (_path: string, options: { onResponse?: (response: Response) => void }) => {
        applyPublicCacheHeaders(options);
        return selectorPayload;
      },
    );

    await expect(requestDemoCatalog()).resolves.toMatchObject({
      contract_version: 'demo.catalog.v2',
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('never stores the legacy ensure-users response in memory or the browser cache', async () => {
    apiFetchMock.mockResolvedValue(selectorPayload);

    await requestDemoCatalog({ ensureUsers: true });
    await requestDemoCatalog({ ensureUsers: true });

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(apiFetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('expires the memory entry at the shorter client cap while preserving HTTP cache semantics', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-08-24T02:00:00.000Z');
    vi.setSystemTime(startedAt);
    apiFetchMock.mockImplementation(
      async (_path: string, options: { onResponse?: (response: Response) => void }) => {
        applyPublicCacheHeaders(options, 'public, max-age=300');
        return selectorPayload;
      },
    );

    await requestDemoCatalog();
    vi.setSystemTime(startedAt.getTime() + DEMO_CATALOG_MEMORY_CACHE_MAX_AGE_MS - 1);
    await requestDemoCatalog();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(startedAt.getTime() + DEMO_CATALOG_MEMORY_CACHE_MAX_AGE_MS);
    await requestDemoCatalog();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: 'default' });
  });

  it('invalidates cached and in-flight generations and revalidates through the browser ETag cache', async () => {
    let resolveStaleRequest!: (value: Record<string, unknown>) => void;
    const staleResponse = new Promise<Record<string, unknown>>((resolve) => {
      resolveStaleRequest = resolve;
    });
    apiFetchMock.mockImplementationOnce(
      (_path: string, options: { onResponse?: (response: Response) => void }) => {
        applyPublicCacheHeaders(options);
        return staleResponse;
      },
    );

    const staleConsumer = requestDemoCatalog<Record<string, unknown>>();
    invalidateDemoCatalogRequestCache();

    apiFetchMock.mockImplementationOnce(
      async (_path: string, options: { onResponse?: (response: Response) => void }) => {
        applyPublicCacheHeaders(options);
        return { ...selectorPayload, request_id: 'fresh' };
      },
    );
    const freshCatalog = await requestDemoCatalog<Record<string, unknown>>();

    expect(freshCatalog.request_id).toBe('fresh');
    expect(apiFetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-cache' });

    resolveStaleRequest({ ...selectorPayload, request_id: 'stale' });
    await staleConsumer;

    const cachedAfterStaleCompletion = await requestDemoCatalog<Record<string, unknown>>();
    expect(cachedAfterStaleCompletion.request_id).toBe('fresh');
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps explicit ETag revalidation enabled when the first refresh fails', async () => {
    invalidateDemoCatalogRequestCache();
    apiFetchMock.mockRejectedValueOnce(new Error('temporary network failure'));

    await expect(requestDemoCatalog()).rejects.toThrow('temporary network failure');

    apiFetchMock.mockImplementationOnce(
      async (_path: string, options: { onResponse?: (response: Response) => void }) => {
        applyPublicCacheHeaders(options);
        return selectorPayload;
      },
    );
    await requestDemoCatalog();

    expect(apiFetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-cache' });
    expect(apiFetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-cache' });
  });
});
