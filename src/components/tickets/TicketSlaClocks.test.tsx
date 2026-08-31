import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TicketSlaClocks } from './TicketSlaClocks';

const clock = (state: string, dueAt = '2026-08-30T15:00:00Z') => ({
  state,
  status: state,
  due_at: dueAt,
  known: true,
});
describe('TicketSlaClocks', () => {
  it('renders three named and accessible commitments', () => {
    render(
      <TicketSlaClocks
        sla={{
          clocks: {
            first_response: clock('healthy'),
            next_update: clock('warning'),
            resolution: clock('breached'),
          },
        }}
      />,
    );

    const region = screen.getByRole('region', { name: 'Relojes de nivel de servicio' });
    expect(within(region).getByText('Primera respuesta')).toBeInTheDocument();
    expect(within(region).getByText('Próxima actualización')).toBeInTheDocument();
    expect(within(region).getByText('Resolución')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-sla-clock-first_response')).toHaveAttribute('data-sla-state', 'healthy');
    expect(screen.getByTestId('ticket-sla-clock-next_update')).toHaveAttribute('data-sla-state', 'due');
    expect(screen.getByTestId('ticket-sla-clock-resolution')).toHaveAttribute('data-sla-state', 'overdue');
  });

  it('renders missing evidence as unknown and never as active', () => {
    render(<TicketSlaClocks sla={{ status: 'active' }} />);

    expect(screen.getAllByText('Sin evidencia')).toHaveLength(3);
    expect(screen.queryByText(/activo/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Sin fecha o estado verificable')).toHaveLength(3);
  });

  it('summarizes only an authoritative overdue clock as operational risk', () => {
    render(
      <TicketSlaClocks
        compact
        sla={{
          clocks: {
            first_response: clock('overdue'),
          },
        }}
      />,
    );

    expect(screen.getByRole('status', { name: 'Estado de nivel de servicio: Vencido' })).toHaveTextContent('SLA vencido');
    expect(screen.getByTestId('ticket-sla-clocks-compact')).toHaveAttribute('data-sla-state', 'overdue');
  });
});
