import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), bulk: vi.fn(), routing: vi.fn(), surveys: vi.fn(), workload: vi.fn(), unread: vi.fn(), timeline: vi.fn(), note: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/services/enterpriseService', () => {
  const services: Record<string, ReturnType<typeof vi.fn>> = { getTenantLeads: mocks.list, bulkUpdateTenantLeadStage: mocks.bulk, getTenantEncuestasOverview: mocks.surveys, getTenantEmployeesWorkload: mocks.workload, getTenantUnreadSummary: mocks.unread, getTenantLeadTimeline: mocks.timeline, addTenantLeadTimelineNote: mocks.note };
  return { enterpriseService: new Proxy({}, { get: (_, key) => services[String(key)] || vi.fn().mockResolvedValue({ items: [] }) }) };
});
vi.mock('@/api/v2/saas', () => ({ getEmployeeRoutingV2: mocks.routing }));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock('@/components/admin/LeadAutoAssignmentButton', () => ({ default: () => null }));
import SuperadminLeadsPipeline from './SuperadminLeadsPipeline';

const response = (slug: string) => ({ tenant_slug: slug, items: [{ ticket_id: 23, ticket_type: 'municipio', tenant_slug: slug, nombre: `${slug} case`, stage: 'nuevo' }] });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function mount() { return render(<MemoryRouter><SuperadminLeadsPipeline /></MemoryRouter>); }
function edit(slug: string) { fireEvent.change(screen.getByPlaceholderText('tenant slug'), { target: { value: slug } }); }
function bulkButton() { return screen.getByRole('button', { name: 'Actualizar etapa' }); }
function load() { fireEvent.click(screen.getByRole('button', { name: 'Cargar casos' })); }
async function select(slug = 'alpha') { edit(slug); load(); const row = (await screen.findByText(new RegExp(`${slug.trim().toLowerCase()} case`))).closest('tr')!; await waitFor(() => expect(screen.getByRole('button', { name: 'Cargar casos' })).toBeEnabled()); fireEvent.click(within(row).getByRole('checkbox')); return row; }
afterEach(cleanup);
beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.list.mockImplementation((slug: string) => Promise.resolve(response(slug)));
  mocks.bulk.mockResolvedValue({ ok: true }); mocks.routing.mockResolvedValue(null);
  mocks.surveys.mockResolvedValue({ items: [] }); mocks.workload.mockResolvedValue({ items: [] }); mocks.unread.mockResolvedValue({ items: [], total_tickets_with_unread: 0 });
  mocks.timeline.mockResolvedValue({ items: [{ note: 'Alpha history' }] }); mocks.note.mockResolvedValue({ ok: true });
});
describe('Superadmin tenant board scope', () => {
  it('retires selected alpha cases as soon as beta is edited and never mutates beta with alpha IDs', async () => {
    mount(); await select(); edit('beta');
    expect(screen.queryByText(/alpha case/)).not.toBeInTheDocument();
    fireEvent.click(bulkButton());
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it('retires previous cases during refresh and keeps them retired after a rejected beta read', async () => {
    mount(); await select();
    const pending = deferred<any>(); mocks.list.mockReturnValueOnce(pending.promise);
    edit('beta'); load();
    expect(screen.queryByText(/alpha case/)).not.toBeInTheDocument(); expect(bulkButton()).toBeDisabled();
    await act(async () => { pending.reject(new Error('403')); });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron verificar');
    expect(bulkButton()).toBeDisabled(); expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it('rejects an old alpha read after alpha to beta to alpha editing even when the slug matches again', async () => {
    const pending = deferred<any>(); mocks.list.mockReturnValueOnce(pending.promise);
    mount(); edit('alpha'); load(); edit('beta'); edit('alpha');
    await act(async () => { pending.resolve(response('alpha')); });
    expect(screen.queryByText(/alpha case/)).not.toBeInTheDocument(); expect(bulkButton()).toBeDisabled();
  });
  it('cannot publish late alpha auxiliary results over a fully verified beta snapshot', async () => {
    const pending = deferred<any>(); mocks.surveys.mockImplementation((slug: string) => slug === 'alpha' ? pending.promise : Promise.resolve({ items: [{ name: 'Beta survey' }] }));
    mocks.workload.mockImplementation((slug: string) => Promise.resolve({ items: [{ name: `${slug} employee` }] }));
    mount(); edit('alpha'); load(); await screen.findByText(/alpha case/); edit('beta'); load();
    await screen.findByText(/beta case/);
    await act(async () => { pending.resolve({ items: [{ name: 'Alpha survey' }] }); });
    expect(screen.getByText('Beta survey')).toBeInTheDocument(); expect(screen.getByText('beta employee')).toBeInTheDocument();
    expect(screen.queryByText('Alpha survey')).not.toBeInTheDocument(); expect(screen.queryByText(/alpha case/)).not.toBeInTheDocument();
  });
  it('uses the verified canonical slug, captures selected IDs, preserves stage filters, and permits one current mutation', async () => {
    const pending = deferred<any>(); mocks.bulk.mockReturnValueOnce(pending.promise);
    mount(); fireEvent.change(screen.getByDisplayValue('todas etapas'), { target: { value: 'nuevo' } }); await select(' Alpha ');
    fireEvent.click(bulkButton()); fireEvent.click(bulkButton());
    expect(mocks.bulk).toHaveBeenCalledTimes(1); expect(mocks.bulk).toHaveBeenCalledWith('alpha', { stage: 'contactado', updates: [{ ticket_type: 'municipio', ticket_id: 23 }] });
    await act(async () => { pending.resolve({ ok: true }); });
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.list).toHaveBeenLastCalledWith('alpha', { stage: 'nuevo', limit: 100 });
    expect(mocks.success).toHaveBeenCalledWith('Etapa actualizada.');
  });
  it('ignores a late bulk receipt after scope changes, without refreshing beta or replaying the mutation', async () => {
    const pending = deferred<any>(); mocks.bulk.mockReturnValueOnce(pending.promise);
    mount(); await select(); fireEvent.click(bulkButton()); edit('beta'); edit('alpha');
    await act(async () => { pending.resolve({ ok: true }); });
    expect(mocks.bulk).toHaveBeenCalledTimes(1); expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled(); expect(screen.queryByText(/alpha case/)).not.toBeInTheDocument();
  });
  it('retires an uncertain mutation and requires a fresh explicit read before another attempt', async () => {
    mocks.bulk.mockRejectedValueOnce(new Error('timeout')); mount(); await select(); fireEvent.click(bulkButton());
    await screen.findByRole('alert'); expect(bulkButton()).toBeDisabled(); expect(mocks.list).toHaveBeenCalledTimes(1);
    fireEvent.click(bulkButton()); expect(mocks.bulk).toHaveBeenCalledTimes(1);
  });
  it('keeps valid primary cases operable when auxiliary surveys and workload reads fail', async () => {
    mocks.surveys.mockRejectedValueOnce(new Error('503')); mocks.workload.mockRejectedValueOnce(new Error('503'));
    mount(); await select('medicinal_general'); fireEvent.click(bulkButton());
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledWith('medicinal_general', { stage: 'contactado', updates: [{ ticket_type: 'municipio', ticket_id: 23 }] }));
  });
  it.each(['municipio', 'pyme'])('allows the genuine explicitly verified canonical organization %s', async (slug) => {
    mount(); await select(slug); fireEvent.click(bulkButton());
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledWith(slug, { stage: 'contactado', updates: [{ ticket_type: 'municipio', ticket_id: 23 }] }));
  });
  it('binds a row without an inner tenant to its verified outer scope and retires pending history and draft on edits', async () => {
    const pending = deferred<any>(); mocks.timeline.mockReturnValueOnce(pending.promise);
    mocks.list.mockResolvedValueOnce({ tenant_slug: 'alpha', items: [{ ticket_id: 23, ticket_type: 'municipio', nombre: 'alpha case' }] });
    mount(); const row = await select(); fireEvent.click(within(row).getByRole('button', { name: 'Abrir', exact: true }));
    expect(mocks.timeline).toHaveBeenCalledWith('alpha', 'municipio', 23);
    fireEvent.change(screen.getByPlaceholderText('Agregar nota'), { target: { value: 'Private alpha draft' } }); edit('beta');
    await act(async () => { pending.resolve({ items: [{ note: 'Late alpha history' }] }); });
    expect(screen.getByPlaceholderText('Agregar nota')).toHaveValue(''); expect(screen.queryByText('Late alpha history')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar', exact: true })); expect(mocks.note).not.toHaveBeenCalled();
  });
  it('keeps already started notes on their captured scope and suppresses late refresh after changing organizations', async () => {
    const pending = deferred<any>(); mocks.note.mockReturnValueOnce(pending.promise);
    mount(); const row = await select(); fireEvent.click(within(row).getByRole('button', { name: 'Abrir', exact: true }));
    await screen.findByText('Alpha history'); fireEvent.change(screen.getByPlaceholderText('Agregar nota'), { target: { value: 'Captured alpha note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar', exact: true })); edit('beta');
    await act(async () => { pending.resolve({ ok: true }); });
    expect(mocks.note).toHaveBeenCalledWith('alpha', 'municipio', 23, { note: 'Captured alpha note' }); expect(mocks.timeline).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Agregar nota')).toHaveValue(''); expect(screen.queryByText('Alpha history')).not.toBeInTheDocument();
  });
  it('rejects a mismatched row organization even when the response envelope matches the draft slug', async () => {
    mocks.list.mockResolvedValueOnce({ tenant_slug: 'alpha', items: response('beta').items });
    mount(); edit('alpha'); load(); await screen.findByRole('alert');
    expect(screen.queryByText(/beta case/)).not.toBeInTheDocument(); expect(bulkButton()).toBeDisabled();
  });
  it('does not publish read results or process bulk receipts after unmount', async () => {
    const pendingRead = deferred<any>(); mocks.list.mockReturnValueOnce(pendingRead.promise);
    const first = mount(); edit('alpha'); load(); first.unmount();
    await act(async () => { pendingRead.resolve(response('alpha')); });
    const pendingBulk = deferred<any>(); mocks.bulk.mockReturnValueOnce(pendingBulk.promise);
    const second = mount(); await select(); fireEvent.click(bulkButton()); second.unmount();
    await act(async () => { pendingBulk.resolve({ ok: true }); });
    expect(mocks.list).toHaveBeenCalledTimes(2); expect(mocks.success).not.toHaveBeenCalled();
  });
});
