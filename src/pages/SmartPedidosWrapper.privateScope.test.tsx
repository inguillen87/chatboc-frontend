import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';

const state = vi.hoisted(() => ({
  user: null as any, loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
  currentSlug: 'public-other', tenant: { slug: 'default', tipo: 'pyme' } as any,
  isLoadingTenant: false, list: vi.fn(), summary: vi.fn(), update: vi.fn(), create: vi.fn(),
}));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ ...state, refreshUser: vi.fn() }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => state }));
vi.mock('@/api/client', () => ({ apiClient: { adminListOrders: state.list, adminListOrdersWithSummary: state.summary, adminUpdateOrder: state.update, adminCreateOrder: state.create } }));
vi.mock('@/hooks/useDateSettings', () => ({ useDateSettings: () => ({ timezone: 'America/Argentina/Buenos_Aires', locale: 'es-AR', updateSettings: vi.fn() }) }));
import SmartPedidosWrapper from './SmartPedidosWrapper';

const tree = (path = '/pedidos') => <MemoryRouter initialEntries={[path]}>
  <SessionAuthorityProvider value={{ clerkStatus: 'ready', hasBearerSession: false, hasVerifiedSession: state.hasVerifiedSession }}>
    <Routes><Route path="/pedidos" element={<SmartPedidosWrapper />} /><Route path="/t/:tenant/pedidos" element={<SmartPedidosWrapper />} /></Routes>
  </SessionAuthorityProvider>
