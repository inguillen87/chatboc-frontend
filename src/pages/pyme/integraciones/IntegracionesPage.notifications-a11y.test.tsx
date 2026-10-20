import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IntegracionesPage from './IntegracionesPage';

// Actual page, Switch and Label. Identity and all API reads below are synthetic;
// no delivery, authorization or production integration is accepted by these tests.
vi.unmock('react-router-dom');
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'qa-office', isLoadingTenant: false,
  tenantError: null, tenant: { slug: 'qa-office', publishedIdentity: { tenantId: 701, tenantSlug: 'qa-office' } } }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: { id: 42 }, loading: false,
  hasVerifiedSession: true, organizationProfileVerified: true }) }));
const api = vi.hoisted(() => ({ adminGetIntegrations: vi.fn(), adminGetNotificationSettings: vi.fn(),
  adminGetCatalog: vi.fn(), adminGetMercadoPagoCredentials: vi.fn(), get: vi.fn(),
  adminUpdateNotificationSettings: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: api }));
vi.mock('@/api/v2/channelActivation', () => ({ fetchTenantChannelActivation: vi.fn().mockResolvedValue({
  tenant: { id: 701, slug: 'qa-office' }, whatsapp_connection: { provider: 'unconfigured', production_ready: false }, channels: [] }) }));
vi.mock('@/components/admin/ChatCustomizer', () => ({ default: () => null }));
vi.mock('@/components/admin/OrderDispatchSettings', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogUploadWizard', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogSpreadsheetEditor', () => ({ default: () => null }));
vi.mock('@/components/integrations/InstitutionalChannelPreview', () => ({ default: () => null }));
vi.mock('@/components/integrations/InstitutionalProfileAccess', () => ({ default: () => null }));
vi.mock('@/components/integrations/WhatsappTechProviderOnboarding', () => ({ default: () => null }));
vi.mock('./IntegrationPreviewDialog', () => ({ default: () => null }));

type Channel = 'email' | 'telegram';
const names = { email: 'Notificaciones por Email', telegram: 'Notificar nueva actividad del canal' };
const saves = { email: 'Guardar Preferencias', telegram: 'Actualizar Alertas' };
const fixture = (channel: Channel, index = 0) => <section data-testid={`instance-${index}`}>
  <MemoryRouter initialEntries={[`/t/qa-office/integraciones?channel=${channel}`]}>
    <Routes><Route path="/t/:tenant/integraciones" element={<IntegracionesPage />} /></Routes>
  </MemoryRouter>
</section>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in notification switch tests'); }));
  api.adminGetIntegrations.mockResolvedValue([]);
  api.adminGetNotificationSettings.mockResolvedValue({ notification_settings: { email: true, telegram: false, whatsapp: false } });
  api.adminGetCatalog.mockResolvedValue({}); api.adminGetMercadoPagoCredentials.mockResolvedValue({}); api.get.mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('notification switch labels — local synthetic reads', () => {
  it.each(['email', 'telegram'] as const)('names and associates the visible %s label', async channel => {
    render(fixture(channel));
    const control = await screen.findByRole('switch', { name: names[channel], exact: true });
    const label = screen.getByText(names[channel], { exact: true });
    expect(control.id).not.toBe(''); expect(label).toHaveAttribute('for', control.id);
    expect(Array.from((control as HTMLButtonElement).labels ?? [])).toEqual([label]);
    expect(control).toHaveAccessibleName(names[channel]);
  });

  it.each(['email', 'telegram'] as const)('clicking the %s label toggles only the draft without saving', async channel => {
    const user = userEvent.setup(); render(fixture(channel));
    const control = await screen.findByRole('switch');
    const initial = channel === 'email' ? 'true' : 'false'; expect(control).toHaveAttribute('aria-checked', initial);
    await user.click(screen.getByText(names[channel], { exact: true }));
    expect(control).toHaveAttribute('aria-checked', initial === 'true' ? 'false' : 'true');
    await user.click(screen.getByText(names[channel], { exact: true })); expect(control).toHaveAttribute('aria-checked', initial);
    expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });

  it.each(['email', 'telegram'] as const)('%s preserves Tab, Space and save placement', async channel => {
    const user = userEvent.setup(); render(fixture(channel));
    const control = await screen.findByRole('switch');
    const save = screen.getByRole('button', { name: saves[channel], exact: true });
    save.focus(); await user.tab({ shift: true }); expect(control).toHaveFocus();
    const before = control.getAttribute('aria-checked'); await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    await user.tab(); expect(save).toHaveFocus(); expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });

  it.each(['email', 'telegram'] as const)('%s IDs are unique and labels stay local across two page instances', async channel => {
    const user = userEvent.setup(); render(<>{fixture(channel, 0)}{fixture(channel, 1)}</>);
    const a = within(screen.getByTestId('instance-0')), b = within(screen.getByTestId('instance-1'));
    const first = await a.findByRole('switch', { name: names[channel], exact: true });
    const second = await b.findByRole('switch', { name: names[channel], exact: true });
    expect(first.id).not.toBe(second.id); expect(first.id).not.toBe(''); expect(second.id).not.toBe('');
    const initial = first.getAttribute('aria-checked'); await user.click(a.getByText(names[channel], { exact: true }));
    expect(first).toHaveAttribute('aria-checked', initial === 'true' ? 'false' : 'true');
    expect(second).toHaveAttribute('aria-checked', initial!);
    await user.click(b.getByText(names[channel], { exact: true }));
    expect(second).toHaveAttribute('aria-checked', initial === 'true' ? 'false' : 'true');
    expect(first).toHaveAttribute('aria-checked', initial === 'true' ? 'false' : 'true');
    expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });
});
