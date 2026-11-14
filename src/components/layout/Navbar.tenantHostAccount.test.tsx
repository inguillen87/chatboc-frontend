import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from './Navbar';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
const state = vi.hoisted(() => ({ tenant: {} as any, user: {} as any, session: {} as any,
  cart: vi.fn(), logout: vi.fn() }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => state.tenant }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }));
vi.mock('@/components/access/SessionAuthorityContext', () => ({ useSessionAuthority: () => state.session }));
vi.mock('@/hooks/usePrivateWorkspacePresentation', () => ({ usePrivateWorkspacePresentation: () => ({ active: false, identity: null }) }));
vi.mock('@/hooks/useCartCount', () => ({ default: (enabled: boolean) => state.cart(enabled) }));
vi.mock('@/context/CapabilitiesContext', () => ({ useCapabilities: () => ({ capabilities: [], hasAnyCapability: () => false }) }));
vi.mock('@/components/auth/ClerkRuntimeContext', () => ({ useClerkRuntime: () => ({ enabled: false }) }));
vi.mock('@/utils/sessionLogout', async original => ({
  ...await original<typeof import('@/utils/sessionLogout')>(), logoutChatbocSession: state.logout,
}));

const actor = (id = 17, slug = 'government-east') => ({
  id: 701, name: 'Synthetic signed-in actor', email: 'synthetic-actor@example.test', rol: 'tenant_admin', tenant_slug: slug,
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id, slug }, values: { nombre_empresa: 'Synthetic private organization' } },
  organization_workspace: { contract_version: 'organization.profile_workspace.v1', tenant: { id, slug }, organization_type: 'gobierno' },
});
function Harness() { const location = useLocation(); return <><Navbar /><output data-testid="path">{location.pathname}</output></>; }
const mount = () => render(<MemoryRouter initialEntries={['/']}><Harness /></MemoryRouter>);
const header = () => screen.getByRole('banner');
const openMobile = () => fireEvent.click(within(header()).getByRole('button', { name: /abrir men/i }));
const expectNoPrivateAccount = () => {
  expect(within(header()).queryByText('Synthetic signed-in actor')).not.toBeInTheDocument();
  expect(within(header()).queryByText('synthetic-actor@example.test')).not.toBeInTheDocument();
  expect(header().querySelector('a[href^="/perfil"]')).toBeNull();
  expect(within(header()).queryByText('Plan y facturación')).not.toBeInTheDocument();
  expect(within(header()).queryByRole('button', { name: /mi cuenta|super admin/i })).not.toBeInTheDocument();
};
beforeEach(() => {
  window.localStorage.clear();
  const binding = tenantHostFixture();
  state.tenant = { hostBinding: binding, currentSlug: binding.tenant.slug, isLoadingTenant: false, tenantError: null,
    tenant: { slug: binding.tenant.slug, nombre: binding.identity.name, tipo: 'gobierno', publishedIdentity: binding.identity } };
  state.user = { user: null, loading: false, organizationProfileVerified: false };
  state.session = { hasVerifiedSession: false, hasBearerSession: false };
  state.cart.mockReset().mockReturnValue(0); state.logout.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.classList.remove('chatboc-mobile-menu-open'); });

describe('account presentation on a verified customer host', () => {
  it.each([[18, 'government-west'], [18, 'government-east']])('withholds actor %s/%s while preserving same-host login and logout', (id, slug) => {
    state.user = { user: actor(id, slug), loading: false, organizationProfileVerified: true };
    state.session = { hasVerifiedSession: true, hasBearerSession: true };
    const before = JSON.stringify(state.user); mount(); openMobile(); expectNoPrivateAccount();
    screen.getAllByRole('link', { name: 'Iniciar sesión' }).forEach(link => expect(link).toHaveAttribute('href', '/login'));
    expect(screen.getByRole('link', { name: state.tenant.hostBinding.identity.name })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]);
    expect(state.logout).toHaveBeenCalledExactlyOnceWith({ clerkEnabled: false });
    expect(screen.getByTestId('path')).toHaveTextContent('/login');
    expect(JSON.stringify(state.user)).toBe(before);
  });
  it('preserves the matching verified customer administrator account', () => {
    state.user = { user: actor(), loading: false, organizationProfileVerified: true };
    state.session = { hasVerifiedSession: true, hasBearerSession: true };
    mount(); expect(within(header()).getByRole('button', { name: /mi cuenta/i })).toBeInTheDocument();
    openMobile(); expect(header().querySelector('a[href^="/perfil"]')).not.toBeNull();
    expect(within(header()).getByText('Plan y facturación')).toBeInTheDocument();
    expect(within(header()).queryByRole('link', { name: 'Ver demo' })).not.toBeInTheDocument();
  });
  it('keeps the public portal and login available to an anonymous visitor', () => {
    mount(); openMobile(); expectNoPrivateAccount();
    screen.getAllByRole('link', { name: 'Iniciar sesión' }).forEach(link => expect(link).toHaveAttribute('href', '/login'));
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    expect(state.cart).toHaveBeenLastCalledWith(false);
  });
  it.each(['loading', 'unverified'])('does not expose account navigation during %s', condition => {
    state.user = { user: actor(), loading: condition === 'loading', organizationProfileVerified: condition !== 'unverified' };
    state.session = { hasVerifiedSession: true, hasBearerSession: true };
    mount(); openMobile(); expectNoPrivateAccount();
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' }).length).toBeGreaterThan(0);
  });
  it('retires the open account surface when the actor becomes foreign without changing the public host', () => {
    state.user = { user: actor(), loading: false, organizationProfileVerified: true };
    state.session = { hasVerifiedSession: true, hasBearerSession: true };
    const view = mount(); openMobile(); expect(header().querySelector('a[href^="/perfil"]')).not.toBeNull();
    state.user = { ...state.user, user: actor(18, 'government-west') };
    view.rerender(<MemoryRouter><Harness /></MemoryRouter>); expectNoPrivateAccount();
    expect(screen.getByRole('link', { name: state.tenant.hostBinding.identity.name })).toHaveAttribute('href', '/');
  });
  it('preserves account presentation on the unbound platform', () => {
    state.tenant = { ...state.tenant, hostBinding: null };
    state.user = { user: actor(18, 'government-west'), loading: false, organizationProfileVerified: true };
    state.session = { hasVerifiedSession: true, hasBearerSession: true };
    mount(); expect(within(header()).getByRole('button', { name: /mi cuenta/i })).toBeInTheDocument();
  });
});
