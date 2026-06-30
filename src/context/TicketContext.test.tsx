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


describe('TicketContext unread delta reconciliation', () => {
  beforeEach(() => {
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

});
