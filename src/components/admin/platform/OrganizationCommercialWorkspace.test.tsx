import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), timeline: vi.fn(), addNote: vi.fn(), changeStage: vi.fn() }));
vi.mock('./commercialFollowUpApi', () => ({ commercialFollowUpApi: mocks }));
import { OrganizationCommercialWorkspace } from './OrganizationCommercialWorkspace';
import { OrganizationDirectory } from './OrganizationDirectory';
import { parseCommercialList, type CommercialList } from './commercialFollowUp';
import type { Tenant } from '@/types/superAdmin';
const tenant = { slug: 'org-a', nombre: 'Organización A' };
const data = (slug = 'org-a'): CommercialList => parseCommercialList({ tenant_slug: slug, items: [
  { ticket_id: 12, ticket_type: 'municipio', nro: '9001', nombre: 'José Pérez', stage: 'nuevo' },
  { ticket_id: 13, ticket_type: 'municipio', nro: '9002', nombre: 'Beatriz', stage: 'ganado' },
], total: 2 }, slug);
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((a) => { resolve = a; }); return { promise, resolve }; };
beforeEach(() => { mocks.list.mockReset().mockImplementation((slug) => Promise.resolve(data(slug))); mocks.timeline.mockReset().mockResolvedValue([]); mocks.addNote.mockReset(); mocks.changeStage.mockReset(); });
afterEach(cleanup);
const openJose = async () => { fireEvent.click(await screen.findByRole('button', { name: 'Seguimiento de José Pérez, caso 9001' })); await screen.findByText('No hay eventos registrados en el historial disponible.'); };
describe('organization commercial workspace', () => {
  it('scopes requests explicitly and searches accented names with combined stages', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Seguimiento de José Pérez, caso 9001' }); expect(mocks.list).toHaveBeenCalledExactlyOnceWith('org-a');
    fireEvent.change(screen.getByLabelText('Buscar casos'), { target: { value: 'jose' } });
    fireEvent.change(screen.getByLabelText('Filtrar por etapa'), { target: { value: 'open' } });
    expect(screen.getByRole('button', { name: 'Seguimiento de José Pérez, caso 9001' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Seguimiento de Beatriz/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por etapa'), { target: { value: 'ganado' } });
    expect(screen.getByText('No hay casos que coincidan con estos filtros.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exportar casos filtrados' })).toBeDisabled();
  });
  it('asks before discarding, retains a draft when canceled and switches only on confirmation', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />); await openJose();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'No perder borrador' } });
    fireEvent.click(screen.getByRole('button', { name: /Seguimiento de Beatriz/ }));
    const discard = await screen.findByRole('alertdialog', { name: 'Hay cambios sin guardar' });
    fireEvent.click(within(discard).getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('No perder borrador');
    fireEvent.click(screen.getByRole('button', { name: /Seguimiento de Beatriz/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Descartar borrador' }));
    expect(await screen.findByRole('region', { name: 'Seguimiento de Beatriz' })).toBeVisible();
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue(''); expect(mocks.addNote).not.toHaveBeenCalled();
    expect(mocks.timeline.mock.calls.map(([row]) => row.ticketId)).toEqual(['12', '13']);
  });
  it('clicking the already selected case does not discard its draft or reset its lock', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />); await openJose();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Borrador actual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seguimiento de José Pérez, caso 9001' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(); expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('Borrador actual');
    expect(screen.getByRole('button', { name: 'Actualizar casos' })).toBeDisabled();
  });
  it('blocks closing and switching while a write is pending', async () => {
    const pending = deferred<[]>(); mocks.addNote.mockReturnValue(pending.promise); const close = vi.fn();
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={close} />); await openJose();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'En guardado' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));
    expect(screen.getByRole('button', { name: /Seguimiento de Beatriz/ })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' }); expect(close).not.toHaveBeenCalled();
    await act(async () => pending.resolve([]));
  });
  it('clears all cases and drafts after revoked access and requires an explicit reload', async () => {
    mocks.addNote.mockRejectedValue({ status: 403 });
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />); await openJose();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Privado' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));
    await screen.findByText(/Se retiraron sus datos y borradores/);
    expect(screen.queryByLabelText('Nota de seguimiento')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Seguimiento de Beatriz/ })).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Exportar casos filtrados' })).toBeDisabled();
  });
  it('never shows a late list from the previous organization', async () => {
    const old = deferred<CommercialList>(); mocks.list.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...data('org-b'), items: [{ ...data('org-b').items[0], name: 'Contacto B' }] });
    const view = render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />);
    view.rerender(<OrganizationCommercialWorkspace tenant={{ slug: 'org-b', nombre: 'Organización B' }} onClose={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Seguimiento de Contacto B/ })).toBeVisible();
    await act(async () => old.resolve(data())); expect(screen.queryByRole('button', { name: /Seguimiento de José/ })).not.toBeInTheDocument();
  });
  it('closes the old editor before a fresh list read so it cannot replace a newly typed draft', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />); await openJose(); const next = deferred<CommercialList>(); mocks.list.mockReturnValueOnce(next.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar casos' }));
    expect(screen.queryByLabelText('Nota de seguimiento')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: /Seguimiento de José/ })).toBeDisabled();
    await act(async () => next.resolve(data())); expect(mocks.list).toHaveBeenCalledTimes(2);
  });
  it('opens through the existing directory without changing existing management handlers', async () => {
    const handlers = { onRefresh: vi.fn(), onLoadMore: vi.fn(), onProfile: vi.fn(), onEdit: vi.fn(), onImpersonate: vi.fn(), onToggleStatus: vi.fn(), onPurge: vi.fn() };
    const row = { id: 1, ...tenant, tipo: 'municipio', plan: 'test', is_active: true, owner_email: 'admin@example.test' } as Tenant;
    render(<OrganizationDirectory tenants={[row]} total={1} loading={false} error={null} {...handlers} />);
    expect(mocks.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir CRM de Organización A' }));
    expect(await screen.findByRole('dialog', { name: 'CRM · Organización A' })).toBeVisible(); await waitFor(() => expect(mocks.list).toHaveBeenCalledExactlyOnceWith('org-a'));
    expect(handlers.onImpersonate).not.toHaveBeenCalled(); expect(handlers.onEdit).not.toHaveBeenCalled(); expect(handlers.onPurge).not.toHaveBeenCalled();
  });
});
