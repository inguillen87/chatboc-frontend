import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTicketsMock = vi.fn();
const useTicketUpdatesMock = vi.fn();
const getTicketWorkflowMetadataMock = vi.fn();
const mockUser: Record<string, any> = { tenantSlug: 'demo', rol: 'admin', id: 1 };

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

import {
  TicketProvider,
  __resetTicketInboxRuntimeDedupeForTests,
  useTickets,
} from '@/context/TicketContext';
import { ApiError } from '@/utils/api';

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
      <button
        type="button"
        onClick={() =>
          setFilters((current) => ({
            ...current,
            priority: 'alta',
            sla: 'risk',
            unread: 'unread',
          }))
        }
      >
        filtrar operativos
      </button>
      <button
        type="button"
        onClick={() => setFilters((current) => ({ ...current, area: 'Arreglo_De_Calle' }))}
      >
        filtrar arreglo deep link
      </button>
      <span data-testid="active-status-filter">{filters.status}</span>
      <span data-testid="active-area-filter">{filters.area}</span>
    </div>
  );
};

const CachedInboxConsumer = () => {
  const { tickets, selectedTicket, loading, error } = useTickets();
  return (
    <div>
      <span data-testid="cached-ticket-count">{tickets.length}</span>
      <span data-testid="cached-selected-ticket">{selectedTicket?.nro_ticket ?? 'none'}</span>
      <span data-testid="cached-loading">{String(loading)}</span>
      <span data-testid="cached-error">{error ?? 'none'}</span>
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

const FilterOptionsConsumer = () => {
  const { filterOptions } = useTickets();
  return (
    <div>
      <span data-testid="filter-channels">{filterOptions.channels.join('|')}</span>
      <span data-testid="filter-areas">{filterOptions.areas.join('|')}</span>
      <span data-testid="filter-agents">{filterOptions.agents.map((agent) => `${agent.id}:${agent.label}`).join('|')}</span>
      <span data-testid="filter-statuses">{filterOptions.statuses.map((status) => `${status.value}:${status.label}`).join('|')}</span>
      <span data-testid="filter-priorities">{filterOptions.priorities.join('|')}</span>
      <span data-testid="filter-sla">{filterOptions.slaStatuses.join('|')}</span>
    </div>
  );
};


describe('TicketContext unread delta reconciliation', () => {
  beforeEach(() => {
    Object.keys(mockUser).forEach((key) => {
      delete mockUser[key];
    });
    Object.assign(mockUser, { tenantSlug: 'demo', rol: 'admin', id: 1 });
    window.localStorage.clear();
    window.sessionStorage.clear();
    ticketUpdateHandlers = {};
    getTicketsMock.mockReset();
    __resetTicketInboxRuntimeDedupeForTests();
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

  it('deduplicates identical live inbox loads across immediate CRM remounts', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    getTicketsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const renderInbox = () =>
      render(
        <>
          <TicketProvider>
            <CachedInboxConsumer />
          </TicketProvider>
          <TicketProvider>
            <CachedInboxConsumer />
          </TicketProvider>
        </>,
      );

    const view = renderInbox();

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      resolveFetch({
        tickets: [
          {
            id: 77,
            tipo: 'municipio',
            nro_ticket: 'REC-DEDUP',
            asunto: 'Luminaria',
            estado: 'abierto',
            fecha: '2026-03-21T10:01:00.000Z',
            categoria: 'General',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('cached-ticket-count').map((node) => node.textContent)).toEqual([
        '1',
        '1',
      ]);
    });

    view.unmount();
    renderInbox();

    await waitFor(() => {
      expect(screen.getAllByTestId('cached-selected-ticket')[0].textContent).toBe('REC-DEDUP');
    });
    expect(getTicketsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps cached tickets visible but surfaces auth errors from the live refresh', async () => {
    getTicketsMock.mockRejectedValueOnce(
      new ApiError('Acceso prohibido', 403, { error: 'forbidden' }),
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
      expect(screen.getByTestId('cached-loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('cached-error').textContent).toContain(
      'Tu usuario no tiene permisos para abrir la bandeja de reclamos de este tenant.',
    );
    expect(screen.getByTestId('cached-error').textContent).toContain('Mostrando datos guardados');
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

    getTicketsMock.mockResolvedValueOnce({
      tickets: [
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

    fireEvent.click(screen.getByRole('button', { name: /filtrar cerrados/i }));

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenLastCalledWith('demo', { page: 1, status: 'cerrado' });
      expect(screen.getByTestId('active-status-filter').textContent).toBe('cerrado');
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-2');
      expect(screen.getByTestId('selected-ticket').textContent).toBe('REC-2');
    });

    getTicketsMock.mockResolvedValueOnce({
      tickets: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /dejar sin resultados/i }));

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenLastCalledWith('demo', {
        page: 1,
        status: 'cerrado',
        channel: 'sin-resultados',
      });
      expect(screen.getByTestId('visible-tickets').textContent).toBe('');
      expect(screen.getByTestId('selected-ticket').textContent).toBe('none');
    });
  });

  it('passes operational filters to the backend instead of filtering only the loaded page', async () => {
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
      ],
    });

    render(
      <TicketProvider>
        <FilterSelectionConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-1');
    });

    getTicketsMock.mockResolvedValueOnce({ tickets: [] });
    fireEvent.click(screen.getByRole('button', { name: /filtrar operativos/i }));

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenLastCalledWith('demo', {
        page: 1,
        priority: 'alta',
        sla: 'risk',
        unread: 'unread',
      });
    });
  });

  it('normalizes deep-link category filters before calling the backend and local inbox filter', async () => {
    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-ROAD',
          asunto: 'Bache',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'Arreglo De Calle',
        },
        {
          id: 2,
          tipo: 'municipio',
          nro_ticket: 'REC-LIGHT',
          asunto: 'Luminaria',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:01:00.000Z',
          categoria: 'Luminaria',
        },
      ],
    });

    render(
      <TicketProvider>
        <FilterSelectionConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-ROAD,REC-LIGHT');
    });

    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-ROAD',
          asunto: 'Bache',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'Arreglo De Calle',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /filtrar arreglo deep link/i }));

    await waitFor(() => {
      expect(getTicketsMock).toHaveBeenLastCalledWith('demo', {
        page: 1,
        category: 'Arreglo De Calle',
      });
      expect(screen.getByTestId('active-area-filter').textContent).toBe('Arreglo_De_Calle');
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-ROAD');
      expect(screen.getByTestId('selected-ticket').textContent).toBe('REC-ROAD');
    });
  });

  it('applies employee ticket scope aliases before showing the operational inbox', async () => {
    Object.assign(mockUser, {
      rol: 'employee',
      id: 42,
      categorias: [{ id: 7, nombre: 'Arreglo de calle' }],
    });

    getTicketsMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'municipio',
          nro_ticket: 'REC-ROAD',
          asunto: 'Bache',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:00:00.000Z',
          categoria: 'Arreglo_De_Calle',
        },
        {
          id: 2,
          tipo: 'municipio',
          nro_ticket: 'REC-LIGHT',
          asunto: 'Luminaria',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:01:00.000Z',
          categoria: 'Luminaria',
        },
        {
          id: 3,
          tipo: 'municipio',
          nro_ticket: 'REC-ASSIGNED',
          asunto: 'Arbolado',
          estado: 'abierto',
          channel: 'whatsapp',
          fecha: '2026-03-21T10:02:00.000Z',
          categoria: 'Arbolado',
          assigned_user_id: 42,
        },
      ],
    });

    render(
      <TicketProvider>
        <FilterSelectionConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('visible-tickets').textContent).toBe('REC-ROAD,REC-ASSIGNED');
    });
  });

  it('uses backend facets for global filter options beyond the current ticket page', async () => {
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
          categoria: 'Luminaria',
          priority: 'alta',
          sla_status: 'risk',
          assignedAgent: {
            id: 5,
            nombre_usuario: 'Operador uno',
            email: 'uno@junin.gob.ar',
          },
        },
      ],
      facets: {
        contract_version: 'tickets.facets.v1',
        channels: [
          { value: 'whatsapp', label: 'WhatsApp', count: 1 },
          { value: 'web', label: 'Web', count: 1 },
        ],
        areas: [
          { value: 'Luminaria', label: 'Luminaria', count: 1 },
          { value: 'Arbolado', label: 'Arbolado', count: 1 },
        ],
        agents: [
          { value: 'unassigned', label: 'Sin responsable', count: 1 },
          { value: '5', label: 'Operador uno', count: 1 },
        ],
        statuses: [
          { value: 'abierto', label: 'Abierto', count: 1 },
          { value: 'cerrado', label: 'Cerrado', count: 1 },
        ],
        priorities: [
          { value: 'alta', label: 'Alta', count: 1 },
          { value: 'media', label: 'Media', count: 1 },
        ],
        slaStatuses: [
          { value: 'risk', label: 'Riesgo', count: 1 },
          { value: 'ok', label: 'Al dia', count: 1 },
        ],
      },
    });

    render(
      <TicketProvider>
        <FilterOptionsConsumer />
      </TicketProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-channels').textContent).toBe('web|whatsapp');
      expect(screen.getByTestId('filter-areas').textContent).toBe('Arbolado|Luminaria');
      expect(screen.getByTestId('filter-agents').textContent).toBe('unassigned:Sin responsable|5:Operador uno');
      expect(screen.getByTestId('filter-statuses').textContent).toContain('cerrado:Cerrado');
      expect(screen.getByTestId('filter-priorities').textContent).toBe('alta|media');
      expect(screen.getByTestId('filter-sla').textContent).toBe('ok|risk');
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
