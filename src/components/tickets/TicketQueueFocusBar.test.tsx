import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TicketQueueFocusBar } from './TicketQueueFocusBar';
const empty = { unread: 'all', sla: 'all', agent: 'all' };

describe('TicketQueueFocusBar', () => {
  it('exposes three labeled toggle buttons with no fabricated counts', () => {
    render(<TicketQueueFocusBar filters={empty} onToggle={vi.fn()} onClear={vi.fn()} />);
    for (const name of ['No leídos', 'SLA vencido', 'Sin asignar']) {
      expect(screen.getByRole('button', { name: `Enfocar: ${name}` })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.queryByLabelText(/quitar enfoque/i)).not.toBeInTheDocument();
    expect(screen.getByText(/se combina con tu búsqueda/i)).toBeInTheDocument();
  });
  it('invokes the selected filter without taking a ticket action', () => {
    const toggle = vi.fn();
    render(<TicketQueueFocusBar filters={empty} onToggle={toggle} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enfocar: SLA vencido' }));
    expect(toggle).toHaveBeenCalledExactlyOnceWith('sla');
  });
  it('reflects changes from another filter control without local stale state', () => {
    const props = { onToggle: vi.fn(), onClear: vi.fn() };
    const { rerender } = render(<TicketQueueFocusBar {...props} filters={{ ...empty, unread: 'unread' }} />);
    expect(screen.getByRole('button', { name: 'Enfocar: No leídos' })).toHaveAttribute('aria-pressed', 'true');
    rerender(<TicketQueueFocusBar {...props} filters={empty} />);
    expect(screen.getByRole('button', { name: 'Enfocar: No leídos' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('explains intersection when more than one shortcut is active', () => {
    render(<TicketQueueFocusBar filters={{ ...empty, sla: 'risk', unread: 'unread' }} onToggle={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText('Deben cumplirse todos los enfoques elegidos.')).toBeInTheDocument();
  });
  it('offers a clear action with a precise accessible name', () => {
    const clear = vi.fn();
    render(<TicketQueueFocusBar filters={{ ...empty, agent: 'unassigned' }} onToggle={vi.fn()} onClear={clear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar enfoque sin borrar los demás filtros' }));
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it('has no implicit submit controls', () => {
    render(<TicketQueueFocusBar filters={empty} onToggle={vi.fn()} onClear={vi.fn()} />);
    for (const button of screen.getAllByRole('button')) expect(button).toHaveAttribute('type', 'button');
  });
});
