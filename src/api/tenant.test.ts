import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock, MockApiError } = vi.hoisted(() => {
  class MockApiErrorImpl extends Error {
    status: number;
    body?: unknown;

    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }

  return {
    apiFetchMock: vi.fn(),
    MockApiError: MockApiErrorImpl,
  };
});

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: MockApiError,
}));

import { getTenantPublicInfoFlexible } from '@/api/tenant';

describe('getTenantPublicInfoFlexible', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('falls back from /api/pwa/tenant-info to /pwa/tenant-info', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new MockApiError('Not found', 404))
      .mockResolvedValueOnce({
        slug: 'quilmes',
        nombre: 'Municipio de Quilmes',
        tipo: 'municipio',
      });

    const tenant = await getTenantPublicInfoFlexible('quilmes');

    expect(tenant.slug).toBe('quilmes');
    expect(tenant.nombre).toBe('Municipio de Quilmes');
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/pwa/tenant-info?tenant=quilmes',
      expect.objectContaining({ tenantSlug: 'quilmes', skipAuth: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/pwa/tenant-info?tenant=quilmes',
      expect.objectContaining({ tenantSlug: 'quilmes', skipAuth: true }),
    );
  });

  it('does not use legacy /public/tenant fallback when tenant-profile routes fail', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new MockApiError('Not found', 404))
      .mockRejectedValueOnce(new MockApiError('Not found', 404));

    await expect(getTenantPublicInfoFlexible('tenant-inexistente')).rejects.toBeInstanceOf(MockApiError);

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/pwa/tenant-info?tenant=tenant-inexistente',
      expect.objectContaining({ tenantSlug: 'tenant-inexistente', skipAuth: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/pwa/tenant-info?tenant=tenant-inexistente',
      expect.objectContaining({ tenantSlug: 'tenant-inexistente', skipAuth: true }),
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith('/public/tenant', expect.anything());
  });
});