</MemoryRouter>;
beforeEach(() => {
  state.user = { id: 71, rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'private-municipality', tenantSlug: 'private-municipality' };
  state.loading = false; state.hasVerifiedSession = true; state.organizationProfileVerified = true;
  state.currentSlug = 'public-other'; state.tenant = { slug: 'default', tipo: 'pyme' }; state.isLoadingTenant = false;
  state.list.mockReset().mockResolvedValue([]); state.summary.mockReset().mockResolvedValue({ orders: [], summary: null });
  state.update.mockReset(); state.create.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('private order scope after a public tenant visit', () => {
  it('loads only the verified municipal actor orders despite a public pyme default', async () => {
    render(tree());
    await screen.findByText('No hay pedidos');
    expect(state.list).toHaveBeenCalledExactlyOnceWith('private-municipality', { status: 'all' });
    expect(state.summary).not.toHaveBeenCalled();
  });
  it('loads and creates company orders in the verified private scope, never the public currentSlug', async () => {
    state.user = { ...state.user, rol: 'admin_pyme', tipo_chat: 'pyme', tenant_slug: 'private-company', tenantSlug: 'private-company' };
    render(tree());
    await waitFor(() => expect(state.summary).toHaveBeenCalledExactlyOnceWith('private-company', { status: 'all', limit: 100 }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear Pedido' }));
    fireEvent.change(screen.getByPlaceholderText('Juan Pérez'), { target: { value: 'Visitante explícito' } });
    fireEvent.change(screen.getByPlaceholderText('Producto ejemplo'), { target: { value: 'Producto de prueba' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear', exact: true }));
    await waitFor(() => expect(state.create).toHaveBeenCalledOnce());
    expect(state.create.mock.calls[0][0]).toBe('private-company');
    expect(state.list).not.toHaveBeenCalled();
  });
  it('updates only the verified company order scope', async () => {
    state.user = { ...state.user, rol: 'admin_pyme', tipo_chat: 'pyme', tenant_slug: 'private-company', tenantSlug: 'private-company' };
    const order = { id: 'order-synthetic', status: 'confirmed', created_at: '2026-10-01T12:00:00Z', total: 12, items: [] };
    state.summary.mockResolvedValue({ orders: [order], summary: null });
    state.update.mockResolvedValue({ ...order, status: 'shipped' });
    render(tree());
    fireEvent.click(await screen.findByLabelText('Abrir pedido order-synthetic'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Despachado' }));
    await waitFor(() => expect(state.update).toHaveBeenCalledExactlyOnceWith('private-company', 'order-synthetic', { status: 'shipped' }));
    expect(state.create).not.toHaveBeenCalled();
  });
  it('ignores a late company response after private profile scope changes, without replay', async () => {
    state.user = { ...state.user, rol: 'admin_pyme', tipo_chat: 'pyme', tenant_slug: 'private-company', tenantSlug: 'private-company' };
    let resolve!: (value: unknown) => void;
    state.summary.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
    const view = render(tree());
    await waitFor(() => expect(state.summary).toHaveBeenCalledOnce());
    state.user = { ...state.user, tenant_slug: 'second-company', tenantSlug: 'second-company' };
    view.rerender(tree());
    await waitFor(() => expect(state.summary).toHaveBeenCalledTimes(2));
    await act(async () => { resolve({ orders: [{ id: 'old-order', status: 'confirmed', created_at: '2026-10-01T12:00:00Z', items: [] }], summary: null }); });
    expect(screen.queryByLabelText('Abrir pedido old-order')).not.toBeInTheDocument();
    expect(state.summary.mock.calls.map(call => call[0])).toEqual(['private-company', 'second-company']);
    expect(state.create).not.toHaveBeenCalled(); expect(state.update).not.toHaveBeenCalled();
  });
  it.each(['loading', 'unverified', 'no-session'])('does not mount either private order page while %s', async condition => {
    state.loading = condition === 'loading'; state.organizationProfileVerified = condition !== 'unverified'; state.hasVerifiedSession = condition !== 'no-session';
    render(tree());
    await waitFor(() => expect(state.list).not.toHaveBeenCalled());
    expect(state.summary).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Crear Pedido' })).not.toBeInTheDocument();
  });
  it.each(['/t/public-other/pedidos', '/pedidos?tenant_slug=public-other', '/pedidos?tenant=private-municipality&tenant=public-other'])('rejects an explicit foreign or contradictory private selection: %s', async path => {
    render(tree(path));
    await screen.findByText('No pudimos validar la organización de los pedidos');
    expect(state.list).not.toHaveBeenCalled(); expect(state.summary).not.toHaveBeenCalled();
  });
  it('rejects contradictory private profile aliases instead of choosing the first', async () => {
    state.user.tenantSlug = 'public-other'; render(tree());
    await screen.findByText('No pudimos validar la organización de los pedidos');
    expect(state.list).not.toHaveBeenCalled(); expect(state.summary).not.toHaveBeenCalled();
  });
  it('requires a verified explicit selection for a platform administrator', async () => {
    state.user = { id: 72, rol: 'super_admin', tipo_chat: 'pyme' };
    render(tree()); await screen.findByText('No pudimos validar la organización de los pedidos');
    expect(state.summary).not.toHaveBeenCalled();
  });
  it('uses only matching selected tenant metadata for platform administrator company orders', async () => {
    state.user = { id: 72, rol: 'super_admin', tipo_chat: 'municipio' };
    state.tenant = { slug: 'selected-company', tipo: 'pyme' };
    render(tree('/t/selected-company/pedidos'));
    await waitFor(() => expect(state.summary).toHaveBeenCalledExactlyOnceWith('selected-company', { status: 'all', limit: 100 }));
    expect(state.list).not.toHaveBeenCalled();
  });
  it('uses the same verified explicit binding for platform administrator municipal query selection', async () => {
    state.user = { id: 72, rol: 'super_admin', tipo_chat: 'pyme' };
    state.tenant = { slug: 'selected-municipality', tipo: 'municipio' };
    render(tree('/pedidos?tenant=selected-municipality'));
    await screen.findByText('No hay pedidos');
    expect(state.list).toHaveBeenCalledExactlyOnceWith('selected-municipality', { status: 'all' });
    expect(state.summary).not.toHaveBeenCalled();
  });
  it('does not retry a company order denial without its original filters', async () => {
    state.user = { ...state.user, rol: 'admin_pyme', tipo_chat: 'pyme' }; state.summary.mockRejectedValue({ status: 403 });
    render(tree());
    await screen.findByText('Sin pedidos');
    expect(state.summary).toHaveBeenCalledExactlyOnceWith('private-municipality', { status: 'all', limit: 100 });
  });
});
