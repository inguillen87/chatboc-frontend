import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TicketSlaClocks } from './TicketSlaClocks';

const clock = (
  state: string,
  dueAt = '2026-08-30T15:00:00Z',
  remainingSeconds: number | null = null,
) => ({
  state,
  status: state,
  due_at: dueAt,
  remaining_seconds: remainingSeconds,
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
          evaluated_at: '2026-08-30T16:05:00Z',
          clocks: {
            first_response: clock('overdue', '2026-08-30T15:00:00Z', -3900),
          },
        }}
      />,
    );

    expect(screen.getByRole('group', { name: /SLA: Respuesta vencida/i })).toHaveTextContent(
      'Respuesta vencida · 1 h 5 min al corte',
    );
    expect(screen.getByTestId('ticket-sla-clocks-compact')).toHaveAttribute('data-sla-state', 'overdue');
  });

  it('uses the backend remaining-seconds snapshot without creating a browser countdown', () => {
    render(
      <TicketSlaClocks
        sla={{
          evaluated_at: '2026-08-30T12:00:00Z',
          clocks: {
            first_response: clock('satisfied'),
            next_update: clock('warning', '2026-08-30T12:45:00Z', 2700),
            resolution: clock('ok', '2026-08-30T17:30:00Z', 19800),
          },
        }}
      />,
    );

    expect(screen.getByTestId('ticket-sla-clock-next_update')).toHaveTextContent('45 min restantes al corte');
    expect(screen.getByTestId('ticket-sla-clock-resolution')).toHaveTextContent('5 h 30 min restantes al corte');
    expect(screen.getByText(/Corte /i)).toHaveAttribute('dateTime', '2026-08-30T12:00:00Z');
  });

  it('labels an incomplete contract as partial instead of claiming that every clock is unknown', () => {
    render(
      <TicketSlaClocks
        compact
        sla={{
          clocks: {
            first_response: clock('satisfied'),
            resolution: clock('ok', '2026-08-30T17:30:00Z', 19800),
          },
        }}
      />,
    );

    expect(screen.getByTestId('ticket-sla-clocks-compact')).toHaveTextContent('SLA parcial');
    expect(screen.getByRole('group', { name: /SLA: SLA parcial/i })).toBeInTheDocument();
  });

  it('does not present remaining seconds as current without a backend evaluation cut', () => {
    render(
      <TicketSlaClocks
        compact
        sla={{
          clocks: {
            first_response: clock('overdue', '2026-08-30T15:00:00Z', -3900),
          },
        }}
      />,
    );

    expect(screen.getByTestId('ticket-sla-clocks-compact')).toHaveTextContent('Respuesta vencida');
    expect(screen.getByTestId('ticket-sla-clocks-compact')).not.toHaveTextContent('1 h 5 min');
    expect(screen.getByRole('group', { name: 'SLA: Respuesta vencida' })).toBeInTheDocument();
  });
});
