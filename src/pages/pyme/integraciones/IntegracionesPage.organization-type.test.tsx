import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IntegracionesPage from './IntegracionesPage';

// Actual page, dispatch controls and notification draft/save flow. All identity
// and transport fixtures are synthetic; no real account or provider is used.
vi.unmock('react-router-dom');
const scope = vi.hoisted(() => ({
  tenant: { slug: 'qa-space', tipo: 'pyme', publishedIdentity: { tenantId: 701, tenantSlug: 'qa-space' } },
  user: {} as Record<string, unknown>,
  loading: false,
  organizationProfileVerified: true,
}));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({
  currentSlug: scope.tenant.slug, tenant: scope.tenant, isLoadingTenant: false, tenantError: null,
}) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({
  user: scope.user, loading: scope.loading, hasVerifiedSession: true,
  organizationProfileVerified: scope.organizationProfileVerified,
}) }));
const api = vi.hoisted(() => ({
  adminGetIntegrations: vi.fn(), adminGetCatalog: vi.fn(), adminGetMercadoPagoCredentials: vi.fn(),
  adminGetNotificationSettings: vi.fn(), adminUpdateNotificationSettings: vi.fn(), get: vi.fn(),
  getFulfillmentConfig: vi.fn(), updateFulfillmentConfig: vi.fn(),
}));
vi.mock('@/api/client', () => ({ apiClient: api }));
vi.mock('@/api/v2/channelActivation', () => ({ fetchTenantChannelActivation: vi.fn(async () => ({
  tenant: { id: 701, slug: 'qa-space' },
  whatsapp_connection: { provider: 'unconfigured', production_ready: false }, channels: [],
})) }));
vi.mock('@/components/admin/ChatCustomizer', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogUploadWizard', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogSpreadsheetEditor', () => ({ default: () => null }));
vi.mock('@/components/integrations/InstitutionalChannelPreview', () => ({ default: () => null }));
vi.mock('@/components/integrations/InstitutionalProfileAccess', () => ({ default: () => null }));
vi.mock('@/components/integrations/WhatsappTechProviderOnboarding', () => ({ default: () => null }));
vi.mock('./IntegrationPreviewDialog', () => ({ default: () => null }));

