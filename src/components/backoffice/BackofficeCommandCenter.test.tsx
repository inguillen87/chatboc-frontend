import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  downloadExport: vi.fn(),
  authority: { user: { id: 1, rol: 'admin', capabilities: ['tickets.read'], permissions: ['tickets.read'], categoria_ids: [4] }, organizationProfileVerified: true },
}));

vi.mock('@/services/backofficeService', () => ({ backofficeService: mocks }));
vi.mock('@/utils/api', () => ({ getErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.authority }));
// UI authority seam only; byte validation and Blob URL lifecycle have their own helper tests.
vi.mock('@/services/backofficeExportDownload', () => ({
  downloadPrivateBackofficeExport: (...args: unknown[]) => mocks.downloadExport(...args),
}));

import BackofficeCommandCenter from './BackofficeCommandCenter';

describe('BackofficeCommandCenter SLA evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestExecutiveSummary.mockReset();
    mocks.requestExport.mockReset();
    mocks.authority = { user: { id: 1, rol: 'admin', capabilities: ['tickets.read'], permissions: ['tickets.read'], categoria_ids: [4] }, organizationProfileVerified: true };
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

  const renderSummary = async (summary: BackofficeInboxSummaryResponse['summary'],
    overrides: Partial<React.ComponentProps<typeof BackofficeCommandCenter>> = {}) => {
    mocks.getInboxSummary.mockResolvedValue({
      contract_version: 'backoffice.inbox_summary.v1', tenant_slug: 'tenant-a', summary,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" {...overrides} /></QueryClientProvider>);
    const risk = screen.getByRole('heading', { name: 'Fuera de plazo o por vencer' }).parentElement!.parentElement!;
    const unknown = screen.getByRole('heading', { name: 'Plazos por revisar' }).parentElement!.parentElement!;
    const team = screen.getByRole('heading', { name: 'Personas en el equipo' }).parentElement!.parentElement!;
    await within(team).findByText('1', { selector: 'p.text-2xl' });
    return { risk, unknown, client, view };
  };

  const privateExportFixture = () => ({
    blob: new Blob(['%PDF-1.7\nfixture report\n%%EOF\n'], { type: 'application/pdf' }),
    filename: 'tickets-fixture.pdf', tenantSlug: 'tenant-a', tenantId: 11,
    resource: 'tickets' as const, format: 'pdf' as const,
    rowCount: 1, totalRows: 1, complete: true as const,
  });

  it('starts with compact values and reveals every data-quality explanation only on request', async () => {
    const { risk, unknown } = await renderSummary({ open: 55 });
    const disclosure = screen.getByText('Datos para soporte');
    const details = disclosure.closest('details')!;
    const explanations = [
      screen.getByText(/no lo completamos con una estimación/),
      screen.getByText('“Sin datos” significa que la fuente no informó un valor; 0 es un valor confirmado.'),
      screen.getByText('Plazo vencido o por vencer'),
      screen.getByText('Todavía no hay datos suficientes para evaluar los plazos.'),
      screen.getByText('Plazo sin verificar'),
      screen.getByText('Casos abiertos sin un plazo de atención que se pueda comprobar.'),
      screen.getByText('Falta información para saber cuántos casos y pedidos no tienen responsable.'),
    ];
    expect(details).not.toHaveAttribute('open');
    for (const explanation of explanations) {
      expect(details).toContainElement(explanation);
      expect(explanation).not.toBeVisible();
    }
    for (const card of [risk, unknown]) {
      expect(within(card).getByText('Sin datos')).toBeVisible();
      expect(within(card).queryByText('0')).not.toBeInTheDocument();
    }
    const orders = screen.getByRole('heading', { name: 'Pedidos activos' }).parentElement!.parentElement!;
    expect(within(orders).getByText('0')).toBeVisible();

    fireEvent.click(disclosure);
    expect(details).toHaveAttribute('open');
    for (const explanation of explanations) expect(explanation).toBeVisible();
    fireEvent.click(disclosure);
    expect(details).not.toHaveAttribute('open');
    for (const explanation of explanations) expect(explanation).not.toBeVisible();
    expect(within(orders).getByText('0')).toBeVisible();
    expect(within(risk).getByText('Sin datos')).toBeVisible();
  });

  it('keeps keyboard focus and existing actions available around the indicator disclosure', async () => {
    const user = userEvent.setup();
    mocks.requestExecutiveSummary.mockResolvedValue({ headline: 'Resumen solicitado por el operador' });
    await renderSummary({ open: 55 });
    const refresh = screen.getByRole('button', { name: 'Actualizar datos' });
    const disclosure = screen.getByText('Datos para soporte');
    await user.tab();
    expect(refresh).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mocks.getInboxSummary).toHaveBeenCalledTimes(2));
    await user.tab();
    expect(disclosure).toHaveFocus();
    await user.click(disclosure);
    expect(disclosure.closest('details')).toHaveAttribute('open');
    expect(disclosure).toHaveFocus();
    await user.click(disclosure);
    expect(disclosure.closest('details')).not.toHaveAttribute('open');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Actualizar sugerencias' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Crear resumen' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Resumen solicitado por el operador')).toBeVisible();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledWith(expect.objectContaining({
      tenant_slug: 'tenant-a', resource: 'overview', filters: { scope: 'municipio' },
    }), expect.any(Object));
    expect(screen.getByRole('button', { name: 'Descargar casos en PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Descargar contactos en CSV' })).toBeEnabled();
  });

  it('keeps export disabled and explains verification while the selected tenant ID is unknown', async () => {
    await renderSummary({ open: 55 }, { tenantId: null });
    const button = screen.getByRole('button', { name: 'Descargar casos en PDF' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Verificamos la organización seleccionada/)).toHaveAttribute('role', 'status');
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar contactos en CSV' }));
    expect(mocks.requestExport).not.toHaveBeenCalled();
    expect(mocks.downloadExport).not.toHaveBeenCalled();
  });

  it('hides every orders indicator and source when orders are not enabled', async () => {
    mocks.requestExecutiveSummary.mockResolvedValue({ headline: 'Resumen de casos' });
    await renderSummary({ open: 2, unassigned: 1 }, { ordersEnabled: false });

    expect(screen.queryByRole('heading', { name: 'Pedidos activos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revisar pedidos' })).not.toBeInTheDocument();
    expect(mocks.getOrdersSummary).not.toHaveBeenCalled();
    const unassigned = screen.getByRole('heading', { name: 'Sin responsable' }).parentElement!.parentElement!;
    expect(within(unassigned).getByText('1', { selector: 'p.text-2xl' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear resumen' }));
    await screen.findByText('Resumen de casos');
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledWith(expect.objectContaining({
      source_endpoints: expect.not.arrayContaining(['/api/v2/backoffice/orders/summary']),
    }), expect.any(Object));
  });

  it('turns confirmed empty values into one concrete next action per block', async () => {
    const onOpenCases = vi.fn();
    const onOpenOrders = vi.fn();
    const onOpenContacts = vi.fn();
    const onOpenTeam = vi.fn();
    mocks.getInboxSummary.mockResolvedValue({
      contract_version: 'backoffice.inbox_summary.v1', tenant_slug: 'tenant-a',
      summary: { open: 0, unassigned: 0, sla_risk: 0, sla_breached: 0, sla_at_risk: 0, sla_known: 0, sla_unknown: 0, sla_eligible: 0 },
    });
    mocks.getContactsSummary.mockResolvedValue({
      contract_version: 'backoffice.contacts_summary.v1', tenant_slug: 'tenant-a', summary: { total: 0 },
    });
    mocks.getTeamCoverageSummary.mockResolvedValue({
      contract_version: 'backoffice.team_coverage_summary.v1', tenant_slug: 'tenant-a', summary: { active_employees: 0 },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio"
      onOpenCases={onOpenCases} onOpenOrders={onOpenOrders} onOpenContacts={onOpenContacts} onOpenTeam={onOpenTeam}
    /></QueryClientProvider>);

    await screen.findByText('No hay casos abiertos en este momento.');
    const actions = [
      ['Revisar casos', onOpenCases],
      ['Revisar pedidos', onOpenOrders],
      ['Abrir contactos', onOpenContacts],
      ['Sumar a la primera persona del equipo', onOpenTeam],
    ] as const;
    for (const [name, action] of actions) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('min-h-11');
      fireEvent.click(button);
      expect(action).toHaveBeenCalledOnce();
    }
    expect(screen.getByText('No hay casos confirmados fuera de plazo ni por vencer.')).toBeVisible();
    expect(screen.getByText('Todos los casos abiertos tienen un plazo que se puede comprobar.')).toBeVisible();
  });

  it('deduplicates repeated and competing export clicks into the same current attempt', async () => {
    let finish!: (value: unknown) => void;
    mocks.requestExport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const file = privateExportFixture();
    await renderSummary({ open: 55 });
    const pdf = screen.getByRole('button', { name: 'Descargar casos en PDF' });
    fireEvent.click(pdf); fireEvent.click(pdf);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar contactos en CSV' }));
    expect(mocks.requestExport).toHaveBeenCalledTimes(1);
    const [selection, lifecycle] = mocks.requestExport.mock.calls[0];
    expect(selection).toEqual({ tenant_slug: 'tenant-a', tenant_id: 11,
      resource: 'tickets', format: 'pdf', filters: { scope: 'municipio' } });
    expect(lifecycle.isCurrent()).toBe(true);
    await act(async () => finish(file));
    expect(mocks.requestExport).toHaveBeenCalledTimes(1);
    expect(mocks.downloadExport).toHaveBeenCalledTimes(1);
    expect(mocks.downloadExport).toHaveBeenCalledWith(file, lifecycle.isCurrent);
  });

  it('does not revive an export after the same tenant slug changes ID 11 to 22 to 11', async () => {
    let finish!: (value: unknown) => void;
    mocks.requestExport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar casos en PDF' }));
    const lifecycle = mocks.requestExport.mock.calls[0][1];
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={22} tenantRevision="fixture-rev2" scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    await act(async () => finish(privateExportFixture()));
    expect(mocks.downloadExport).not.toHaveBeenCalled();
    expect(mocks.requestExport).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Preparando el archivo…')).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos preparar el archivo. Intentá nuevamente.')).not.toBeInTheDocument();
  });

  it('does not revive read or export callbacks after organization verification is withdrawn and restored', async () => {
    let finishRead!: (value: unknown) => void;
    let finishExport!: (value: unknown) => void;
    const summary = { contract_version: 'backoffice.inbox_summary.v1', tenant_slug: 'tenant-a', summary: { open: 55 } };
    mocks.getInboxSummary.mockResolvedValue(summary).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
    mocks.requestExport.mockImplementationOnce(() => new Promise(resolve => { finishExport = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" /></QueryClientProvider>);
    await waitFor(() => expect(mocks.getInboxSummary).toHaveBeenCalledTimes(1));
    const read = mocks.getInboxSummary.mock.calls[0][1];
    fireEvent.click(screen.getByRole('button', { name: 'Descargar casos en PDF' }));
    const exporting = mocks.requestExport.mock.calls[0][1];
    expect(read.isCurrent()).toBe(true);
    expect(exporting.isCurrent()).toBe(true);
    mocks.authority.organizationProfileVerified = false;
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" /></QueryClientProvider>);
    expect(read.isCurrent()).toBe(false);
    expect(exporting.isCurrent()).toBe(false);
    mocks.authority.organizationProfileVerified = true;
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" /></QueryClientProvider>);
    expect(read.isCurrent()).toBe(false);
    expect(exporting.isCurrent()).toBe(false);
    await act(async () => { finishRead(summary); finishExport(privateExportFixture()); });
    expect(mocks.downloadExport).not.toHaveBeenCalled();
    expect(mocks.requestExport).toHaveBeenCalledTimes(1);
  });

  it('retires a pending export when category scope changes without changing its actor or other permissions', async () => {
    mocks.authority.user = { ...mocks.authority.user, rol: 'empleado' };
    let finish!: (value: unknown) => void;
    mocks.requestExport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar casos en PDF' }));
    const lifecycle = mocks.requestExport.mock.calls[0][1];
    const previous = mocks.authority.user;
    mocks.authority.user = { ...previous, categoria_ids: [] };
    expect(mocks.authority.user.id).toBe(previous.id);
    expect(mocks.authority.user.rol).toBe(previous.rol);
    expect(mocks.authority.user.capabilities).toEqual(previous.capabilities);
    expect(mocks.authority.user.permissions).toEqual(previous.permissions);
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter
      tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    await act(async () => finish(privateExportFixture()));
    expect(mocks.downloadExport).not.toHaveBeenCalled();
    expect(mocks.requestExport).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Preparando el archivo…')).not.toBeInTheDocument();
  });

  it('shows 55 unverified cases separately from zero confirmed risk without a healthy signal', async () => {
    const { risk, unknown } = await renderSummary({
      open: 55, sla_risk: 0, sla_breached: 0, sla_at_risk: 0,
      sla_known: 0, sla_unknown: 55, sla_eligible: 55,
    });
    expect(within(risk).getByText('0', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(within(unknown).getByText('55', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(risk.className).not.toMatch(/emerald|amber/);
    expect(unknown.className).not.toMatch(/emerald/);
    expect(screen.getByText(/sin un plazo de atención que se pueda comprobar/)).toBeInTheDocument();
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
    const team = screen.getByRole('heading', { name: 'Personas en el equipo' }).parentElement!.parentElement!;
    expect(within(team).getByText('1', { selector: 'p.text-2xl' })).toBeInTheDocument();
    const unassigned = screen.getByRole('heading', { name: 'Sin responsable' }).parentElement!.parentElement!;
    expect(within(unassigned).getByText('Sin datos')).toBeInTheDocument();
    expect(unassigned.className).not.toContain('emerald');
    expect(screen.getByText(/Falta información para saber cuántos casos y pedidos/)).toBeInTheDocument();
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
      expect(within(card).getByText('Sin datos')).toBeInTheDocument();
    }
  });

  it.each(['actor', 'permissions', 'categories', 'same-actor-relogin'] as const)('does not reuse a fresh same-tenant cache after %s changes', async change => {
    if (change === 'categories') mocks.authority.user = { ...mocks.authority.user, rol: 'empleado' };
    const { view, client } = await renderSummary({ open: 55 });
    const oldLifecycle = mocks.getTeamCoverageSummary.mock.calls[0][1];
    for (const read of [mocks.getInboxSummary, mocks.getOrdersSummary, mocks.getContactsSummary, mocks.getTeamCoverageSummary]) {
      read.mockImplementation(() => new Promise(() => {}));
    }
    if (change === 'actor') mocks.authority.user = { ...mocks.authority.user, id: 2 };
    else if (change === 'permissions') mocks.authority.user = { ...mocks.authority.user, rol: 'empleado', capabilities: [], permissions: [] };
    else if (change === 'categories') mocks.authority.user = { ...mocks.authority.user, categoria_ids: [] };
    else advanceChatbocSessionRevision();
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" tenantId={11} tenantRevision="fixture-rev1" scope="municipio" /></QueryClientProvider>);
    await waitFor(() => expect(mocks.getTeamCoverageSummary).toHaveBeenCalledTimes(2));
    const team = screen.getByRole('heading', { name: 'Personas en el equipo' }).parentElement!.parentElement!;
    expect(within(team).getByText('Sin datos')).toBeInTheDocument();
    expect(within(team).queryByText('1', { selector: 'p.text-2xl' })).not.toBeInTheDocument();
    expect(oldLifecycle.isCurrent()).toBe(false);
  });

  it('does not read or expose cached Home data while the profile is unverified', async () => {
    const { view, client } = await renderSummary({ open: 55 });
    mocks.authority.organizationProfileVerified = false;
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    expect(screen.queryByRole('region', { name: 'Resumen de casos y equipo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar datos' })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Crear resumen' }));
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
    const lifecycle = mocks.requestExecutiveSummary.mock.calls[0][1];
    expect(lifecycle.isCurrent()).toBe(true);
    if (change === 'actor') mocks.authority.user = { ...mocks.authority.user, id: 2 };
    else if (change === 'same-actor-relogin') advanceChatbocSessionRevision();
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug={change === 'tenant' ? 'tenant-b' : 'tenant-a'} scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    expect(screen.getByRole('button', { name: 'Crear resumen' })).toBeEnabled();
    await act(async () => finish({ headline: 'Resultado de la autoridad anterior' }));
    expect(screen.queryByText('Resultado de la autoridad anterior')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
  });

  it('does not display an executive error from a retired actor', async () => {
    let fail!: (error: Error) => void;
    mocks.requestExecutiveSummary.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Crear resumen' }));
    mocks.authority.user = { ...mocks.authority.user, id: 2 };
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    await act(async () => fail(new Error('retired response')));
    expect(screen.queryByText('No pudimos preparar el resumen automático.')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
  });

  it.each(['tenant-return', 'authority-return'] as const)('does not revive an executive request after %s', async change => {
    let finish!: (value: unknown) => void;
    mocks.requestExecutiveSummary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Crear resumen' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Descargar casos en PDF' }));
    expect(screen.getByText('Preparando el archivo…')).toBeInTheDocument();
    const lifecycle = mocks.requestExport.mock.calls[0][1];
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-b" scope="municipio" /></QueryClientProvider>);
    expect(lifecycle.isCurrent()).toBe(false);
    expect(screen.queryByText('Preparando el archivo…')).not.toBeInTheDocument();
    await act(async () => outcome === 'success'
      ? finish(privateExportFixture())
      : fail(new Error('retired export')));
    expect(open).not.toHaveBeenCalled();
    expect(mocks.downloadExport).not.toHaveBeenCalled();
    expect(screen.queryByText('No pudimos preparar el archivo. Intentá nuevamente.')).not.toBeInTheDocument();
    expect(mocks.requestExport).toHaveBeenCalledOnce();
  });

  it('clears previously displayed executive data and error when the actor changes', async () => {
    mocks.requestExecutiveSummary.mockResolvedValueOnce({ headline: 'Resumen del actor anterior' });
    mocks.requestExport.mockRejectedValueOnce(new Error('export failed'));
    const { view, client } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Crear resumen' }));
    await screen.findByText('Resumen del actor anterior');
    fireEvent.click(screen.getByRole('button', { name: 'Descargar casos en PDF' }));
    await screen.findByText('No pudimos preparar el archivo. Intentá nuevamente.');
    mocks.authority.user = { ...mocks.authority.user, id: 2 };
    view.rerender(<QueryClientProvider client={client}><BackofficeCommandCenter tenantSlug="tenant-a" scope="municipio" /></QueryClientProvider>);
    expect(screen.queryByText('Resumen del actor anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos preparar el archivo. Intentá nuevamente.')).not.toBeInTheDocument();
    expect(mocks.requestExecutiveSummary).toHaveBeenCalledOnce();
    expect(mocks.requestExport).toHaveBeenCalledOnce();
  });

  it('retires an export on unmount without opening its late download', async () => {
    let finish!: (value: unknown) => void;
    mocks.requestExport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { view } = await renderSummary({ open: 55 });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar casos en PDF' }));
    const lifecycle = mocks.requestExport.mock.calls[0][1];
    view.unmount();
    expect(lifecycle.isCurrent()).toBe(false);
    await act(async () => finish(privateExportFixture()));
    expect(open).not.toHaveBeenCalled();
    expect(mocks.downloadExport).not.toHaveBeenCalled();
    expect(mocks.requestExport).toHaveBeenCalledOnce();
  });

  it('keeps confirmed breaches and risk separate from missing evidence', async () => {
    const { risk, unknown } = await renderSummary({
      open: 7, sla_risk: 3, sla_breached: 2, sla_at_risk: 1,
      sla_known: 4, sla_unknown: 3, sla_eligible: 7,
    });
    expect(within(risk).getByText('3', { selector: 'p.text-2xl' })).toBeInTheDocument();
    expect(screen.getByText('2 vencidos y 1 en riesgo.')).toBeInTheDocument();
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
    expect(within(risk).getByText('Sin datos')).toBeInTheDocument();
    expect(within(unknown).getByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText(/Todavía no hay datos suficientes/)).toBeInTheDocument();
    expect(risk.className).not.toMatch(/emerald|amber/);
  });
});
