import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), timeline: vi.fn(), addNote: vi.fn(), changeStage: vi.fn() }));
vi.mock('./commercialFollowUpApi', () => ({ commercialFollowUpApi: mocks }));
import { OrganizationCommercialWorkspace } from './OrganizationCommercialWorkspace';
import { parseCommercialList } from './commercialFollowUp';
const tenant = { slug: 'org-a', nombre: 'Organización A' };
const data = parseCommercialList({ tenant_slug: tenant.slug, items: [
  { ticket_id: 12, ticket_type: 'municipio', nro: '9001', nombre: 'José', stage: 'nuevo', last_seen: '2026-09-01T00:00:00Z' },
  { ticket_id: 13, ticket_type: 'municipio', nro: '9002', nombre: 'Beatriz', stage: 'ganado', last_seen: '2026-09-22T00:00:00Z' },
] }, tenant.slug);
beforeEach(() => { mocks.list.mockReset().mockResolvedValue(data); mocks.timeline.mockReset().mockResolvedValue([]); mocks.addNote.mockReset(); mocks.changeStage.mockReset(); vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-23T18:00:00Z')); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('commercial discovery integration', () => {
  it('connects chart clicks, results and clear filters without making extra network calls', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar Nuevo: 1 casos' }));
    expect(screen.getByLabelText('Filtrar por etapa')).toHaveValue('nuevo');
    expect(screen.queryByRole('button', { name: /Seguimiento de Beatriz/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('button', { name: /Seguimiento de Beatriz/ })).toBeVisible(); expect(mocks.list).toHaveBeenCalledOnce();
  });
  it('opens the existing verified editor from the board and preserves drafts across presentation changes', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Filtrar Nuevo: 1 casos' });
    fireEvent.click(screen.getByRole('button', { name: 'Tablero por etapas' }));
    expect(screen.getByRole('region', { name: 'Tablero comercial por etapas' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Seguimiento de José, caso 9001' }));
    await screen.findByText('No hay eventos registrados en el historial disponible.');
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Borrador del seguimiento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lista', exact: true }));
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('Borrador del seguimiento');
    expect(mocks.timeline.mock.calls[0][0]).toMatchObject({ tenantSlug: 'org-a', ticketId: '12' });
    expect(mocks.addNote).not.toHaveBeenCalled(); expect(mocks.changeStage).not.toHaveBeenCalled();
  });
  it('limits the inactivity shortcut to open cases and keeps the loaded chart denominator', async () => {
    render(<OrganizationCommercialWorkspace tenant={tenant} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Sin actividad reciente/ }));
    expect(screen.getByLabelText('Prioridad de revisión')).toHaveValue('quiet');
    expect(screen.getByLabelText('Filtrar por etapa')).toHaveValue('open');
    expect(screen.getByText('1 resultados de 2 casos con identidad verificada.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Filtrar Ganado: 1 casos' })).toBeVisible();
  });
});