const organizationUser = (type: string, slug = 'qa-space', id = 701) => ({
  id: 42, rol: 'tenant_admin', tenantSlug: slug, tipo_chat: 'pyme', rubro: 'comercio',
  organization_profile: {
    contract_version: 'organization.profile_settings.v1', tenant: { id, slug },
    values: { nombre_empresa: 'Organización de prueba', logo_url: null },
  },
  organization_workspace: {
    contract_version: 'organization.profile_workspace.v1', tenant: { id, slug }, organization_type: type,
  },
});
const preferences = () => ({
  owner_phone: 'synthetic-owner', telegram_chat_id: 'synthetic-chat',
  notification_settings: { email: true, telegram: false, whatsapp: true, order_created: true },
});
const fixture = (channel = 'whatsapp') => (
  <MemoryRouter initialEntries={[`/t/qa-space/integracion?channel=${channel}`]}>
    <Routes><Route path="/t/:tenant/integracion" element={<IntegracionesPage />} /></Routes>
  </MemoryRouter>
);
const expectInstitutionalChannels = () => {
  for (const label of ['WhatsApp', 'Telegram', 'Email']) {
    expect(screen.getByRole('button', { name: `${label}: pendiente`, exact: true })).toBeVisible();
  }
};
const expectNoCommerce = () => {
  for (const label of ['MercadoLibre', 'Tiendanube', 'Cobros']) {
    expect(screen.queryByRole('button', { name: new RegExp(`^${label}:`) })).not.toBeInTheDocument();
  }
  for (const label of ['Despacho de Pedidos', 'Email de Depósito', 'WhatsApp Logística', 'Cobros y checkout']) {
    expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in organization integration tests'); }));
  scope.tenant = { slug: 'qa-space', tipo: 'pyme', publishedIdentity: { tenantId: 701, tenantSlug: 'qa-space' } };
  scope.user = organizationUser('municipio');
  scope.loading = false; scope.organizationProfileVerified = true;
  api.adminGetIntegrations.mockResolvedValue([]);
  api.adminGetCatalog.mockResolvedValue({});
  api.adminGetMercadoPagoCredentials.mockResolvedValue({});
  api.adminGetNotificationSettings.mockResolvedValue(preferences());
  api.adminUpdateNotificationSettings.mockResolvedValue({});
  api.get.mockResolvedValue({});
  api.getFulfillmentConfig.mockResolvedValue({ tenant: {
    dispatch_email: 'warehouse@example.test', dispatch_phone: 'synthetic-dispatch',
    send_buyer_email: true, send_dispatch_email: true, send_dispatch_whatsapp: true,
  } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('integration presentation follows the selected organization type', () => {
  it.each(['municipio', 'gobierno'])('hides commerce for verified %s despite legacy company fields', async type => {
    scope.user = organizationUser(type);
    render(fixture());
    await screen.findByRole('heading', { name: 'Integraciones y canales' });
    expectNoCommerce(); expectInstitutionalChannels();
    expect(screen.getByText('0/3', { exact: true })).toBeVisible();
    expect(api.getFulfillmentConfig).not.toHaveBeenCalled();
  });

  it('keeps the commerce channels and saved dispatch configuration for a PyME', async () => {
    scope.user = organizationUser('pyme');
    render(fixture());
    await screen.findByText('Despacho de Pedidos', { exact: true });
    expectInstitutionalChannels();
    for (const label of ['MercadoLibre', 'Tiendanube', 'Cobros']) {
      expect(screen.getByRole('button', { name: `${label}: pendiente`, exact: true })).toBeVisible();
    }
    expect(screen.getByText('Email de Depósito', { exact: true })).toBeVisible();
    expect(screen.getByText('WhatsApp Logística', { exact: true })).toBeVisible();
    expect(screen.getByDisplayValue('warehouse@example.test')).toBeVisible();
    expect(screen.getByDisplayValue('synthetic-dispatch')).toBeVisible();
    expect(screen.getByText('0/6', { exact: true })).toBeVisible();
  });

  it.each(['mercadolibre', 'tiendanube', 'mercadopago'])('keeps a government deep link to %s on an institutional channel', async channel => {
    render(fixture(channel));
    await screen.findByRole('heading', { name: 'Integraciones y canales' });
    expectNoCommerce(); expectInstitutionalChannels();
    expect(screen.getByRole('button', { name: 'WhatsApp: pendiente', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the selected backend tenant type when a SuperAdmin belongs to another organization', async () => {
    scope.user = { ...organizationUser('pyme', 'qa-other', 702), rol: 'superadmin' };
    scope.tenant.tipo = 'gobierno';
    render(fixture());
    await screen.findByRole('heading', { name: 'Integraciones y canales' });
    expectNoCommerce(); expectInstitutionalChannels();
  });

  it.each(['loading', 'organizationProfileVerified'] as const)('keeps commerce hidden during a profile refresh with %s pending', async guard => {
    const view = render(fixture('mercadopago'));
    await screen.findByRole('heading', { name: 'Integraciones y canales' });
    expectNoCommerce();
    scope[guard] = guard === 'loading';
    view.rerender(fixture('mercadopago'));
    expectNoCommerce(); expectInstitutionalChannels();
    expect(screen.getByRole('button', { name: 'WhatsApp: pendiente', exact: true })).toHaveAttribute('aria-pressed', 'true');
    scope[guard] = guard !== 'loading';
    view.rerender(fixture('mercadopago'));
    expectNoCommerce();
    expect(api.getFulfillmentConfig).not.toHaveBeenCalled();
  });

  it('withdraws a selected payment panel when the verified profile resolves to government', async () => {
    let rejectPayment!: (reason: unknown) => void;
    api.adminGetMercadoPagoCredentials.mockReturnValue(new Promise((_resolve, reject) => { rejectPayment = reject; }));
    scope.user = organizationUser('pyme');
    const view = render(fixture('mercadopago'));
    await screen.findByText('Cobros y checkout', { exact: true });
    scope.user = organizationUser('municipio');
    view.rerender(fixture('mercadopago'));
    expectNoCommerce();
    expect(screen.getByRole('button', { name: 'WhatsApp: pendiente', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { rejectPayment({ status: 403, body: {
      error: 'plan_required', feature_id: 'mercadopago_checkout', feature: { label: 'Cobros y checkout' },
    } }); });
    expectNoCommerce();
  });

  it('saves only an edited institutional preference and preserves stored commerce settings', async () => {
    const user = userEvent.setup();
    render(fixture('email'));
    const email = await screen.findByRole('switch', { name: 'Notificaciones por Email', exact: true });
    await waitFor(() => expect(email).toBeEnabled());
    await user.click(email);
    await user.click(screen.getByRole('button', { name: 'Guardar Preferencias', exact: true }));
    await waitFor(() => expect(api.adminUpdateNotificationSettings).toHaveBeenCalledTimes(1));
    expect(api.adminUpdateNotificationSettings).toHaveBeenCalledWith(
      'qa-space', { notification_settings: { email: false } },
      { ...preferences(), notification_settings: { ...preferences().notification_settings, email: false } },
      { expectedTenantId: 701, isCurrent: expect.any(Function) },
    );
    expect(api.updateFulfillmentConfig).not.toHaveBeenCalled();
    expectNoCommerce();
  });
});
