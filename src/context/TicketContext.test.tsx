import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTicketsMock = vi.fn();
const useTicketUpdatesMock = vi.fn();
const getTicketWorkflowMetadataMock = vi.fn();
const mockUser = { tenantSlug: 'demo', rol: 'admin', id: 1 };

vi.mock('@/services/ticketService', () => ({
  getTickets: (...args: unknown[]) => getTicketsMock(...args),
}));

vi.mock('@/hooks/useTicketUpdates', () => ({
  default: (...args: unknown[]) => useTicketUpdatesMock(...args),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: mockUser }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'demo' }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    getTicketWorkflowMetadata: (...args: unknown[]) => getTicketWorkflowMetadataMock(...args),
  },
}));

vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual('@/utils/api');
  return {
    ...actual,
    resolveTenantSlug: () => 'demo',
  };
});

import { TicketProvider, useTickets } from '@/context/TicketContext';

let ticketUpdateHandlers: Record<string, any> = {};

const Consumer = () => {
  const { tickets } = useTickets();
  return (
    <div>
      <span data-testid="unread">{String(tickets[0]?.hasUnreadMessages ?? false)}</span>
      <span data-testid="unread-viewers">{String(tickets[0]?.collaboration_state?.unread_viewer_count ?? 0)}</span>
      <span data-testid="idle-viewers">{String(tickets[0]?.collaboration_state?.idle_viewer_count ?? 0)}</span>
    </div>
  );
};

const PaginationConsumer = () => {
  const { tickets, hasMoreTickets, loadingMoreTickets, loadMoreTickets, pagination } = useTickets();
  return (
    <div>
      <span data-testid="ticket-count">{tickets.length}</span>
      <span data-testid="has-more">{String(hasMoreTickets)}</span>
      <span data-testid="loading-more">{String(loadingMoreTickets)}</span>
      <span data-testid="page">{String(pagination?.page ?? 0)}</span>
      <button type="button" onClick={loadMoreTickets}>
        cargar mas
      </button>
    </div>
  );
};

const FilterSelectionConsumer = () => {
  const { selectedTicket, filteredTickets, filters, setFilters } = useTickets();
  return (
    <div>
      <span data-testid="selected-ticket">{selectedTicket?.nro_ticket ?? 'none'}</span>
      <span data-testid="visible-tickets">{filteredTickets.map((ticket) => ticket.nro_ticket).join(',')}</span>
      <button
        type="button"
        onClick={() => setFilters((current) => ({ ...current, status: 'cerrado' }))}
      >
        filtrar cerrados
      </button>
      <button
        type="button"
        onClick={() => setFilters((current) => ({ ...current, channel: 'sin-resultados' }))}
      >
        dejar sin resultados
      </button>
      <span data-testid="active-status-filter">{filters.status}</span>
    </div>
  );
};

const CachedInboxConsumer = () => {
  const { tickets, selectedTicket, loading } = useTickets();
  return (
    <div>
      <span data-testid="cached-ticket-count">{tickets.length}</span>
      <span data-testid="cached-selected-ticket">{selectedTicket?.nro_ticket ?? 'none'}</span>
      <span data-testid="cached-loading">{String(loading)}</span>
    </div>
  );
};

const AssignedAgentAvatarConsumer = () => {
  const { tickets } = useTickets();
  return (
    <div data-testid="assigned-agent-avatars">
      {tickets
        .map((ticket) => `${ticket.nro_ticket}:${ticket.assignedAgent?.avatarUrl || 'fallback'}`)
        .join('|')}
    </div>
  );
};


