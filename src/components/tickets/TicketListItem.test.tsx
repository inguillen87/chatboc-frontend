import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const overdueSla = {
  contract_version: 'ticket.sla.v1',
  evaluated_at: '2026-08-30T16:05:00Z',
  clocks: {
    resolution: {
      state: 'overdue',
      due_at: '2026-08-30T15:00:00Z',
      remaining_seconds: -3900,
      known: true,
    },
  },
};

describe('TicketListItem', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', LoadedImageMock);
    // Framer Motion uses PointerEvent for keyboard activation; jsdom does not provide it.
    vi.stubGlobal('PointerEvent', MouseEvent);
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

  it.each([false, true])('shows the backend SLA snapshot in the row (compact: %s)', (compact) => {
    render(
      <TicketListItem
        ticket={{ ...baseTicket, categoria: undefined, sla_evaluation: overdueSla }}
        isSelected={false}
        onClick={vi.fn()}
        compact={compact}
      />,
    );

    const sla = screen.getByRole('group', { name: /SLA: Resolución vencida/i });
    expect(sla).toHaveTextContent('Resolución vencida · 1 h 5 min al corte');
    expect(sla).toHaveAttribute('data-sla-state', 'overdue');
  });

  it('keeps explicit unknown SLA evidence neutral instead of falling back to older data', () => {
    render(
      <TicketListItem
        ticket={{ ...baseTicket, priority: 'urgente', sla: { status: 'active' }, datos_extra: { sla: overdueSla } }}
        isSelected={false}
        onClick={vi.fn()}
        compact
      />,
    );

    expect(screen.getByRole('group', { name: 'SLA: SLA sin evidencia' })).toHaveAttribute('data-sla-state', 'unknown');
    expect(screen.queryByText(/vencida|en plazo|al corte/i)).not.toBeInTheDocument();
  });

  it('retires the old SLA when the row receives another ticket without SLA evidence', () => {
    const { rerender } = render(
      <TicketListItem ticket={{ ...baseTicket, datos_extra: { sla: overdueSla } }} isSelected={false} onClick={vi.fn()} compact />,
    );
    expect(screen.getByRole('group', { name: /SLA: Resolución vencida/i })).toBeInTheDocument();

    rerender(
      <TicketListItem ticket={{ ...baseTicket, id: 2, nro_ticket: 'M-2', priority: 'urgente' }} isSelected={false} onClick={vi.fn()} compact />,
    );

    expect(screen.getByRole('button', { name: 'Abrir ticket M-2' })).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByTestId('ticket-sla-clocks-compact')).not.toBeInTheDocument();
  });

  it('includes SLA in the keyboard description without adding another control or losing queue help', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <>
        <p id="queue-help">Usá las flechas para recorrer la cola.</p>
        <TicketListItem
          ticket={{ ...baseTicket, sla: overdueSla }}
          isSelected
          onClick={onClick}
          onKeyDown={onKeyDown}
          tabIndex={0}
          queueIndex={2}
          ariaDescribedBy="queue-help"
          compact
        />
      </>,
    );

    const row = screen.getByRole('button', { name: 'Abrir ticket M-378430' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(row).toHaveAccessibleDescription(/Usá las flechas.*Resolución vencida · 1 h 5 min al corte/);
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveAttribute('data-ticket-queue-index', '2');
    await user.tab();
    expect(row).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard('{ArrowDown}');
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowDown' }));
  });
});
