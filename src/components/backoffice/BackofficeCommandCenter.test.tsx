import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackofficeInboxSummaryResponse } from '@/services/backofficeService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const mocks = vi.hoisted(() => ({
  getInboxSummary: vi.fn(),
  getOrdersSummary: vi.fn(),
  getContactsSummary: vi.fn(),
  getTeamCoverageSummary: vi.fn(),
  requestExecutiveSummary: vi.fn(),
  requestExport: vi.fn(),
  authority: { user: { id: 1, rol: 'admin', capabilities: ['tickets.read'], permissions: ['tickets.read'] }, organizationProfileVerified: true },
}));

vi.mock('@/services/backofficeService', () => ({ backofficeService: mocks }));
vi.mock('@/utils/api', () => ({ getErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.authority }));

import BackofficeCommandCenter from './BackofficeCommandCenter';

describe('BackofficeCommandCenter SLA evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestExecutiveSummary.mockReset();
    mocks.requestExport.mockReset();
    mocks.authority = { user: { id: 1, rol: 'admin', capabilities: ['tickets.read'], permissions: ['tickets.read'] }, organizationProfileVerified: true };
    mocks.getOrdersSummary.mockResolvedValue({
      contract_version: 'backoffice.orders_summary.v1', tenant_slug: 'tenant-a',
      summary: { total: 0, active: 0, finalized: 0, unassigned: null }, active_orders: [],
    });
    mocks.getContactsSummary.mockResolvedValue({
      contract_version: 'backoffice.contacts_summary.v1', tenant_slug: 'tenant-a', summary: { total: 1 },
    });
    mocks.getTeamCoverageSummary.mockResolvedValue({
      contract_version: 'backoffice.team_coverage_summary.v1', tenant_slug: 'tenant-a', summary: { active_employees: 1 },
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  const renderSummary = async (summary: BackofficeInboxSummaryResponse['summary']) => {
    mocks.getInboxSummary.mockResolvedValue({
      contract_version: 'backoffice.inbox_summary.v1', tenant_slug: 'tenant-a', summary,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    const risk = screen.getByRole('heading', { name: 'Riesgo SLA confirmado' }).parentElement!.parentElement!;
    const unknown = screen.getByRole('heading', { name: 'SLA sin verificar' }).parentElement!.parentElement!;
    const team = screen.getByRole('heading', { name: 'Equipo activo' }).parentElement!.parentElement!;
    await within(team).findByText('1', { selector: 'p.text-2xl' });
    return { risk, unknown, client, view };
  };

  it('shows 55 unverified cases separately from zero confirmed risk without a healthy signal', async () => {
    const { risk, unknown } = await renderSummary({
      open: 55, sla_risk: 0, sla_breached: 0, sla_at_risk: 0,
      sla_known: 0, sla_unknown: 55, sla_eligible: 55,
    });
    expect(within(risk).getByText('0', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(unknown).getByText('55', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(risk.className).not.toMatch(/emerald|amber/);
    expect(unknown.className).not.toMatch(/emerald/);
    expect(within(unknown).getByText(/sin evidencia verificable/)).toBeInTheDocument();
  });

  it('renders nested zero orders and contacts, and the confirmed team count', async () => {
    mocks.getContactsSummary.mockResolvedValue({
      contract_version: 'backoffice.contacts_summary.v1', tenant_slug: 'tenant-a', summary: { total: 0 },
    });
    await renderSummary({ open: 55, unassigned: 55 });
    for (const name of ['Pedidos activos', 'Contactos']) {
      const card = screen.getByRole('heading', { name }).parentElement!.parentElement!;
      expect(within(card).getByText('0', { selector: 'p.text-2xl' })).toBeInTheDocument();
    }
    const team = screen.getByRole('heading', { name: 'Equipo activo' }).parentElement!.parentElement!;
    expect(within(team).getByText('1', { selector: 'p.text-2xl' })).toBeInTheDocument();
    const unassigned = screen.getByRole('heading', { name: 'Sin responsable' }).parentElement!.parentElement!;
    expect(within(unassigned).getByText('--', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(unassigned.className).not.toContain('emerald');
    expect(within(unassigned).getByText(/Falta información verificable/)).toBeInTheDocument();
  });

  it('uses the server order total rather than the truncated active-order list', async () => {
    mocks.getOrdersSummary.mockResolvedValue({
      contract_version: 'backoffice.orders_summary.v1', tenant_slug: 'tenant-a',
      summary: { active: 103, unassigned: null }, active_orders: Array.from({ length: 25 }, (_, id) => ({ id })),
    });
    await renderSummary({ open: 1 });
    const orders = screen.getByRole('heading', { name: 'Pedidos activos' }).parentElement!.parentElement!;
    expect(within(orders).getByText('103', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(orders).queryByText('25', { selector: 'p.text-2xl' })).not.toBeInTheDocument();
  });

  it('leaves malformed counts unavailable without converting them to zero', async () => {
    mocks.getOrdersSummary.mockResolvedValue({
      contract_version: 'backoffice.orders_summary.v1', tenant_slug: 'tenant-a', summary: { active: '0', unassigned: null },
    });
    mocks.getContactsSummary.mockResolvedValue({
      contract_version: 'backoffice.contacts_summary.v1', tenant_slug: 'tenant-a', summary: { total: -1 },
    });
    await renderSummary({ open: 1 });
    for (const name of ['Pedidos activos', 'Contactos']) {
      const card = screen.getByRole('heading', { name }).parentElement!.parentElement!;
      expect(within(card).getByText('--', { selector: 'p.text-2xl' })).toBeInTheDocument();
    }
  });

  it.each(['actor', 'permissions', 'same-actor-relogin'] as const)('does not reuse a fresh same-tenant cache after %s changes', async change => {
    const { view, client } = await renderSummary({ open: 55 });
    const oldLifecycle = mocks.getTeamCoverageSummary.mock.calls[0][1];
    for (const read of [mocks.getInboxSummary, mocks.getOrdersSummary, mocks.getContactsSummary, mocks.getTeamCoverageSummary]) {
      read.mockImplementation(() => new Promise(() => {}));
    }
    if (change === 'actor') mocks.authority.user = { ...mocks.authority.user, id: 2 };
    else if (change === 'permissions') mocks.authority.user = { ...mocks.authority.user, rol: 'empleado', capabilities: [], permissions: [] };
    else advanceChatbocSessionRevision();
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    await waitFor(() => expect(mocks.getTeamCoverageSummary).toHaveBeenCalledTimes(2));
    const team = screen.getByRole('heading', { name: 'Equipo activo' }).parentElement!.parentElement!;
    expect(within(team).getByText('--', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(team).queryByText('1', { selector: 'p.text-2xl' })).not.toBeInTheDocument();
    expect(oldLifecycle.isCurrent()).toBe(false);
  });

  it('does not read or expose cached Home data while the profile is unverified', async () => {
    const { view, client } = await renderSummary({ open: 55 });
    mocks.authority.organizationProfileVerified = false;
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    expect(screen.queryByRole('region', { name: 'Centro de mando administrativo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument();
    expect(screen.queryByText('55', { selector: 'p.text-2xl' })).not.toBeInTheDocument();
    for (const read of [mocks.getInboxSummary, mocks.getOrdersSummary, mocks.getContactsSummary, mocks.getTeamCoverageSummary]) {
      expect(read).toHaveBeenCalledOnce();
      expect(read.mock.calls[0][1].isCurrent()).toBe(false);
    }
  });

  it.each(['unmount', 'tenant-change'] as const)('retires a pending Home read after %s', async change => {
    let resolveOrders!: (value: unknown) => void;
    mocks.getOrdersSummary.mockImplementationOnce(() => new Promise(resolve => { resolveOrders = resolve; }));
    const { view, client } = await renderSummary({ open: 55 });
    const oldLifecycle = mocks.getOrdersSummary.mock.calls[0][1];
    expect(oldLifecycle.isCurrent()).toBe(true);
    if (change === 'unmount') view.unmount();
    else view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-b" scope="municipio" /></QueryClientProvider>);
    expect(oldLifecycle.isCurrent()).toBe(false);
    await act(async () => resolveOrders({
      contract_version: 'backoffice.orders_summary.v1', tenant_slug: 'tenant-a', summary: { active: 999 },
    }));
    const oldQuery = client.getQueryCache().findAll({ queryKey: ['backoffice-orders-summary', 'tenant-a'] })[0];
    expect(oldQuery.state.data).toBeUndefined();
    expect(screen.queryByText('999', { selector: 'p.text-2xl' })).not.toBeInTheDocument();
  });

  it.each(['actor', 'tenant', 'same-actor-relogin'] as const)('does not display a deferred executive result or resend it after %s changes', async change => {
    let finish!: (value: unknown) => void;
    mocks.requestExecutiveSummary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Resumen IA' }));
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
    const lifecycle = mocks.requestExecutiveSummary.mock.calls[0][1];
    expect(lifecycle.isCurrent()).toBe(true);
    if (change === 'actor') mocks.authority.user = { ...mocks.authority.user, id: 2 };
    else if (change === 'same-actor-relogin') advanceChatbocSessionRevision();
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug={change === 'tenant' ? 'tenant-b' : 'tenant-a'} scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    expect(screen.getByRole('button', { name: 'Resumen IA' })).toBeEnabled();
    await act(async () => finish({ headline: 'Resultado de la autoridad anterior' }));
    expect(screen.queryByText('Resultado de la autoridad anterior')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
  });

  it('does not display an executive error from a retired actor', async () => {
    let fail!: (error: Error) => void;
    mocks.requestExecutiveSummary.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Resumen IA' }));
    mocks.authority.user = { ...mocks.authority.user, id: 2 };
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    await act(async () => fail(new Error('retired response')));
    expect(screen.queryByText('No se pudo generar el resumen IA.')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
  });

  it.each(['tenant-return', 'authority-return'] as const)('does not revive an executive request after %s', async change => {
    let finish!: (value: unknown) => void;
    mocks.requestExecutiveSummary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Resumen IA' }));
    const lifecycle = mocks.requestExecutiveSummary.mock.calls[0][1];
    if (change === 'authority-return') mocks.authority.organizationProfileVerified = false;
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug={change === 'tenant-return' ? 'tenant-b' : 'tenant-a'} scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    mocks.authority.organizationProfileVerified = true;
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    await act(async () => finish({ headline: 'Resultado retirado antes de volver' }));
    expect(screen.queryByText('Resultado retirado antes de volver')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
  });

  it.each(['success', 'error'] as const)('does not open or display a retired export %s', async outcome => {
    let finish!: (value: unknown) => void;
    let fail!: (error: Error) => void;
    mocks.requestExport.mockImplementationOnce(() => new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'PDF casos' }));
    expect(screen.getByText('Preparando tickets-pdf')).toBeInTheDocument();
    const lifecycle = mocks.requestExport.mock.calls[0][1];
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-b" scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    expect(screen.queryByText('Preparando tickets-pdf')).not.toBeInTheDocument();
    await act(async () => outcome === 'success'
      ? finish({ ok: true, download_url: 'https://example.invalid/retired-export.pdf' })
      : fail(new Error('retired export')));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByText('No se pudo preparar la exportacion.')).not.toBeInTheDocument();
    expect(mocks.requestExport).toHaveBeenCalledOnce();
  });

  it('clears previously displayed executive data and error when the actor changes', async () => {
    mocks.requestExecutiveSummary.mockResolvedValueOnce({ headline: 'Resumen del actor anterior' });
    mocks.requestExport.mockRejectedValueOnce(new Error('export failed'));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Resumen IA' }));
    await screen.findByText('Resumen del actor anterior');
    fireEvent.click(screen.getByRole('button', { name: 'PDF casos' }));
    await screen.findByText('No se pudo preparar la exportacion.');
    mocks.authority.user = { ...mocks.authority.user, id: 2 };
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    expect(screen.queryByText('Resumen del actor anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('No se pudo preparar la exportacion.')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
    expect(mocks.requestExport).toHaveBeenCalledOnce();
  });

  it('retires an export on unmount without opening its late download', async () => {
    let finish!: (value: unknown) => void;
    mocks.requestExport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { view } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'PDF casos' }));
    const lifecycle = mocks.requestExport.mock.calls[0][1];
    view.unmount();
    expect(lifecycle.isCurrent()).toBe(false);
    await act(async () => finish({ ok: true, download_url: 'https://example.invalid/retired-export.pdf' }));
    expect(open).not.toHaveBeenCalled();
    expect(mocks.requestExport).toHaveBeenCalledOnce();
  });

  it('keeps confirmed breaches and risk separate from missing evidence', async () => {
    const { risk, unknown } = await renderSummary({
      open: 7, sla_risk: 3, sla_breached: 2, sla_at_risk: 1,
      sla_known: 4, sla_unknown: 3, sla_eligible: 7,
    });
    expect(within(risk).getByText('3', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(risk).getByText('2 vencidos y 1 en riesgo.')).toBeInTheDocument();
    expect(risk.className).toContain('amber');
    expect(within(unknown).getByText('3', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(unknown.className).not.toContain('emerald');
  });

  it.each([
    { open: 55, sla_risk: 55 },
    { open: 55, sla_risk: 55, sla_breached: 0, sla_at_risk: 0, sla_known: 0, sla_unknown: 55, sla_eligible: 55 },
    { open: 55, sla_risk: 0, sla_breached: 0, sla_at_risk: 0, sla_known: 0, sla_unknown: 55, sla_eligible: 0 },
  ])('does not assert SLA results from incomplete or inconsistent counters', async (summary) => {
    const { risk, unknown } = await renderSummary(summary);
    expect(within(risk).getByText('--', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(unknown).getByText('--', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(risk).getByText(/Falta evidencia suficiente/)).toBeInTheDocument();
    expect(risk.className).not.toMatch(/emerald|amber/);
  });
});