describe('TicketContext unread delta reconciliation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    ticketUpdateHandlers = {};
    getTicketsMock.mockReset();
    useTicketUpdatesMock.mockReset();
    getTicketWorkflowMetadataMock.mockReset();
    getTicketWorkflowMetadataMock.mockResolvedValue({
      contract_version: 'tickets.workflow.v1',
      states: ['abierto'],
      transitions: { abierto: ['cerrado'] },
      final_states: ['cerrado'],
    });
    useTicketUpdatesMock.mockImplementation((handlers) => {
      ticketUpdateHandlers = handlers;
    });
    getTicketsMock.mockResolvedValue({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-1',
          asunto: 'Alumbrado',
          estado: 'abierto',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'General',
          hasUnreadMessages: false,
          collaboration_state: {
            unread_viewer_count: 0,
            idle_viewer_count: 0,
          },
        },
      ],
    });
  });

  it('hydrates the inbox from session cache while the live backend refresh is still pending', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    getTicketsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    window.sessionStorage.setItem(
      'chatboc:ticket-inbox:v1:demo:admin_3A1_3Acats_3Aall',
      JSON.stringify({
        version: 1,
        cached_at: Date.now(),
        tenant_slug: 'demo',
        viewer_key: 'admin:1:cats:all',
        selected_ticket_id: 99,
        pagination: {
          page: 1,
          per_page: 20,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
        tickets: [
          {
            id: 99,
            tipo: 'municipio',
            nro_ticket: 'REC-CACHE',
            asunto: 'Arreglo de calle',
            estado: 'abierto',
            fecha: '2026-03-21T10:00:00.000Z',
            categoria: 'General',
          },
        ],
      }),
    );

    render(
      <TicketProvider>
        <CachedInboxConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cached-ticket-count').textContent).toBe('1');
      expect(screen.getByTestId('cached-selected-ticket').textContent).toBe('REC-CACHE');
      expect(screen.getByTestId('cached-loading').textContent).toBe('true');
    });
    expect(getTicketsMock).toHaveBeenCalledWith('demo', { page: 1 });

    act(() => {
      resolveFetch({
        tickets: [
          {
            id: 100,
            tipo: 'municipio',
            nro_ticket: 'REC-LIVE',
            asunto: 'Luminaria',
            estado: 'abierto',
            fecha: '2026-03-21T10:01:00.000Z',
            categoria: 'General',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('cached-selected-ticket').textContent).toBe('REC-LIVE');
      expect(screen.getByTestId('cached-loading').textContent).toBe('false');
    });
  });

  it('updates ticket unread badges from ticket.unread.changed without refetch', async () => {
    render(
      <TicketProvider>
        <Consumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('unread').textContent).toBe('false');
    });

    act(() => {
      ticketUpdateHandlers.onUnreadChanged?.({
        ticket_id: 1,
        unread_count: 3,
        collaboration_state: {
          unread_viewer_count: 2,
          idle_viewer_count: 1,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('unread').textContent).toBe('true');
      expect(screen.getByTestId('unread-viewers').textContent).toBe('2');
      expect(screen.getByTestId('idle-viewers').textContent).toBe('1');
    });
    expect(getTicketsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('loads the next backend page and merges tickets without losing selection state', async () => {
    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-1',
          asunto: 'Alumbrado',
          estado: 'abierto',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'General',
        },
      ],
      pagination: {
        page: 1,
        per_page: 1,
        total_items: 2,
        total_pages: 2,
        has_next: true,
        has_prev: false,
      },
    });
    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 2,
          tipo: 'municipio',
          nro_ticket: 'REC-2',
          asunto: 'Bache',
          estado: 'abierto',
          fecha: '2026-03-21T10:01:00.000Z',
          categoria: 'General',
        },
      ],
      pagination: {
        page: 2,
        per_page: 1,
        total_items: 2,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      },
    });

    render(
      <TicketProvider>
        <PaginationConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-count').textContent).toBe('1');
      expect(screen.getByTestId('has-more').textContent).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /cargar mas/i }));

    await waitFor(() => {
      expect(screen.getByTestId('ticket-count').textContent).toBe('2');
      expect(screen.getByTestId('has-more').textContent).toBe('false');
      expect(screen.getByTestId('page').textContent).toBe('2');
    });

    expect(getTicketsMock).toHaveBeenLastCalledWith('demo', { page: 2, perPage: 1 });
  });

  it('keeps selected ticket aligned with the visible filtered inbox', async () => {
    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-1',
          asunto: 'Alumbrado',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'General',
        },
        {
          id: 2,
          tipo: 'municipio',
          nro_ticket: 'REC-2',
          asunto: 'Bache',
          estado: 'cerrado',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:01:00.000Z',
          categoria: 'General',
        },
      ],
    });

    render(
      <TicketProvider>
        <FilterSelectionConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-ticket').textContent).toBe('REC-1');
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-1,REC-2');
    });

    fireEvent.click(screen.getByRole('button', { name: /filtrar cerrados/i }));

    await waitFor(() => {
      expect(screen.getByTestId('active-status-filter').textContent).toBe('cerrado');
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-2');
      expect(screen.getByTestId('selected-ticket').textContent).toBe('REC-2');
    });

    fireEvent.click(screen.getByRole('button', { name: /dejar sin resultados/i }));

    await waitFor(() => {
      expect(screen.getByTestId('visible-tickets').textContent).toBe('');
      expect(screen.getByTestId('selected-ticket').textContent).toBe('none');
    });
  });

  it('keeps assigned agent avatars behind the same consent contract as public contacts', async () => {
    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-RAW',
          asunto: 'Alumbrado',
          estado: 'abierto',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'General',
          assignedAgent: {
            id: 5,
            nombre: 'Operador sin permiso',
            email: 'raw@junin.gob.ar',
            avatar_url: 'https://cdn.example.com/profile/raw.webp',
            avatar_source: 'whatsapp_profile',
            avatar_consent: true,
          },
        },
        {
          id: 2,
          tipo: 'municipio',
          nro_ticket: 'REC-OK',
          asunto: 'Bache',
          estado: 'abierto',
          fecha: '2026-03-21T10:01:00.000Z',
          categoria: 'General',
          assignedAgent: {
            id: 6,
            nombre: 'Operador autorizado',
            email: 'ok@junin.gob.ar',
            avatar_url: 'https://cdn.example.com/profile/agent.webp',
            avatar_source: 'agent_profile',
            avatar_consent: true,
          },
        },
      ],
    });

    render(
      <TicketProvider>
        <AssignedAgentAvatarConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('assigned-agent-avatars').textContent).toBe(
        'REC-RAW:fallback|REC-OK:https://cdn.example.com/profile/agent.webp',
      );
    });
  });

});
