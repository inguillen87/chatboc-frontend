import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewTicketsPanel from './NewTicketsPanel';

const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));

const useTicketsMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchParamsState.value],
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => useTicketsMock(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin', tenant: { slug: 'junin', tipo: 'municipio' } }),
}));

vi.mock('@/services/backofficeService', () => ({
  backofficeService: {
    getInboxSummary: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('./Sidebar', () => ({
  default: ({ className }: { className?: string }) => (
    <aside className={className} data-testid="tickets-sidebar">
      Reclamos
    </aside>
  ),
}));

vi.mock('./ConversationPanel', () => ({
  default: () => <section data-testid="tickets-conversation">Conversacion</section>,
}));

vi.mock('./DetailsPanel', () => ({
  default: () => <section data-testid="tickets-details">Detalle</section>,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

describe('NewTicketsPanel CRM layout', () => {
  beforeEach(() => {
    searchParamsState.value = new URLSearchParams();
    useTicketsMock.mockReset();
    useTicketsMock.mockReturnValue({
      loading: true,
      error: null,
      tickets: [],
      filteredTickets: [],
      selectedTicket: null,
      selectTicket: vi.fn(),
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });
  });

  it('shows an operational loading status instead of an empty CRM shell', () => {
    render(<NewTicketsPanel />);

    expect(screen.getByRole('status', { name: /cargando bandeja de reclamos/i })).toBeInTheDocument();
    expect(screen.getByText(/sincronizando tickets, chats en vivo/i)).toBeInTheDocument();
  });

  it('reserves enough desktop width for the ticket list before the chat column', () => {
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [],
      filteredTickets: [],
      selectedTicket: null,
      selectTicket: vi.fn(),
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel />);

    expect(screen.getByTestId('tickets-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-ops-stat-strip')).toHaveClass('overflow-x-auto');
    expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
    });
    expect(screen.getByTestId('tickets-operational-continuity')).toHaveTextContent('Mesa de reclamos');
  });

  it('uses a compact operational header when embedded inside the profile CRM', () => {
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [],
      filteredTickets: [],
      selectedTicket: null,
      selectTicket: vi.fn(),
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel embedded />);

    expect(screen.getByTestId('tickets-embedded-ops-header')).toBeInTheDocument();
    expect(screen.getByTestId('tickets-embedded-ops-header')).toHaveTextContent('Reclamos');
    expect(screen.getByTestId('ticket-ops-stat-strip')).toHaveClass('hidden');
    expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)',
    });
    expect(screen.getByTestId('tickets-operational-continuity')).toHaveTextContent('Mesa de reclamos');
    expect(screen.getByTestId('tickets-operational-continuity')).toHaveTextContent('Cola priorizada');
    expect(screen.getByTestId('tickets-operational-continuity')).not.toHaveTextContent('Resueltos');
    expect(screen.getByRole('button', { name: /realtime/i })).toBeInTheDocument();
  });

  it('offers a compact action for the next operational priority in embedded mode', () => {
    const selectTicket = vi.fn();
    const selectedTicket = {
      id: 1,
      nro_ticket: 'M-1',
      asunto: 'Consulta general',
      estado: 'nuevo',
      fecha: '2026-06-01T10:00:00.000Z',
      tipo: 'municipio',
    };
    const priorityTicket = {
      id: 2,
      nro_ticket: 'M-2',
      asunto: 'Luminaria apagada',
      estado: 'nuevo',
      fecha: '2026-06-01T09:00:00.000Z',
      tipo: 'municipio',
      collaboration_state: { has_unread: true },
    };
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [selectedTicket, priorityTicket],
      filteredTickets: [selectedTicket, priorityTicket],
      selectedTicket,
      selectTicket,
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel embedded />);

    expect(screen.getByTestId('tickets-next-priority-strip')).toHaveTextContent('M-2');
    fireEvent.click(screen.getByRole('button', { name: /atender siguiente prioridad/i }));

    expect(selectTicket).toHaveBeenCalledWith(2);
  });

  it('does not hide channel, area or agent filters from the operational summary', () => {
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [],
      filteredTickets: [],
      selectedTicket: null,
      selectTicket: vi.fn(),
      filters: {
        channel: 'whatsapp',
        status: 'all',
        area: 'obras',
        agent: 'unassigned',
        priority: 'all',
        sla: 'all',
        unread: 'all',
      },
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel />);

    expect(screen.queryByText(/sin filtros activos/i)).not.toBeInTheDocument();
    expect(screen.getByText('Canal: whatsapp')).toBeInTheDocument();
    expect(screen.getByText('Area: obras')).toBeInTheDocument();
    expect(screen.getByText('Agente: unassigned')).toBeInTheDocument();
  });

  it('opens CRM desk from heatmap query links with filters and selected ticket', async () => {
    const setFilters = vi.fn();
    const selectTicket = vi.fn();
    searchParamsState.value = new URLSearchParams(
      'tab=tickets&focus=open_geocoding_queue&ticket_id=378430&categoria=Arreglo_De_Calle&canal=whatsapp',
    );
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [
        {
          id: 378430,
          nro_ticket: 'M-378430',
          asunto: 'Arreglo de calle',
          categoria: 'Arreglo De Calle',
          estado: 'nuevo',
          fecha: '2026-06-01T10:00:00.000Z',
          tipo: 'municipio',
          channel: 'whatsapp',
        },
      ],
      filteredTickets: [
        {
          id: 378430,
          nro_ticket: 'M-378430',
          asunto: 'Arreglo de calle',
          categoria: 'Arreglo De Calle',
          estado: 'nuevo',
          fecha: '2026-06-01T10:00:00.000Z',
          tipo: 'municipio',
          channel: 'whatsapp',
        },
      ],
      selectedTicket: null,
      selectTicket,
      filters: {
        channel: 'all',
        status: 'all',
        area: 'all',
        agent: 'all',
        priority: 'all',
        sla: 'all',
        unread: 'all',
      },
      setFilters,
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel />);

    await waitFor(() => {
      expect(setFilters).toHaveBeenCalledWith(expect.any(Function));
      expect(selectTicket).toHaveBeenCalledWith(378430);
    });

    const filterUpdater = setFilters.mock.calls[0][0] as (current: Record<string, string>) => Record<string, string>;
    expect(
      filterUpdater({
        channel: 'all',
        status: 'all',
        area: 'all',
        agent: 'all',
        priority: 'all',
        sla: 'all',
        unread: 'all',
      }),
    ).toMatchObject({
      channel: 'whatsapp',
      area: 'Arreglo_De_Calle',
      sla: 'risk',
    });
    expect(screen.getByTestId('tickets-deeplink-focus')).toHaveTextContent('open geocoding queue');
  });
});
