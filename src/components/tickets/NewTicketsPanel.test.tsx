import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewTicketsPanel from './NewTicketsPanel';

const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));
const mobileState = vi.hoisted(() => ({ value: false }));

const useTicketsMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchParamsState.value],
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => ({
    ticketTargetResolution: {
      ticketId: null,
      status: 'idle',
      ticket: null,
      message: null,
    },
    resolveTicketTarget: vi.fn().mockResolvedValue(null),
    clearTicketTarget: vi.fn(),
    ...useTicketsMock(),
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mobileState.value,
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
  default: ({
    className,
    showFilterControl = true,
    showListSummaryBar = true,
  }: {
    className?: string;
    showFilterControl?: boolean;
    showListSummaryBar?: boolean;
  }) => (
    <aside
      className={className}
      data-show-filter-control={showFilterControl ? 'true' : 'false'}
      data-show-list-summary-bar={showListSummaryBar ? 'true' : 'false'}
      data-testid="tickets-sidebar"
    >
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
    mobileState.value = false;
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

  it('surfaces an actionable retry state after a short CRM loading grace period', async () => {
    vi.useFakeTimers();
    try {
      render(<NewTicketsPanel />);

      expect(screen.queryByText(/la bandeja tarda mas de lo esperado/i)).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(12000);
        await Promise.resolve();
      });

      expect(screen.getByText(/la bandeja tarda mas de lo esperado/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar carga/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not mount a composer for another ticket while the deep-link target is resolving', () => {
    const otherTicket = {
      id: 1,
      nro_ticket: 'REC-1',
      asunto: 'Otro reclamo',
      estado: 'abierto',
      fecha: '2026-07-11T09:00:00.000Z',
      tipo: 'municipio',
    };
    const resolveTicketTarget = vi.fn().mockReturnValue(new Promise(() => {}));
    searchParamsState.value = new URLSearchParams('tab=tickets&ticket_id=99');
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [otherTicket],
      filteredTickets: [otherTicket],
      selectedTicket: otherTicket,
      selectTicket: vi.fn(),
      ticketTargetResolution: {
        ticketId: 99,
        status: 'resolving',
        ticket: null,
        message: null,
      },
      resolveTicketTarget,
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel />);

    expect(screen.getByTestId('tickets-target-resolution')).toHaveTextContent('Abriendo reclamo #99');
    expect(screen.queryByTestId('tickets-conversation')).not.toBeInTheDocument();
    expect(resolveTicketTarget).toHaveBeenCalledWith(99);
  });

  it.each([
    ['forbidden', 'Tu usuario no tiene permisos para abrir el reclamo solicitado.', 'No tenes acceso a este reclamo'],
    ['not_found', 'El reclamo solicitado no existe o no esta disponible para este tenant.', 'No encontramos el reclamo solicitado'],
  ])('shows an explicit %s target state without exposing another conversation', (status, message, title) => {
    const otherTicket = {
      id: 1,
      nro_ticket: 'REC-1',
      asunto: 'Otro reclamo',
      estado: 'abierto',
      fecha: '2026-07-11T09:00:00.000Z',
      tipo: 'municipio',
    };
    searchParamsState.value = new URLSearchParams('tab=tickets&ticket_id=99');
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [otherTicket],
      filteredTickets: [otherTicket],
      selectedTicket: otherTicket,
      selectTicket: vi.fn(),
      ticketTargetResolution: {
        ticketId: 99,
        status,
        ticket: null,
        message,
      },
      resolveTicketTarget: vi.fn().mockResolvedValue(null),
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel />);

    expect(screen.getByRole('alert')).toHaveTextContent(title);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByTestId('tickets-conversation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar apertura/i })).toBeInTheDocument();
  });

  it('renders a repair contract when ticket access fails because tenant scope is incomplete', () => {
    useTicketsMock.mockReturnValue({
      loading: false,
      error: 'El usuario municipal no tiene municipio_id valido para operar la bandeja de reclamos.',
      errorDetails: {
        reasonCode: 'missing_municipal_scope',
        actionHint: 'repair_ticket_scope',
        requestId: 'req_scope_123',
        requiredCapabilities: ['tickets.read', 'reclamos.read'],
        currentScope: {
          tenant_slug: 'junin',
          tenant_tipo: 'municipio',
          role: 'admin',
          canonical_role: 'admin',
        },
      },
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

    const contract = screen.getByTestId('tickets-access-contract');
    expect(contract).toHaveTextContent('Reparar acceso');
    expect(contract).toHaveTextContent('missing_municipal_scope');
    expect(contract).toHaveTextContent('request_id: req_scope_123');
    expect(contract).toHaveTextContent('junin');
    expect(contract).toHaveTextContent('tickets.read');
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
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-filter-control', 'false');
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-list-summary-bar', 'false');
    expect(screen.getByTestId('tickets-desk-filter-button')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-ops-stat-strip')).toHaveClass('overflow-x-auto');
    expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(340px, 420px) minmax(0, 1fr)',
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
    expect(screen.getByTestId('tickets-embedded-ops-header')).toHaveClass('shrink-0');
    expect(screen.getByTestId('tickets-embedded-ops-header')).toHaveTextContent('Reclamos');
    expect(screen.getByTestId('tickets-embedded-ops-header').firstElementChild).toHaveClass('min-h-8');
    expect(screen.getByTestId('tickets-embedded-ops-header').firstElementChild).toHaveClass('sm:min-h-10');
    expect(screen.getByTestId('tickets-embedded-ops-header').firstElementChild).toHaveClass('overflow-x-auto');
    expect(screen.getByTestId('tickets-header-filter-button')).toBeInTheDocument();
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-filter-control', 'false');
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-list-summary-bar', 'false');
    expect(screen.queryByTestId('ticket-ops-stat-strip')).not.toBeInTheDocument();
    expect(screen.getByTestId('tickets-embedded-kpi-summary')).toHaveTextContent('0 abiertos');
    expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(310px, 320px) minmax(0, 1fr)',
    });
    expect(screen.getByTestId('tickets-list-region')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.getByTestId('tickets-conversation-region')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.queryByTestId('tickets-operational-continuity')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /realtime/i })).toBeInTheDocument();
  });

  it('keeps embedded active filters collapsed in the header without showing the heavy sidebar filters', () => {
    const resetFilters = vi.fn();
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
        sla: 'risk',
        unread: 'all',
      },
      setFilters: resetFilters,
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel embedded />);

    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-filter-control', 'false');
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-list-summary-bar', 'false');
    expect(screen.getByTestId('tickets-embedded-active-filters')).toHaveTextContent('Canal: whatsapp +3');
    expect(screen.getByTestId('tickets-embedded-active-filters')).toHaveAttribute(
      'title',
      'Canal: whatsapp | Area: obras | Agente: unassigned | SLA: risk',
    );
    expect(screen.queryByText('Canal: whatsapp')).not.toBeInTheDocument();
    expect(screen.queryByText('Area: obras')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(resetFilters).toHaveBeenCalledWith(expect.any(Function));
    const resetUpdater = resetFilters.mock.calls[0][0] as (current: Record<string, string>) => Record<string, string>;
    expect(resetUpdater({
      channel: 'whatsapp',
      status: 'all',
      area: 'obras',
      agent: 'unassigned',
      priority: 'all',
      sla: 'risk',
      unread: 'all',
    })).toEqual({
      channel: 'all',
      status: 'all',
      area: 'all',
      agent: 'all',
      priority: 'all',
      sla: 'all',
      unread: 'all',
    });
  });

  it('opens the independent details column on standard 1440-class embedded desks', () => {
    const originalInnerWidth = window.innerWidth;
    const ticket = {
      id: 1,
      nro_ticket: 'M-1',
      asunto: 'Consulta general',
      estado: 'nuevo',
      fecha: '2026-06-01T10:00:00.000Z',
      tipo: 'municipio',
    };
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [ticket],
      filteredTickets: [ticket],
      selectedTicket: ticket,
      selectTicket: vi.fn(),
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
      const narrow = render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(310px, 320px) minmax(0, 1fr)',
      });
      narrow.unmount();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
      const commonDesktop = render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(310px, 320px) minmax(0, 1fr)',
      });
      commonDesktop.unmount();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
      const mediumDesktop = render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(310px, 320px) minmax(0, 1fr) minmax(300px, 310px)',
      });
      expect(screen.getByTestId('tickets-detail-region')).toHaveClass('min-h-0', 'overflow-hidden');
      mediumDesktop.unmount();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1536 });
      const wideDesktop = render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(310px, 320px) minmax(0, 1fr) minmax(300px, 310px)',
      });
      wideDesktop.unmount();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1800 });
      render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(310px, 320px) minmax(0, 1fr) minmax(300px, 310px)',
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('keeps the mobile navigator and active pane inside a clipped full-height viewport', () => {
    mobileState.value = true;
    const ticket = {
      id: 1,
      nro_ticket: 'M-1',
      asunto: 'Consulta general',
      estado: 'nuevo',
      fecha: '2026-06-01T10:00:00.000Z',
      tipo: 'municipio',
    };
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [ticket],
      filteredTickets: [ticket],
      selectedTicket: ticket,
      selectTicket: vi.fn(),
      filters: {},
      setFilters: vi.fn(),
      refreshTickets: vi.fn(),
      realtimeActivity: { pending: 0, lastLabel: null },
      clearRealtimeActivity: vi.fn(),
    });

    render(<NewTicketsPanel embedded />);

    expect(screen.getByTestId('tickets-mobile-layout')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.getByTestId('tickets-mobile-viewport')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(screen.getByTestId('tickets-conversation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true');
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
      crm_queue: {
        contract_version: 'tickets.crm_queue.v1',
        state: 'customer_waiting',
        score: 135,
        label: 'Responder ahora',
        reason: 'Hay actividad del vecino sin lectura completa del equipo.',
        next_team_action: 'reply_from_crm',
        badges: [
          { id: 'unread', label: 'Mensaje sin leer', tone: 'live' },
          { id: 'unassigned', label: 'Sin responsable', tone: 'warning' },
        ],
      },
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

    expect(screen.getByTestId('tickets-next-priority-strip')).toHaveClass('md:hidden');
    expect(screen.getByTestId('tickets-next-priority-strip')).not.toHaveClass('hidden');
    expect(screen.getByTestId('tickets-queue-command-card')).toHaveClass('hidden', 'md:block');
    expect(screen.getByTestId('tickets-queue-command-card')).toHaveTextContent('Proxima accion');
    expect(screen.getByTestId('tickets-queue-command-card')).toHaveTextContent('Responder ahora');
    expect(screen.getByTestId('tickets-queue-command-card')).toHaveTextContent('Score 135');
    expect(screen.getByTestId('tickets-queue-command-card')).toHaveTextContent('Hay actividad del vecino');
    fireEvent.click(screen.getByRole('button', { name: /atender prioridad recomendada/i }));

    expect(selectTicket).toHaveBeenCalledWith(2);
  });

  it('keeps channel, area and agent filters available in a compact desk summary', () => {
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

    const summary = screen.getByTestId('tickets-desk-active-filters');
    expect(summary).toHaveTextContent('Canal: whatsapp +2');
    expect(summary).toHaveAttribute(
      'title',
      'Canal: whatsapp | Area: obras | Agente: unassigned',
    );
    expect(summary).toHaveAccessibleName(
      'Filtros activos: Canal: whatsapp, Area: obras, Agente: unassigned',
    );
    expect(screen.queryByText('Canal: whatsapp')).not.toBeInTheDocument();
    expect(screen.queryByText('Area: obras')).not.toBeInTheDocument();
    expect(screen.queryByText('Agente: unassigned')).not.toBeInTheDocument();
  });

  it('opens CRM desk from heatmap query links with filters and selected ticket', async () => {
    const setFilters = vi.fn();
    const selectTicket = vi.fn();
    const targetTicket = {
      id: 378430,
      nro_ticket: 'M-378430',
      asunto: 'Arreglo de calle',
      categoria: 'Arreglo De Calle',
      estado: 'nuevo',
      fecha: '2026-06-01T10:00:00.000Z',
      tipo: 'municipio',
      channel: 'whatsapp',
    };
    const resolveTicketTarget = vi.fn().mockResolvedValue(targetTicket);
    searchParamsState.value = new URLSearchParams(
      'tab=tickets&focus=open_geocoding_queue&ticket_id=378430&categoria=Arreglo_De_Calle&canal=whatsapp',
    );
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [targetTicket],
      filteredTickets: [targetTicket],
      selectedTicket: targetTicket,
      selectTicket,
      ticketTargetResolution: {
        ticketId: 378430,
        status: 'resolved',
        ticket: targetTicket,
        message: null,
      },
      resolveTicketTarget,
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
      expect(resolveTicketTarget).toHaveBeenCalledWith(378430);
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
