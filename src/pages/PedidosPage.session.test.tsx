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
const tree = (clerkStatus: 'ready' | 'loading' | 'signed_out' | 'disabled' = 'ready', path = '/pedidos') => (
  <MemoryRouter initialEntries={[path]}>
    <SessionAuthorityProvider value={{ clerkStatus, hasBearerSession: false, hasVerifiedSession: runtime.hasVerifiedSession }}>
      <Routes><Route path="/pedidos" element={<PedidosPage />} /><Route path="/login" element={<div>Inicio de sesión</div>} /></Routes><LocationProbe />
    </SessionAuthorityProvider>
  </MemoryRouter>
);
beforeEach(() => {
  localStorage.clear();
  runtime.user = { id: 42, email: 'operator@example.invalid', rol: 'admin_municipio', tenant_slug: 'actor-organization' };
  runtime.loading = false; runtime.hasVerifiedSession = true; runtime.organizationProfileVerified = true;
  runtime.list.mockReset().mockResolvedValue([]); runtime.update.mockReset(); runtime.refreshUser.mockReset();
});
describe('municipal Pedidos panel session authority', () => {
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
