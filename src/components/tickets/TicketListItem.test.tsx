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

    expect(screen.getByText(/ahora:/i)).toBeInTheDocument();
    expect(screen.getByText(/responder desde la mesa operativa/i)).toBeInTheDocument();
    expect(container.querySelector('.bg-primary\\/5')).toBeInTheDocument();
  });
});
