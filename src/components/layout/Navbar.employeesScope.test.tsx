import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '@/components/layout/Navbar';
import InternalUsers from '@/pages/InternalUsers';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';

const state = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  profileVerified: true, userLoading: false, sessionVerified: true,
  tenant: {} as Record<string, unknown>, currentSlug: 'selected-workspace',
  tenantPending: false, tenantError: null as unknown,
  capabilities: ['employees.read'], read: vi.fn(),
}));
// Keep the actual Link navigation even under the repository's shared test setup.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: state.user, loading: state.userLoading, hasVerifiedSession: state.sessionVerified, organizationProfileVerified: state.profileVerified }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: state.currentSlug, tenant: state.tenant, isLoadingTenant: state.tenantPending, tenantError: state.tenantError }) }));
vi.mock('@/context/CapabilitiesContext', () => ({ useCapabilities: () => ({ capabilities: state.capabilities, hasAnyCapability: (requested: string[]) => requested.some(value => state.capabilities.includes(value)) }) }));
vi.mock('@/hooks/useCartCount', () => ({ default: () => 0 }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: async () => undefined }));
vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: (...args: unknown[]) => state.read(...args) }));
vi.mock('@/components/admin/EmployeeRoutingMatrix', () => ({ default: () => <div>Routing presentation fixture</div> }));

const canonicalActor = (role = 'superadmin') => ({
  id: 71, rol: role, nombre: 'Operador sintético', tenant_slug: 'actor-home', tenant_id: 33, tipo_chat: 'municipio',
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id: 33, slug: 'actor-home' }, values: { nombre_empresa: 'Organización propia sintética' } },
  organization_workspace: { contract_version: 'organization.profile_workspace.v1', tenant: { id: 33, slug: 'actor-home' }, organization_type: 'municipio' },
});
const RouteProbe = () => { const location = useLocation(); return <output data-testid="employee-route">{location.pathname + location.search}</output>; };
function Application({ initial = '/admin/encuestas?tenant_slug=selected-workspace&include_archived=true' }: { initial?: string }) {
  return <SessionAuthorityProvider value={{ hasVerifiedSession: state.sessionVerified, hasBearerSession: state.sessionVerified, clerkStatus: 'ready' }}><MemoryRouter initialEntries={[initial]}><Navbar /><RouteProbe /><Routes><Route path="/admin/encuestas" element={<p>Encuestas sintéticas</p>} /><Route path="/empleados" element={<InternalUsers />} /></Routes></MemoryRouter></SessionAuthorityProvider>;
}
const openMobile = () => fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
async function expectScopedReads(slug: string) {
  await screen.findByText('Empleados, roles y permisos');
  await waitFor(() => expect(state.read).toHaveBeenCalledTimes(3));
  expect(state.read.mock.calls.every(([, options]) => options.tenantSlug === slug && (!options.method || options.method === 'GET') && options.persistTenantSlug === false && options.omitEntityToken === true && options.omitChatSessionId === true && typeof options.isCurrent === 'function')).toBe(true);
  expect(screen.queryByText('Organización del equipo no verificada')).not.toBeInTheDocument();
}

