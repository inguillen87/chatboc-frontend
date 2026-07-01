import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TicketListItem from './TicketListItem';
import type { Ticket } from '@/types/tickets';

vi.mock('@/hooks/useDateSettings', () => ({
  useDateSettings: () => ({
    timezone: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
  }),
}));

const baseTicket: Ticket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo De Calle',
  categoria: 'Arreglo De Calle',
  estado: 'nuevo',
  fecha: '2026-06-05T21:03:00.000Z',
  display_name: 'Marcelo',
};

describe('TicketListItem', () => {
  it('uses the useful issue text as title when subject only repeats the category', () => {
    render(
      <TicketListItem
        ticket={{
          ...baseTicket,
          description: 'Don Bosco 55 esquina Sarmiento con pozo profundo',
          lastMessage: 'Ultimo mensaje del vecino',
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Don Bosco 55 esquina Sarmiento con pozo profundo',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle')).toBeInTheDocument();
    expect(screen.getByText(/M-378430 - Marcelo/i)).toBeInTheDocument();
  });

  it('keeps a specific subject as the primary title and shows category as metadata', () => {
    render(
      <TicketListItem
        ticket={{
          ...baseTicket,
          asunto: 'Bache frente a escuela',
          description: 'Arreglo de calle',
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Bache frente a escuela' })).toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle')).toBeInTheDocument();
  });
});
