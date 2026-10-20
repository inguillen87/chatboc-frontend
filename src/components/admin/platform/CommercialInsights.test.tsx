import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommercialInsights } from './CommercialInsights';
import { CommercialKanban } from './CommercialKanban';
import { parseCommercialList } from './commercialFollowUp';
const now = Date.parse('2026-09-23T18:00:00Z');
const rows = parseCommercialList({ tenant_slug: 'org-a', items: [
  { ticket_id: 12, ticket_type: 'municipio', nro: '9001', nombre: 'José', stage: 'nuevo', last_seen: '2026-09-01T00:00:00Z' },
  { ticket_id: 13, ticket_type: 'municipio', nro: '9002', nombre: 'Beatriz', stage: 'custom' },
] }, 'org-a').items;
afterEach(cleanup);
describe('commercial charts and board', () => {
  it('filters from a real chart bar with keyboard-compatible native controls', () => {
    const onStage = vi.fn(); render(<CommercialInsights items={rows} now={now} stage="all" attention="all" onStage={onStage} onAttention={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Nuevo: 1 casos' })); expect(onStage).toHaveBeenCalledWith('nuevo');
    expect(screen.getByText(/no es un embudo de conversión/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Filtrar Etapa no informada: 1 casos' })).toBeVisible();
  });
  it('exposes the age shortcut without claiming an SLA breach', () => {
    const onAttention = vi.fn(); render(<CommercialInsights items={rows} now={now} stage="all" attention="all" onStage={vi.fn()} onAttention={onAttention} />);
    fireEvent.click(screen.getByRole('button', { name: /Sin actividad reciente/ })); expect(onAttention).toHaveBeenCalledWith('quiet');
    expect(screen.getByText(/No mide vencimientos de SLA/)).toBeVisible();
  });
  it('does not render non-finite bars for an empty selection', () => {
    const { container } = render(<CommercialInsights items={[]} now={now} stage="all" attention="all" onStage={vi.fn()} onAttention={vi.fn()} />);
    expect(container.innerHTML).not.toMatch(/NaN%|Infinity%/);
  });
  it('retains unknown stages in their own board column and opens the exact canonical record', () => {
    const onSelect = vi.fn(); render(<CommercialKanban items={rows} onSelect={onSelect} />);
    const unknown = screen.getByRole('region', { name: 'Etapa no informada: 1 casos' });
    fireEvent.click(within(unknown).getByRole('button', { name: 'Seguimiento de Beatriz, caso 9002' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(rows[1]);
    expect(screen.queryByRole('button', { name: /Mover/ })).not.toBeInTheDocument();
  });
  it('disables card actions while another write is pending', () => {
    const onSelect = vi.fn(); render(<CommercialKanban items={rows} disabled onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: 'Seguimiento de José, caso 9001' });
    expect(button).toBeDisabled(); fireEvent.click(button); expect(onSelect).not.toHaveBeenCalled();
  });
});