beforeEach(() => {
  state.user = canonicalActor(); state.profileVerified = true; state.userLoading = false; state.sessionVerified = true;
  state.currentSlug = 'selected-workspace'; state.tenantPending = false; state.tenantError = null; state.capabilities = ['employees.read'];
  state.tenant = { id: 22, slug: 'selected-workspace', tipo: 'municipio', publishedIdentity: { tenantId: 22, tenantSlug: 'selected-workspace', name: 'Organización elegida sintética' } };
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('navbar_fixture_external_network_forbidden'))));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (media: string) => ({ matches: false, media, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => true }) });
  HTMLElement.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  state.read.mockReset().mockImplementation(async (path: string, options: { method?: string; tenantSlug?: string }) => {
    if (options.method && options.method !== 'GET') throw new Error('navbar_fixture_write_forbidden');
    if (!['selected-workspace', 'actor-home'].includes(options.tenantSlug ?? '')) throw new Error('navbar_fixture_foreign_scope');
    if (path === '/api/admin/employees') return { employees: [], ticket_categories: [{ id: 2, nombre: 'Tema sintético' }] };
    if (path === `/api/v2/tenants/${options.tenantSlug}/employee-coverage`) return { categories: [], zones: [], channels: [] };
    if (path === `/api/v2/tenants/${options.tenantSlug}/employee-routing`) return { dimensions: {}, employees: [], queues: { unassigned_count: 0 } };
    throw new Error('navbar_fixture_unplanned_read');
  });
});
afterEach(() => { cleanup(); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe('verified employee workspace account navigation', () => {
  it('desktop carries the selected verified municipal scope through the real link into the guarded page', async () => {
    render(<Application />); expect(state.read).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: /Mi cuenta/i }), { key: 'Enter' });
    const link = await screen.findByRole('menuitem', { name: 'Empleados' });
    expect(link).toHaveAttribute('href', '/empleados?tenant_slug=selected-workspace');
    fireEvent.click(link); await expectScopedReads('selected-workspace');
    expect(screen.getByTestId('employee-route')).toHaveTextContent('/empleados?tenant_slug=selected-workspace');
  });
  it('mobile carries the same verified selection into the guarded employee page', async () => {
    render(<Application />); openMobile(); expect(state.read).not.toHaveBeenCalled();
    const link = screen.getByRole('link', { name: 'Empleados' });
    expect(link).toHaveAttribute('href', '/empleados?tenant_slug=selected-workspace');
    fireEvent.click(link); await expectScopedReads('selected-workspace');
  });
  it.each(['tenant-pending','tenant-error','metadata-mismatch','published-mismatch','profile-unverified','profile-loading','malformed-query','conflicting-duplicate-query'])('offers no employee destination before a selected workspace is verified: %s', kind => {
    let initial: string | undefined;
    if (kind === 'tenant-pending') state.tenantPending = true;
    if (kind === 'tenant-error') state.tenantError = new Error('synthetic metadata error');
    if (kind === 'metadata-mismatch') state.currentSlug = 'foreign-workspace';
    if (kind === 'published-mismatch') state.tenant = { ...state.tenant, publishedIdentity: { tenantId: 99, tenantSlug: 'foreign-workspace', name: 'Foreign synthetic organization' } };
    if (kind === 'profile-unverified') state.profileVerified = false;
    if (kind === 'profile-loading') state.userLoading = true;
    if (kind === 'malformed-query') initial = '/admin/encuestas?tenant_slug=%2Fforeign-workspace';
    if (kind === 'conflicting-duplicate-query') initial = '/admin/encuestas?tenant_slug=selected-workspace&tenant_slug=foreign-workspace';
    render(<Application initial={initial} />); openMobile();
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument();
    expect(state.read).not.toHaveBeenCalled();
  });
  it.each(['tenant_admin','admin_municipio'])('keeps a verified ordinary %s on the actor organization despite foreign public metadata/query', async role => {
    state.user = canonicalActor(role);
    render(<Application initial="/admin/encuestas?tenant_slug=selected-workspace" />); openMobile();
    const link = screen.getByRole('link', { name: 'Empleados' });
    expect(link).toHaveAttribute('href', '/empleados?tenant_slug=actor-home');
    expect(state.read).not.toHaveBeenCalled(); fireEvent.click(link); await expectScopedReads('actor-home');
  });
  it('does not offer an employee destination from a contradictory ordinary profile identity', () => {
    const actor = canonicalActor('tenant_admin'); actor.organization_workspace.tenant.id = 99; state.user = actor;
    render(<Application />); openMobile();
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument(); expect(state.read).not.toHaveBeenCalled();
  });
  it.each([true, false])('preserves the existing employee capability filter: allowed=%s', allowed => {
    state.user = canonicalActor('employee'); state.capabilities = [allowed ? 'employees.read' : 'tickets.read'];
    render(<Application initial="/perfil" />); openMobile();
    if (allowed) expect(screen.getByRole('link', { name: 'Empleados' })).toHaveAttribute('href', '/empleados?tenant_slug=actor-home');
    else expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument();
    expect(state.read).not.toHaveBeenCalled();
  });
  it('retains the platform-global menu without selecting the ambient tenant', () => {
    render(<Application initial="/superadmin" />); openMobile();
    expect(screen.getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('href', '/superadmin?section=organizations');
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument(); expect(state.read).not.toHaveBeenCalled();
  });
});
