import { normalizeTicketSla } from '@/utils/ticketSla';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TicketListItem from './TicketListItem';
import type { Ticket } from '@/types/tickets';

vi.mock('@/hooks/useDateSettings', () => ({
  useDateSettings: () => ({
    timezone: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
  }),
}));

class LoadedImageMock {
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(eventName: string, listener: () => void) {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(eventName, [...current, listener]);
  }

  removeEventListener(eventName: string, listener: () => void) {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(
      eventName,
      current.filter((item) => item !== listener),
    );
  }

  set src(_value: string) {
    setTimeout(() => {
      this.listeners.get('load')?.forEach((listener) => listener());
    }, 0);
  }
}

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
  beforeEach(() => {
    vi.stubGlobal('Image', LoadedImageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    const contactMetadata = screen.getByLabelText('Ticket M-378430, contacto Marcelo');
    expect(contactMetadata).toHaveAttribute('title', 'M-378430 - Marcelo');
    expect(contactMetadata).toHaveTextContent(/M-378430.*Marcelo/i);
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

  it('uses a real avatar url when the contact profile provides one', async () => {
    const { container } = render(
      <TicketListItem
        ticket={{
          ...baseTicket,
          avatar_url: 'https://cdn.example.com/marcelo.jpg',
          avatar_source: 'social',
          avatar_consent: true,
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    await waitFor(() => {
      const image = container.querySelector('img');
      expect(image).toHaveAttribute('src', 'https://cdn.example.com/marcelo.jpg');
      expect(image).toHaveAttribute('alt', 'Marcelo');
    });
  });

  it('falls back to initials when the avatar url has no consented source', () => {
    const { container } = render(
      <TicketListItem
        ticket={{
          ...baseTicket,
          avatar_url: 'https://cdn.example.com/marcelo.jpg',
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('shows suggested actions in the compact operational row', () => {
    const { container } = render(
      <TicketListItem
        ticket={{
          ...baseTicket,
          lastMessage: 'Vecino envio nuevos datos',
          recommended_next_action: 'Responder desde la mesa operativa',
        }}
        isSelected={false}
        onClick={vi.fn()}
        compact
      />,
    );

    expect(screen.getByText(/próximo paso:/i)).toBeInTheDocument();
    expect(screen.getByText(/responder desde la mesa operativa/i)).toBeInTheDocument();
    expect(container.querySelector('.bg-primary\\/5')).toBeInTheDocument();
  });
  it('surfaces an authoritative overdue clock directly in the compact queue', () => {
    render(<TicketListItem ticket={{ ...baseTicket, sla: normalizeTicketSla({ clocks: {
      resolution: { status: 'overdue', due_at: '2026-06-05T18:00:00Z', known: true },
    } }) }} isSelected={false} onClick={vi.fn()} compact />);
    expect(screen.getByTestId('compact-queue-sla')).toHaveTextContent('Resolución vencida');
    expect(screen.getByTestId('ticket-sla-clocks-compact')).toHaveAttribute('data-sla-state', 'overdue');
  });

  it('does not manufacture a deadline from an old date or high priority', () => {
    render(<TicketListItem ticket={{ ...baseTicket, priority: 'alta', fecha: '2020-01-01T00:00:00Z' }}
      isSelected={false} onClick={vi.fn()} compact />);
    expect(screen.queryByTestId('compact-queue-sla')).not.toBeInTheDocument();
    expect(screen.queryByText(/vencida|por vencer/i)).not.toBeInTheDocument();
  });

});
