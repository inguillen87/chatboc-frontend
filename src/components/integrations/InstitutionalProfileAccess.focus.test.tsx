import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstitutionalProfileAccess from './InstitutionalProfileAccess';
import { tenantService } from '@/services/tenantService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { TenantConfigBundle } from '@/types/TenantConfig';

const authority = vi.hoisted(() => ({
  session: { loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
    user: { id: 42, tenantSlug: 'junin', role: 'superadmin' } },
  tenant: { currentSlug: 'tierra-del-fuego', tenant: { slug: 'tierra-del-fuego' },
    isLoadingTenant: false, tenantError: null },
}));
vi.unmock('react-router-dom');
vi.mock('@/hooks/useUser', () => ({ useUser: () => authority.session }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => authority.tenant }));
vi.mock('@/services/tenantService', () => ({ tenantService: { getTenantConfig: vi.fn() } }));
vi.mock('@/components/tenant/TenantDomainSettings', () => ({ TenantDomainSettings: () => null }));
vi.mock('@/stores/panelSessionStore', () => ({ usePanelSessionStore: {
  getState: () => ({ authToken: null, user: null }), subscribe: () => () => {},
} }));

const bundle = (name = 'Perfil sintético vigente', slug = 'tierra-del-fuego'): TenantConfigBundle => ({
  tenant: { id: 46, slug, nombre: name, tipo: 'municipio', plan: 'full' },
  configs: { widget: {}, menu: {}, links: {}, contacts: {} },
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id: 46, slug },
    revision: 'a'.repeat(64), can_edit: false, editability: { mode: 'read_only', message: 'Sólo consulta sintética.' },
    values: { logo_url: '' } },
});
const deferred = () => {
  let resolve!: (value: TenantConfigBundle) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<TenantConfigBundle>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const retry = () => screen.getByRole('button', { name: 'Reintentar', exact: true });
const loading = () => screen.getByRole('status');
const result = () => screen.getByRole('link', { name: 'Perfil institucional', exact: true });
let navigate: ReturnType<typeof useNavigate>;
function RouteControls() { navigate = useNavigate(); return null; }
const view = () => <>
  <label>Control anterior<input aria-label="Control anterior" /></label>
  <MemoryRouter initialEntries={['/t/tierra-del-fuego/integracion']}>
    <RouteControls /><Routes><Route path="/t/:tenant/integracion" element={<InstitutionalProfileAccess />} /></Routes>
  </MemoryRouter>
  <label>Otra tarea<input aria-label="Otra tarea" /></label>
</>;
async function begin() {
  const pending = deferred();
  vi.mocked(tenantService.getTenantConfig).mockRejectedValueOnce({ status: 403 }).mockReturnValueOnce(pending.promise);
  const mounted = render(view()), user = userEvent.setup();
  await screen.findByRole('button', { name: 'Reintentar', exact: true });
  retry().focus(); await user.keyboard('{Enter}');
  await waitFor(() => expect(loading()).toHaveFocus());
  expect(tenantService.getTenantConfig).toHaveBeenCalledTimes(2);
  return { pending, mounted, user };
}
const focusHandlers = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter(([type]) => type === 'focusin' || type === 'focusout');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tenantService.getTenantConfig).mockReset();
  authority.session = { loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
    user: { id: 42, tenantSlug: 'junin', role: 'superadmin' } };
  authority.tenant = { currentSlug: 'tierra-del-fuego', tenant: { slug: 'tierra-del-fuego' },
    isLoadingTenant: false, tenantError: null };
  advanceChatbocSessionRevision();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in profile focus tests'); }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('institutional profile retry focus ownership', () => {
  it.each(['success', 'denial'] as const)('transfers the owned retry through loading to its local %s result', async outcome => {
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    const { pending } = await begin();
    const handlers = focusHandlers(add);
    expect(handlers).toHaveLength(2);
    await act(async () => { if (outcome === 'success') pending.resolve(bundle()); else pending.reject({ status: 403 }); });
    await waitFor(() => expect(outcome === 'success' ? result() : retry()).toHaveFocus());
    for (const [type, handler] of handlers) expect(remove).toHaveBeenCalledWith(type, handler);
  });

  it('does not acquire focus during an initial read', async () => {
    const pending = deferred(); vi.mocked(tenantService.getTenantConfig).mockReturnValueOnce(pending.promise);
    render(view()); screen.getByRole('textbox', { name: 'Control anterior' }).focus();
    await act(async () => pending.resolve(bundle()));
    expect(result()).toBeVisible(); expect(screen.getByRole('textbox', { name: 'Control anterior' })).toHaveFocus();
  });

  it('starts a new owned attempt after a rejected retry', async () => {
    const { pending, user } = await begin(), next = deferred();
    await act(async () => pending.reject({ status: 403 })); await waitFor(() => expect(retry()).toHaveFocus());
    vi.mocked(tenantService.getTenantConfig).mockReturnValueOnce(next.promise);
    await user.keyboard('{Enter}'); await waitFor(() => expect(loading()).toHaveFocus());
    await act(async () => next.resolve(bundle())); await waitFor(() => expect(result()).toHaveFocus());
    expect(tenantService.getTenantConfig).toHaveBeenCalledTimes(3);
  });

  it.each([false, true])('never recovers after another control is focused, then blurred=%s', async blur => {
    const { pending } = await begin(), external = screen.getByRole('textbox', { name: 'Otra tarea' });
    act(() => { external.focus(); if (blur) external.blur(); });
    await act(async () => pending.resolve(bundle()));
    expect(result()).toBeVisible(); expect(blur ? document.body : external).toHaveFocus();
  });

  it('retires ownership after voluntary blur from its loading message', async () => {
    const { pending } = await begin(); act(() => loading().blur()); expect(document.body).toHaveFocus();
    await act(async () => pending.resolve(bundle())); expect(result()).not.toHaveFocus(); expect(document.body).toHaveFocus();
  });

  it.each(['forward', 'backward'] as const)('respects voluntary Tab navigation %s during the read', async direction => {
    const { pending, user } = await begin(); await user.keyboard(direction === 'forward' ? '{Tab}' : '{Shift>}{Tab}{/Shift}');
    const target = screen.getByRole('textbox', { name: direction === 'forward' ? 'Otra tarea' : 'Control anterior' });
    expect(target).toHaveFocus(); await act(async () => pending.resolve(bundle())); expect(target).toHaveFocus();
  });

  it('does not capture a programmatic retry while another control owns focus', async () => {
    const pending = deferred(); vi.mocked(tenantService.getTenantConfig).mockRejectedValueOnce({ status: 403 }).mockReturnValueOnce(pending.promise);
    render(view()); await screen.findByRole('button', { name: 'Reintentar' });
    const external = screen.getByRole('textbox', { name: 'Otra tarea' }); external.focus(); fireEvent.click(retry());
    expect(external).toHaveFocus(); await act(async () => pending.resolve(bundle())); expect(result()).toBeVisible(); expect(external).toHaveFocus();
  });

  it.each(['actor', 'session', 'revision', 'tenant'] as const)('retires an owned read before a %s change', async scope => {
    const { pending, mounted } = await begin(), next = deferred();
    const retainedLoadingFocus = vi.spyOn(loading(), 'focus');
    const originalGuard = vi.mocked(tenantService.getTenantConfig).mock.calls[1][1]!.isCurrent!;
    vi.mocked(tenantService.getTenantConfig).mockReturnValueOnce(next.promise);
    await act(async () => {
      if (scope === 'actor') authority.session.user = { ...authority.session.user, id: 99 };
      if (scope === 'session') authority.session.hasVerifiedSession = false;
      if (scope === 'revision') advanceChatbocSessionRevision();
      if (scope === 'tenant') { authority.tenant = { ...authority.tenant, currentSlug: 'junin', tenant: { slug: 'junin' } }; navigate('/t/junin/integracion'); }
      mounted.rerender(view());
    });
    expect(originalGuard()).toBe(false);
    // React can retain the same P node across loading/denied contexts. Retirement
    // must not issue another focus call or reclaim a later voluntary BODY blur.
    expect(retainedLoadingFocus).not.toHaveBeenCalled();
    act(() => { const external = screen.getByRole('textbox', { name: 'Otra tarea' }); external.focus(); external.blur(); });
    await act(async () => pending.resolve(bundle('Lectura retirada')));
    expect(screen.queryByText('Lectura retirada')).not.toBeInTheDocument(); expect(document.body).toHaveFocus();
    if (scope !== 'session') {
      await act(async () => next.resolve(bundle('Lectura nueva', scope === 'tenant' ? 'junin' : undefined)));
      expect(result()).toBeVisible(); expect(result()).not.toHaveFocus(); expect(document.body).toHaveFocus();
    }
  });

  it('removes its attempt listeners and ignores completion after unmount', async () => {
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    const { pending, mounted } = await begin(), handlers = focusHandlers(add);
    mounted.unmount();
    for (const [type, handler] of handlers) expect(remove).toHaveBeenCalledWith(type, handler);
    await act(async () => pending.resolve(bundle())); expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(document.body).toHaveFocus();
  });
});
