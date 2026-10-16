import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstitutionalProfileAccess from './InstitutionalProfileAccess';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, type PanelUser } from '@/stores/panelSessionStore';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { advanceChatbocSessionRevision, captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { TenantConfigBundle } from '@/types/TenantConfig';

// Component authority regression with synthetic verification flags and private GETs.
// Zustand store, session revision, router and profile validation are real; this is
// not a UserProvider integration test, an authenticated route or server acceptance.
const authority = vi.hoisted(() => ({ loading: false, hasVerifiedSession: true, organizationProfileVerified: true }));
const tenant = vi.hoisted(() => ({ currentSlug: 'qa-office',
  tenant: { slug: 'qa-office', nombre: 'Institución sintética' }, isLoadingTenant: false, tenantError: null }));
vi.unmock('react-router-dom');
vi.mock('@/hooks/useUser', async () => {
  const { usePanelSessionStore: useStore } = await import('@/stores/panelSessionStore');
  return { useUser: () => ({ ...authority, user: useStore(state => state.user) }) };
});
vi.mock('@/context/TenantContext', () => ({ useTenant: () => tenant }));
vi.mock('@/services/tenantService', () => ({ tenantService: { getTenantConfig: vi.fn(), updateTenantConfig: vi.fn() } }));
vi.mock('@/components/tenant/TenantDomainSettings', () => ({ TenantDomainSettings: () => null }));

const service = vi.mocked(tenantService);
const actor = (): PanelUser => ({ id: '42', email: 'actor@example.test', tenant_slug: 'actor-home',
  tenantSlug: 'actor-home', rol: 'superadmin', role: 'superadmin', name: 'Actor sintético',
  permissions: ['settings.tenant.write', 'organization.profile.read'],
  capabilities: ['settings.tenant.write', 'organization.profile.read'],
  scopes: ['settings.tenant.write', 'organization.profile.read'] });
const bundle = (name: string): TenantConfigBundle => ({
  tenant: { id: 701, slug: 'qa-office', nombre: name, tipo: 'municipio', plan: 'full' },
  configs: { widget: {}, menu: {}, links: {}, contacts: {} },
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id: 701, slug: 'qa-office' },
    revision: 'a'.repeat(64), can_edit: true, editability: { mode: 'editable', message: 'Descriptor sintético confirmado.' },
    values: { logo_url: '' } },
});
const deferred = () => {
  let resolve!: (value: TenantConfigBundle) => void;
  return { promise: new Promise<TenantConfigBundle>(done => { resolve = done; }), resolve };
};
const fixture = () => <MemoryRouter initialEntries={['/t/qa-office/integracion']}>
  <Routes><Route path="/t/:tenant/integracion" element={<InstitutionalProfileAccess />} /></Routes>
</MemoryRouter>;
const firstGuard = () => {
  const guard = service.getTenantConfig.mock.calls[0][1]!.isCurrent!;
  expect(guard).toBeTypeOf('function');
  return guard;
};
const noWrites = () => expect(service.updateTenantConfig).not.toHaveBeenCalled();
type AuthorityField = 'role' | 'permissions' | 'capabilities' | 'scopes';
const changeAuthority = (field: AuthorityField) => {
  const previous = usePanelSessionStore.getState().user!;
  usePanelSessionStore.getState().setUser(field === 'role'
    ? { ...previous, role: 'tenant_admin', rol: 'tenant_admin' }
    : { ...previous, [field]: ['settings.tenant.write'] });
};

beforeEach(() => {
  vi.clearAllMocks();
  service.getTenantConfig.mockReset();
  service.updateTenantConfig.mockReset();
  advanceChatbocSessionRevision();
  safeLocalStorage.clear();
  authority.loading = false; authority.hasVerifiedSession = true; authority.organizationProfileVerified = true;
  usePanelSessionStore.getState().setAuthToken('synthetic-authority-A');
  usePanelSessionStore.getState().setUser(actor());
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('external_requests_disabled'))));
});
afterEach(() => {
  cleanup();
  noWrites();
  expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  usePanelSessionStore.setState({ authToken: null, user: null });
  safeLocalStorage.clear();
  vi.unstubAllGlobals();
});

const pendingAuthorityCase = async (change: () => void) => {
  const old = deferred(), fresh = deferred();
  service.getTenantConfig.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  render(fixture());
  await waitFor(() => expect(service.getTenantConfig).toHaveBeenCalledTimes(1));
  const guard = firstGuard();
  const revision = captureChatbocSessionRevision();
  let currentBeforeReactCommit = true;
  act(() => {
    change();
    currentBeforeReactCommit = guard();
  });
  // Store retirement must also cover ABA that React never renders in between.
  expect.soft(captureChatbocSessionRevision()).toBe(revision);
  expect.soft(currentBeforeReactCommit).toBe(false);
  expect.soft(guard()).toBe(false);
  await act(async () => { old.resolve(bundle('Descriptor anterior pendiente')); });
  expect.soft(screen.queryByText('Descriptor anterior pendiente')).not.toBeInTheDocument();
  expect.soft(service.getTenantConfig).toHaveBeenCalledTimes(2);
  await act(async () => { fresh.resolve(bundle('Descriptor vigente posterior')); });
  expect.soft(screen.queryByText('Descriptor vigente posterior')).toBeInTheDocument();
  expect.soft(screen.queryByRole('link', { name: 'Perfil institucional' }))
    .toHaveAttribute('href', '/perfil?section=general&tenant_slug=qa-office');
};

