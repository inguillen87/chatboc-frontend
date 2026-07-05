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
import { ApiError } from '@/utils/api';

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
      '/auth/widget/token',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/auth/widget/refresh',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
  });

  it('uses pyme promotion endpoints for marketplace discount operations', async () => {
    apiFetchMock
      .mockResolvedValueOnce([{ id: 'promo-1', nombre_promocion: '10 off', is_active: true }])
      .mockResolvedValueOnce({ id: 'promo-2', nombre_promocion: 'Categoria', is_active: true })
      .mockResolvedValueOnce({ id: 'promo-1', nombre_promocion: '10 off', is_active: false });

    const listed = await apiClient.adminListPromotions(77, 'demo-tenant');
    const created = await apiClient.adminCreatePromotion(
      77,
      {
        nombre_promocion: 'Categoria',
        tipo_promocion: 'PORCENTAJE_CATEGORIA',
        valor_descuento: 15,
      },
      'demo-tenant',
    );
    const toggled = await apiClient.adminTogglePromotion(77, 'promo-1', false, 'demo-tenant');

    expect(listed[0].id).toBe('promo-1');
    expect(created.id).toBe('promo-2');
    expect(toggled.is_active).toBe(false);
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/pymes/77/promociones', { tenantSlug: 'demo-tenant' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/pymes/77/promociones',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/pymes/77/promociones/promo-1/desactivar',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
  });

  it('normalizes tenant integrations returned with backend type fields', async () => {
    apiFetchMock.mockResolvedValueOnce([
      { type: 'MercadoLibre', connected: false },
      { type: 'TiendaNube', status: 'active', last_sync_at: '2026-07-05T03:00:00Z' },
      { type: 'WhatsApp', connected: true, lastSync: '2026-07-05T03:10:00Z' },
    ]);

    const integrations = await apiClient.adminGetIntegrations('junin');

    expect(integrations).toEqual([
      { provider: 'mercadolibre', connected: false, lastSync: undefined },
      { provider: 'tiendanube', connected: true, lastSync: '2026-07-05T03:00:00Z' },
      { provider: 'whatsapp', connected: true, lastSync: '2026-07-05T03:10:00Z' },
    ]);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/junin/integrations', { tenantSlug: 'junin' });
  });

  it('normalizes tenant integrations returned as keyed objects', async () => {
    apiFetchMock.mockResolvedValueOnce({
      MercadoLibre: { connected: true, last_sync: '2026-07-05T03:20:00Z' },
      TiendaNube: { enabled: false },
      WhatsApp: { type: 'WhatsApp Business', active: true },
      UnknownProvider: { connected: true },
    });

    const integrations = await apiClient.adminGetIntegrations('junin');

    expect(integrations).toEqual([
      { provider: 'mercadolibre', connected: true, lastSync: '2026-07-05T03:20:00Z' },
      { provider: 'tiendanube', connected: false, lastSync: undefined },
      { provider: 'whatsapp', connected: true, lastSync: undefined },
    ]);
  });

  it('falls back to legacy widget auth paths only when canonical routes are unavailable', async () => {
    const notFound = new ApiError('Not found', 404, { reason_code: 'not_found' });
    apiFetchMock
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({
        contract_version: 'auth.widget_token.v1',
        token: 'jwt-create-legacy',
        expires_in: 2700,
      })
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({
        contract_version: 'auth.widget_token.v1',
        token: 'jwt-refresh-legacy',
        expires_in: 2700,
      });

    const createAck = await apiClient.createWidgetToken('demo-tenant', { tenant_slug: 'demo-tenant' });
    const refreshAck = await apiClient.refreshWidgetToken('demo-tenant', { tenant_slug: 'demo-tenant' });

    expect(createAck.token).toBe('jwt-create-legacy');
    expect(refreshAck.token).toBe('jwt-refresh-legacy');
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/auth/widget/token',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/auth/widget-token',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      3,
      '/auth/widget/refresh',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      4,
      '/auth/widget-refresh',
      expect.objectContaining({ method: 'POST', tenantSlug: 'demo-tenant' }),
    );
  });

  it('validates public ticket status contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.public_status.v1',
      request_id: 'req-123',
      ticket: {
        nro_ticket: 'M-12345',
        estado: 'en_proceso',
        categoria: 'alumbrado',
        ultima_actualizacion: '2026-01-02T12:00:00Z',
      },
    });

    const result = await apiClient.getPublicTicketStatus('M-12345', '9999', 'municipio');

    expect(result.contract_version).toBe('tickets.public_status.v1');
    expect(result.request_id).toBe('req-123');
    expect(result.ticket.nro_ticket).toBe('M-12345');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/tickets/public/status?code=M-12345&pin=9999', { tenantSlug: 'municipio' });
  });

  it('accepts public ticket status contract on controlled error payloads', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.public_status.v1',
      request_id: 'req-404',
      error: {
        code: 404,
        message: 'Ticket no encontrado.',
      },
    });

    const result = await apiClient.getPublicTicketStatus('M-00000', '9999', 'municipio');

    expect(result.contract_version).toBe('tickets.public_status.v1');
    expect(result.request_id).toBe('req-404');
    expect(result.error).toMatchObject({ code: 404, message: 'Ticket no encontrado.' });
    expect(result.ticket).toBeUndefined();
  });

  it('validates ticket workflow metadata contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.workflow.v1',
      request_id: 'req-workflow',
      tenant_id: 42,
      states: ['nuevo', 'en_proceso', 'cerrado'],
      transitions: {
        nuevo: ['en_proceso', 'cerrado'],
        en_proceso: ['cerrado'],
      },
      final_states: ['cerrado'],
    });

    const result = await apiClient.getTicketWorkflowMetadata('municipio');

    expect(result.contract_version).toBe('tickets.workflow.v1');
    expect(result.request_id).toBe('req-workflow');
    expect(result.states).toEqual(['nuevo', 'en_proceso', 'cerrado']);
    expect(result.transitions.nuevo).toEqual(['en_proceso', 'cerrado']);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/tickets/workflow/metadata',
      expect.objectContaining({
        tenantSlug: 'municipio',
        suppressPanel401Redirect: true,
        baseUrlOverride: expect.any(String),
        omitCredentials: true,
        omitChatSessionId: true,
      }),
    );
  });
});
