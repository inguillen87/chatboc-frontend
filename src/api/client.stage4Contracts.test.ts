import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: Record<string, unknown>;
    constructor(message: string, status: number, body?: Record<string, unknown>) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

import { apiClient } from '@/api/client';

describe('apiClient stage4 contract integrations', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('validates widget bootstrap contract version and fields', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'auth.widget_bootstrap.v1',
      tenant: { id: 42, slug: 'demo-tenant' },
      widget: { token_cookie_name: 'widget_token', access_minutes: 45, renew_days: 7 },
      jwks: { url: 'https://example.com/jwks.json', alg: 'HS256', kid: 'widget-hs256' },
    });

    const result = await apiClient.getWidgetBootstrap('demo-tenant');

    expect(result.contract_version).toBe('auth.widget_bootstrap.v1');
    expect(result.tenant.slug).toBe('demo-tenant');
    expect(apiFetchMock).toHaveBeenCalledWith('/auth/widget/bootstrap', { tenantSlug: 'demo-tenant' });
  });

  it('validates analytics widget token ack for create and refresh', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        contract_version: 'auth.widget_token.v1',
        token: 'jwt-create',
        expires_in: 2700,
      })
      .mockResolvedValueOnce({
        contract_version: 'auth.widget_token.v1',
        token: 'jwt-refresh',
        expires_in: 2700,
      });

    const createAck = await apiClient.createWidgetToken('demo-tenant', { tenant_slug: 'demo-tenant' });
    const refreshAck = await apiClient.refreshWidgetToken('demo-tenant', { tenant_slug: 'demo-tenant' });

    expect(createAck.token).toBe('jwt-create');
    expect(refreshAck.token).toBe('jwt-refresh');
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/auth/widget-token',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/auth/widget-refresh',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
  });

  it('validates public ticket status contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.public_status.v1',
      ticket: {
        nro_ticket: 'M-12345',
        estado: 'en_proceso',
        categoria: 'alumbrado',
        ultima_actualizacion: '2026-01-02T12:00:00Z',
      },
    });

    const result = await apiClient.getPublicTicketStatus('M-12345', '9999', 'municipio');

    expect(result.contract_version).toBe('tickets.public_status.v1');
    expect(result.ticket.nro_ticket).toBe('M-12345');
    expect(apiFetchMock).toHaveBeenCalledWith('/tickets/public/status?code=M-12345&pin=9999', { tenantSlug: 'municipio' });
  });
});
