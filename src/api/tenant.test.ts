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

import { getTenantPublicInfoFlexible, submitTenantTicket } from '@/api/tenant';

const validClaimReceipt = {
  contract_version: 'claims.intake_receipt.v1',
  ok: true,
  persisted: true,
  deduplicated: false,
  request_id: 'req-claim-1',
  claim: {
    id: 123,
    code: 'T-123',
    status: 'nuevo',
    category: 'Alumbrado',
    created_at: '2026-07-28T15:30:00Z',
  },
  access: {
    mode: 'code_pin',
    pin: '804231',
  },
  tracking: {
    path: '/tracking/claim/T-123#pin=804231',
    experience_endpoint: '/api/public/tracking/experience?kind=claim&code=T-123',
    credential_transport: 'x-tracking-pin-header',
    requires_pin: true,
  },
  actions: [
    {
      id: 'track_claim',
      label: 'Ver seguimiento',
      href: '/tracking/claim/T-123#pin=804231',
    },
  ],
};

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

describe('submitTenantTicket', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('uses the canonical endpoint and sends the caller idempotency key', async () => {
    apiFetchMock.mockResolvedValueOnce(validClaimReceipt);

    await expect(
      submitTenantTicket(
        'junin',
        { categoria: 'Alumbrado', descripcion: 'Luminaria apagada' },
        'claim-intake-12345678',
      ),
    ).resolves.toEqual(validClaimReceipt);

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/pwa/app/tickets',
      expect.objectContaining({
        method: 'POST',
        body: { categoria: 'Alumbrado', descripcion: 'Luminaria apagada' },
        headers: { 'Idempotency-Key': 'claim-intake-12345678' },
        tenantSlug: 'junin',
        omitChatSessionId: true,
      }),
    );
  });

  it('fails closed for the current legacy ack without inventing tracking credentials', async () => {
    apiFetchMock.mockResolvedValueOnce({ ticket_id: 123, estado: 'nuevo' });

    await expect(
      submitTenantTicket('junin', { descripcion: 'Bache profundo' }, 'claim-intake-legacy-1'),
    ).rejects.toThrow('comprobante válido');
  });

  it('rejects an unknown receipt contract version', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...validClaimReceipt,
      contract_version: 'claims.intake_receipt.v2',
    });

    await expect(
      submitTenantTicket('junin', { descripcion: 'Bache profundo' }, 'claim-intake-version-1'),
    ).rejects.toThrow('comprobante válido');
  });

  it('rejects tracking links that move the PIN into a query string', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...validClaimReceipt,
      tracking: {
        ...validClaimReceipt.tracking,
        path: '/tracking/claim/T-123?pin=804231',
      },
      actions: [
        {
          id: 'track_claim',
          label: 'Ver seguimiento',
          href: '/tracking/claim/T-123?pin=804231',
        },
      ],
    });

    await expect(
      submitTenantTicket('junin', { descripcion: 'Bache profundo' }, 'claim-intake-query-1'),
    ).rejects.toThrow('comprobante válido');
  });

  it('rejects unsafe idempotency keys before making a request', async () => {
    await expect(
      submitTenantTicket('junin', { descripcion: 'Bache profundo' }, 'bad key'),
    ).rejects.toThrow('clave segura');

    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
