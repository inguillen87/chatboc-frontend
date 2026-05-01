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

  it('tries /api/pwa/public/tenant-info before legacy tenant-info endpoints', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new MockApiError('Not found', 404))
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
      '/api/pwa/public/tenant-info?tenant=quilmes',
      expect.objectContaining({ tenantSlug: 'quilmes', skipAuth: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/pwa/tenant-info?tenant=quilmes',
      expect.objectContaining({ tenantSlug: 'quilmes', skipAuth: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/pwa/tenant-info?tenant=quilmes',
      expect.objectContaining({ tenantSlug: 'quilmes', skipAuth: true }),
    );
  });

  it('surfaces actionable pwa tenant resolution failures without legacy fallback', async () => {
    const resolutionError = new MockApiError('tenant_resolution_failed', 404, {
      contract_version: 'pwa.public_tenant_resolution.v1',
      reason_code: 'tenant_resolution_failed',
      action_hint: 'send tenant_slug query param',
      request_id: 'req-tenant',
    });
    apiFetchMock.mockRejectedValueOnce(resolutionError);

    await expect(getTenantPublicInfoFlexible('tenant-inexistente')).rejects.toBe(resolutionError);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/pwa/public/tenant-info?tenant=tenant-inexistente',
      expect.objectContaining({ tenantSlug: 'tenant-inexistente', skipAuth: true }),
    );
  });

  it('supports tenant-profile v1 payload shape with nested tenant object', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'public.tenant_profile.v1',
      tenant: {
        slug: 'colegio-san-martin',
        nombre: 'Colegio San Martín',
        tipo: 'pyme',
      },
    });

    const tenant = await getTenantPublicInfoFlexible('colegio-san-martin');

    expect(tenant.slug).toBe('colegio-san-martin');
    expect(tenant.nombre).toBe('Colegio San Martín');
    expect(tenant.tipo).toBe('pyme');
  });

  it('rejects tenant-profile payloads with unknown contract_version', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'public.tenant_profile.v0',
      tenant: {
        slug: 'quilmes',
        nombre: 'Municipio de Quilmes',
      },
    });

    await expect(getTenantPublicInfoFlexible('quilmes')).rejects.toThrow(
      'Contract version inválida para tenant-profile',
    );
  });

  it('does not use legacy /public/tenant fallback when tenant-profile routes fail', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new MockApiError('Not found', 404))
      .mockRejectedValueOnce(new MockApiError('Not found', 404))
      .mockRejectedValueOnce(new MockApiError('Not found', 404));

    await expect(getTenantPublicInfoFlexible('tenant-inexistente')).rejects.toBeInstanceOf(MockApiError);

    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/pwa/public/tenant-info?tenant=tenant-inexistente',
      expect.objectContaining({ tenantSlug: 'tenant-inexistente', skipAuth: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/pwa/tenant-info?tenant=tenant-inexistente',
      expect.objectContaining({ tenantSlug: 'tenant-inexistente', skipAuth: true }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/pwa/tenant-info?tenant=tenant-inexistente',
      expect.objectContaining({ tenantSlug: 'tenant-inexistente', skipAuth: true }),
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith('/public/tenant', expect.anything());
  });
});