const readyAuthorityCase = async (change: () => void) => {
  const fresh = deferred();
  service.getTenantConfig.mockResolvedValueOnce(bundle('Descriptor anterior listo')).mockReturnValueOnce(fresh.promise);
  render(fixture());
  const oldLink = await screen.findByRole('link', { name: 'Perfil institucional' });
  const guard = firstGuard();
  const revision = captureChatbocSessionRevision();
  let currentBeforeReactCommit = true;
  act(() => {
    change();
    currentBeforeReactCommit = guard();
  });
  expect.soft(captureChatbocSessionRevision()).toBe(revision);
  expect.soft(currentBeforeReactCommit).toBe(false);
  expect.soft(guard()).toBe(false);
  expect.soft(screen.queryByText('Descriptor anterior listo')).not.toBeInTheDocument();
  expect.soft(oldLink.isConnected).toBe(false);
  expect.soft(service.getTenantConfig).toHaveBeenCalledTimes(2);
  await act(async () => { fresh.resolve(bundle('Descriptor vigente posterior')); });
  expect.soft(screen.queryByText('Descriptor vigente posterior')).toBeInTheDocument();
  expect.soft(screen.queryByRole('link', { name: 'Perfil institucional' }))
    .toHaveAttribute('href', '/perfil?section=general&tenant_slug=qa-office');
};

describe('profile descriptor retirement with unchanged actor identity — synthetic private reads', () => {
  it.each<AuthorityField>(['role', 'permissions', 'capabilities', 'scopes'])
    ('retires pending same-actor %s before React commit and ignores its late descriptor', async field => {
      await pendingAuthorityCase(() => changeAuthority(field));
    });

  it.each<AuthorityField>(['role', 'permissions', 'capabilities', 'scopes'])
    ('withdraws a ready descriptor after same-actor %s changes until a fresh read', async field => {
      await readyAuthorityCase(() => changeAuthority(field));
    });

  const tokenABA = () => {
    usePanelSessionStore.getState().setAuthToken('synthetic-authority-B');
    usePanelSessionStore.getState().setAuthToken('synthetic-authority-A');
  };
  it('retires pending token A→B→A in one batch without a session revision or intermediate render', async () => {
    await pendingAuthorityCase(tokenABA);
  });
  it('withdraws a ready descriptor after batched token A→B→A until its fresh read', async () => {
    await readyAuthorityCase(tokenABA);
  });

  const actorAuthorityABA = () => {
    const original = usePanelSessionStore.getState().user!;
    changeAuthority('capabilities');
    usePanelSessionStore.getState().setUser(original);
  };
  it('retires pending actor-authority A→B→A even when the final actor object is the original', async () => {
    await pendingAuthorityCase(actorAuthorityABA);
  });
  it('withdraws a ready descriptor after actor-authority A→B→A with no intermediate render', async () => {
    await readyAuthorityCase(actorAuthorityABA);
  });

  const sameAuthorityNewPresentation = () => {
    const original = usePanelSessionStore.getState().user!;
    usePanelSessionStore.getState().setUser({ ...original, name: 'Nombre de presentación actualizado',
      permissions: [...original.permissions], capabilities: [...original.capabilities], scopes: [...original.scopes] });
    usePanelSessionStore.getState().setAuthToken('synthetic-authority-A');
  };
  it('keeps a pending read current when only presentation changes and authority values stay equal', async () => {
    const pending = deferred();
    service.getTenantConfig.mockReturnValueOnce(pending.promise);
    render(fixture());
    await waitFor(() => expect(service.getTenantConfig).toHaveBeenCalledTimes(1));
    const guard = firstGuard();
    act(sameAuthorityNewPresentation);
    expect(guard()).toBe(true);
    await act(async () => { pending.resolve(bundle('Descriptor vigente sin retiro')); });
    expect(await screen.findByText('Descriptor vigente sin retiro')).toBeInTheDocument();
    expect(service.getTenantConfig).toHaveBeenCalledTimes(1);
  });
  it('keeps a ready descriptor without another GET for presentation-only and equal-authority updates', async () => {
    service.getTenantConfig.mockResolvedValueOnce(bundle('Descriptor vigente sin retiro'));
    render(fixture());
    const link = await screen.findByRole('link', { name: 'Perfil institucional' });
    const guard = firstGuard();
    act(sameAuthorityNewPresentation);
    expect(guard()).toBe(true);
    expect(link).toBeInTheDocument();
    expect(screen.getByText('Descriptor vigente sin retiro')).toBeInTheDocument();
    expect(service.getTenantConfig).toHaveBeenCalledTimes(1);
  });
});
