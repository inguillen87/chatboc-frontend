import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';

const runtime = vi.hoisted(() => ({
  user: null as any, loading: false, hasVerifiedSession: false, organizationProfileVerified: false,
  refreshUser: vi.fn(), list: vi.fn(), update: vi.fn(),
}));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/hooks/useUser', () => ({ useUser: () => runtime }));
vi.mock('@/api/client', () => ({ apiClient: { adminListOrders: runtime.list, adminUpdateOrder: runtime.update } }));
vi.mock('@/hooks/useDateSettings', () => ({ useDateSettings: () => ({ timezone: 'America/Argentina/Buenos_Aires', locale: 'es-AR', updateSettings: vi.fn() }) }));
import PedidosPage from './PedidosPage';

const LocationProbe = () => <output data-testid="location">{useLocation().pathname + useLocation().search}</output>;
const tree = (clerkStatus: 'ready' | 'loading' | 'signed_out' | 'disabled' = 'ready', path = '/pedidos', embedded = false) => (
  <MemoryRouter initialEntries={[path]}>
    <SessionAuthorityProvider value={{ clerkStatus, hasBearerSession: false, hasVerifiedSession: runtime.hasVerifiedSession }}>
      <Routes><Route path="/pedidos" element={<PedidosPage embedded={embedded} />} /><Route path="/login" element={<div>Inicio de sesión</div>} /></Routes><LocationProbe />
    </SessionAuthorityProvider>
  </MemoryRouter>
);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  localStorage.clear();
  runtime.user = { id: 42, email: 'operator@example.invalid', rol: 'admin_municipio', tenant_slug: 'actor-organization' };
  runtime.loading = false; runtime.hasVerifiedSession = true; runtime.organizationProfileVerified = true;
  runtime.list.mockReset().mockResolvedValue([]); runtime.update.mockReset(); runtime.refreshUser.mockReset();
});
const organizationUser = (kind = 'municipio') => ({
  ...runtime.user,
  tipo_chat: 'pyme',
  organization_profile: {
    contract_version: 'organization.profile_settings.v1', tenant: { id: 303, slug: 'actor-organization' },
    values: { nombre_empresa: 'Verified institution', logo_url: null },
  },
  organization_workspace: {
    contract_version: 'organization.profile_workspace.v1', tenant: { id: 303, slug: 'actor-organization' },
    organization_type: kind,
  },
});
describe('municipal Pedidos panel session authority', () => {
  it.each(['municipio', 'gobierno'])('embeds the verified %s order workspace without duplicate page controls', async kind => {
    runtime.user = organizationUser(kind);
    const originalActor = JSON.stringify(runtime.user);
    runtime.list.mockResolvedValue([{ id: 'scoped-order', status: 'nuevo', notes: 'Solicitud de prueba', items: [], created_at: '2026-10-01T12:00:00Z' }]);
    render(tree('ready', '/pedidos?tenant_slug=actor-organization', true));
    await screen.findByText('Solicitud de prueba');
    expect(screen.getByRole('heading', { name: 'Tareas y gestión' })).toBeInTheDocument();
    expect(screen.getByText('Consultá y gestioná los pedidos institucionales de esta organización.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar pedido o contacto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver al Perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver Tickets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel de Pedidos' })).not.toBeInTheDocument();
    expect(runtime.list).toHaveBeenCalledExactlyOnceWith('actor-organization', { status: 'all' });
    expect(runtime.update).not.toHaveBeenCalled();
    expect(JSON.stringify(runtime.user)).toBe(originalActor);
  });
  it('preserves standalone page controls and the direct order route', async () => {
    runtime.user = organizationUser();
    render(tree());
    await screen.findByText('No hay pedidos institucionales');
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al Perfil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver Tickets' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Tareas y gestión' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/pedidos');
  });
  it.each(['foreign-selection', 'foreign-contract', 'company'])('does not apply municipal presentation from a %s identity', async condition => {
    runtime.user = organizationUser(condition === 'company' ? 'empresa' : 'municipio');
    if (condition === 'foreign-contract') runtime.user.organization_workspace.tenant.id = 404;
    const path = condition === 'foreign-selection' ? '/pedidos?tenant_slug=selected-organization' : '/pedidos';
    render(tree('ready', path, true));
    await screen.findByText('No hay pedidos');
    expect(screen.getByRole('heading', { name: 'Operacion de pedidos' })).toBeInTheDocument();
    expect(screen.queryByText('Consultá y gestioná los pedidos institucionales de esta organización.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tareas y gestión' })).not.toBeInTheDocument();
    expect(runtime.list).toHaveBeenCalledExactlyOnceWith(condition === 'foreign-selection' ? 'selected-organization' : 'actor-organization', { status: 'all' });
  });
  it('loads orders with the verified Clerk cookie session and actor scope without a local bearer', async () => {
    localStorage.setItem('tenantSlug', 'unrelated-public-organization');
    render(tree());
    await screen.findByText('No hay pedidos');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(runtime.list).toHaveBeenCalledExactlyOnceWith('actor-organization', { status: 'all' });
    expect(screen.getByTestId('location')).toHaveTextContent('/pedidos');
  });
  it('keeps an explicit tenant route selected independently of ambient public presentation', async () => {
    render(tree('ready', '/pedidos?tenant_slug=selected-organization'));
    await screen.findByText('No hay pedidos');
    expect(runtime.list).toHaveBeenCalledExactlyOnceWith('selected-organization', { status: 'all' });
  });
  it('waits for Clerk and the verified profile without redirecting or querying orders', async () => {
    runtime.hasVerifiedSession = false; runtime.organizationProfileVerified = false; runtime.user = null;
    const page = render(tree('loading'));
    expect(screen.getByText('Validando acceso')).toBeInTheDocument();
    expect(runtime.list).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/pedidos');
    runtime.user = { id: 42, rol: 'admin', tenant_slug: 'actor-organization' };
    runtime.hasVerifiedSession = true; runtime.organizationProfileVerified = true;
    page.rerender(tree());
    await screen.findByText('No hay pedidos');
    expect(runtime.list).toHaveBeenCalledOnce();
  });
  it('does not accept a persisted Clerk marker as a verified session', async () => {
    localStorage.setItem('authProvider', 'clerk'); localStorage.setItem('clerkUserId', 'synthetic-marker');
    runtime.hasVerifiedSession = false; runtime.organizationProfileVerified = false; runtime.user = null;
    render(tree('signed_out'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?next=%2Fpedidos'));
    expect(runtime.list).not.toHaveBeenCalled();
  });
  it('blocks an unverified profile and an end-user role without granting permissions from storage', async () => {
    runtime.organizationProfileVerified = false;
    const page = render(tree());
    expect(screen.getByText('No pudimos validar el acceso')).toBeInTheDocument();
    expect(runtime.list).not.toHaveBeenCalled();
    runtime.organizationProfileVerified = true; runtime.user.rol = 'usuario';
    page.rerender(tree());
    expect(screen.getByText('No tenés acceso a los pedidos')).toBeInTheDocument();
    expect(runtime.list).not.toHaveBeenCalled();
  });
  it('redirects when session authority is retired after a real profile denial', async () => {
    const page = render(tree());
    await screen.findByText('No hay pedidos');
    runtime.hasVerifiedSession = false; runtime.organizationProfileVerified = false; runtime.user = null;
    page.rerender(tree('signed_out'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?next=%2Fpedidos'));
    expect(runtime.list).toHaveBeenCalledOnce();
    expect(screen.queryByText('No hay pedidos')).not.toBeInTheDocument();
  });
});
