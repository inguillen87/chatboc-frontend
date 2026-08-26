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

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: { id: 77 } }),
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
    showQueueMetrics = true,
  }: {
    className?: string;
    showFilterControl?: boolean;
    showListSummaryBar?: boolean;
    showQueueMetrics?: boolean;
  }) => (
    <aside
      className={className}
      data-show-filter-control={showFilterControl ? 'true' : 'false'}
      data-show-list-summary-bar={showListSummaryBar ? 'true' : 'false'}
      data-show-queue-metrics={showQueueMetrics ? 'true' : 'false'}
      data-testid="tickets-sidebar"
    >
      Reclamos
    </aside>
  ),
}));

vi.mock('./ConversationPanel', () => ({
  default: ({
    operationalWorkspace,
    isSidebarVisible,
    isDetailsVisible,
    onToggleSidebar,
    onToggleDetails,
  }: {
    operationalWorkspace?: boolean;
    isSidebarVisible?: boolean;
    isDetailsVisible?: boolean;
    onToggleSidebar?: () => void;
    onToggleDetails?: () => void;
  }) => (
    <section data-testid="tickets-conversation" data-operational-workspace={operationalWorkspace ? 'true' : 'false'}>
      Conversacion
      {onToggleSidebar ? (
        <button type="button" onClick={onToggleSidebar}>
          {isSidebarVisible ? 'Ocultar lista de tickets' : 'Mostrar lista de tickets'}
        </button>
      ) : null}
      {onToggleDetails ? (
        <button type="button" onClick={onToggleDetails}>
          {isDetailsVisible ? 'Ocultar detalles del ticket' : 'Ver detalles del ticket'}
        </button>
      ) : null}
    </section>
  ),
}));

vi.mock('./DetailsPanel', () => ({
  default: ({ operationalWorkspace, onClose }: { operationalWorkspace?: boolean; onClose?: () => void }) => (
    <section data-testid="tickets-details" data-operational-workspace={operationalWorkspace ? 'true' : 'false'}>
      Detalle
      {onClose ? (
        <button type="button" aria-label="Cerrar detalles del ticket" onClick={onClose}>
          Cerrar inspector
        </button>
      ) : null}
    </section>
  ),
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

describe('NewTicketsPanel CRM layout', () => {
  beforeEach(() => {
    window.localStorage.clear();
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

    const loadingState = screen.getByRole('status', { name: /preparando el centro de reclamos/i });
    expect(loadingState).toBeInTheDocument();
    expect(loadingState).not.toHaveClass('min-h-[520px]');
    expect(screen.getByText(/ordenando la cola y recuperando las conversaciones/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
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

      expect(screen.getByText(/la bandeja tarda más de lo esperado/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar carga/i })).toBeInTheDocument();
      expect(screen.getByTestId('tickets-loading-timeout-state')).not.toHaveClass('min-h-[520px]');
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

  it('propaga source_model al resolver un deep link con ID potencialmente colisionado', () => {
    const resolveTicketTarget = vi.fn().mockReturnValue(new Promise(() => {}));
    searchParamsState.value = new URLSearchParams(
      'ticket_id=99&source_model=PymeTicket&focus=operational_queue',
    );
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [],
      filteredTickets: [],
      selectedTicket: null,
      selectTicket: vi.fn(),
      ticketTargetResolution: {
        ticketId: 99,
        sourceModel: 'PymeTicket',
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
    expect(resolveTicketTarget).toHaveBeenCalledWith(99, 'PymeTicket');
  });

  it('rechaza source_model desconocido sin caer en una busqueda ambigua por ID', () => {
    const resolveTicketTarget = vi.fn().mockResolvedValue(null);
    searchParamsState.value = new URLSearchParams('ticket_id=99&source_model=Order');
    useTicketsMock.mockReturnValue({
      loading: false,
      error: null,
      tickets: [],
      filteredTickets: [],
      selectedTicket: null,
      selectTicket: vi.fn(),
      ticketTargetResolution: {
        ticketId: null,
        sourceModel: null,
        status: 'idle',
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

    expect(screen.getByRole('alert')).toHaveTextContent('El enlace del caso no es valido');
    expect(screen.getByRole('alert')).toHaveTextContent('origen indicado no pertenece al contrato');
    expect(resolveTicketTarget).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /reintentar apertura/i })).not.toBeInTheDocument();
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

    expect(screen.getByTestId('tickets-error-state')).not.toHaveClass('min-h-[520px]');
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
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-queue-metrics', 'false');
    expect(screen.queryByTestId('tickets-desk-filter-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ticket-ops-stat-strip')).not.toBeInTheDocument();
    expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(300px, 320px) minmax(0, 1fr)',
    });
    expect(screen.getByRole('heading', { name: 'Cola priorizada' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Caso y conversación' })).toBeInTheDocument();
    expect(screen.queryByTestId('tickets-operational-continuity')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByTestId('tickets-desk-filter-button')).toBeInTheDocument();
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
    expect(screen.getByTestId('tickets-embedded-ops-header')).toHaveTextContent('Centro de reclamos');
    expect(screen.getByTestId('tickets-embedded-ops-header').firstElementChild).toHaveClass('min-h-12');
    expect(screen.queryByTestId('tickets-header-filter-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-filter-control', 'false');
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-list-summary-bar', 'false');
    expect(screen.getByTestId('tickets-sidebar')).toHaveAttribute('data-show-queue-metrics', 'false');
    expect(screen.queryByTestId('ticket-ops-stat-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tickets-embedded-kpi-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(300px, 320px) minmax(0, 1fr)',
    });
    expect(screen.getByTestId('tickets-list-region')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.getByTestId('tickets-conversation-region')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.queryByTestId('tickets-operational-continuity')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /realtime/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('tickets-conversation')).toHaveAttribute('data-operational-workspace', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByTestId('tickets-header-filter-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /operación de cuadrillas/i })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /más opciones/i }));
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

  it('prioritizes the conversation and adapts the inspector across desktop widths', async () => {
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
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      const narrow = render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(300px, 320px) minmax(0, 1fr)',
      });
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveAttribute('data-detail-presentation', 'collapsed');
      narrow.unmount();
      window.localStorage.clear();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1180 });
      const commonDesktop = render(<NewTicketsPanel embedded />);
      await waitFor(() => {
        expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
          gridTemplateColumns: 'minmax(560px, 1fr) 420px',
        });
      });
      expect(screen.queryByTestId('tickets-list-region')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Resolución guiada' })).toBeInTheDocument();
      expect(screen.getByTestId('tickets-details')).toHaveAttribute('data-operational-workspace', 'true');
      commonDesktop.unmount();
      window.localStorage.clear();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
      const mediumDesktop = render(<NewTicketsPanel embedded />);
      await waitFor(() => {
        expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
          gridTemplateColumns: 'minmax(560px, 1fr) 420px',
        });
      });
      expect(screen.queryByTestId('tickets-list-region')).not.toBeInTheDocument();
      expect(screen.getByTestId('tickets-detail-region')).toHaveClass('min-h-0', 'overflow-hidden');
      mediumDesktop.unmount();
      window.localStorage.clear();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
      const wideDesktop = render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(300px, 320px) minmax(560px, 1fr) 420px',
      });
      expect(screen.getByTestId('tickets-list-region')).toBeInTheDocument();
      wideDesktop.unmount();
      window.localStorage.clear();

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
      render(<NewTicketsPanel embedded />);
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(300px, 320px) minmax(560px, 1fr) 420px',
      });
      expect(screen.getByRole('separator', { name: /ajustar ancho del inspector/i })).toHaveAttribute(
        'aria-valuenow',
        '420',
      );
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('opens the inspector as a drawer at 1024px and restores the ticket list when it closes', async () => {
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
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      render(<NewTicketsPanel embedded />);

      expect(screen.getByTestId('tickets-list-region')).toBeInTheDocument();
      const detailsTrigger = screen.getByRole('button', { name: /ver detalles del ticket/i });
      detailsTrigger.focus();
      fireEvent.click(detailsTrigger);

      await waitFor(() => expect(screen.getByTestId('tickets-detail-drawer')).toBeInTheDocument());
      expect(screen.getByTestId('tickets-detail-drawer')).toHaveAttribute('role', 'dialog');
      expect(screen.getByTestId('tickets-detail-drawer')).toHaveAttribute('aria-modal', 'false');
      expect(screen.queryByTestId('tickets-list-region')).not.toBeInTheDocument();
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(0, 1fr)',
      });
      await waitFor(() => expect(screen.getByRole('button', { name: /cerrar detalles del ticket/i })).toHaveFocus());

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByTestId('tickets-detail-drawer')).not.toBeInTheDocument());
      expect(screen.getByTestId('tickets-list-region')).toBeInTheDocument();
      await waitFor(() => expect(detailsTrigger).toHaveFocus());
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('caps a persisted 520px drawer so 560px of conversation remain available at 1024px', async () => {
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
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      window.localStorage.setItem(
        'chatboc:tickets:inspector-layout:junin:77',
        JSON.stringify({ open: true, width: 520 }),
      );
      render(<NewTicketsPanel embedded />);

      const drawer = await screen.findByTestId('tickets-detail-drawer');
      const separator = screen.getByRole('separator', { name: /ajustar ancho del inspector/i });
      expect(drawer).toHaveAttribute('data-inspector-width', '464');
      expect(drawer).toHaveStyle({ width: '464px' });
      expect(separator).toHaveAttribute('aria-valuemax', '464');
      expect(separator).toHaveAttribute('aria-valuenow', '464');

      await new Promise((resolve) => window.setTimeout(resolve, 220));
      expect(JSON.parse(window.localStorage.getItem('chatboc:tickets:inspector-layout:junin:77') || '{}')).toEqual({
        open: true,
        width: 520,
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('swaps the inspector for the queue below 1440px instead of reopening three columns', async () => {
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
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
      render(<NewTicketsPanel embedded />);
      await waitFor(() => expect(screen.getByTestId('tickets-detail-region')).toBeInTheDocument());
      expect(screen.queryByTestId('tickets-list-region')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /mostrar lista de tickets/i }));

      await waitFor(() => expect(screen.queryByTestId('tickets-detail-region')).not.toBeInTheDocument());
      expect(screen.getByTestId('tickets-list-region')).toBeInTheDocument();
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(300px, 320px) minmax(0, 1fr)',
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('resizes the inspector with keyboard controls and persists the preference per tenant and user', async () => {
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
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
      render(<NewTicketsPanel embedded />);
      const separator = screen.getByRole('separator', { name: /ajustar ancho del inspector/i });

      fireEvent.keyDown(separator, { key: 'ArrowLeft' });
      expect(separator).toHaveAttribute('aria-valuenow', '440');
      expect(screen.getByTestId('tickets-desktop-grid')).toHaveStyle({
        gridTemplateColumns: 'minmax(300px, 320px) minmax(560px, 1fr) 440px',
      });

      fireEvent.keyDown(separator, { key: 'End' });
      expect(separator).toHaveAttribute('aria-valuenow', '520');

      await waitFor(() => {
        expect(JSON.parse(window.localStorage.getItem('chatboc:tickets:inspector-layout:junin:77') || '{}')).toEqual({
          open: true,
          width: 520,
        });
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('keeps the mobile tabs and active panel inside a clipped full-height viewport', () => {
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
    expect(screen.getByRole('tablist', { name: 'Vistas de tickets' })).toBeInTheDocument();

    const ticketsTab = screen.getByRole('tab', { name: 'Tickets' });
    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    const detailsTab = screen.getByRole('tab', { name: 'Info' });

    expect(ticketsTab).toHaveAttribute('aria-selected', 'true');
    expect(ticketsTab).toHaveAttribute('aria-controls', 'tickets-mobile-panel-tickets');
    expect(screen.getByRole('tabpanel', { name: 'Tickets' })).toHaveAttribute(
      'id',
      'tickets-mobile-panel-tickets',
    );

    fireEvent.click(chatTab);

    expect(screen.getByTestId('tickets-conversation')).toBeInTheDocument();
    expect(chatTab).toHaveAttribute('aria-selected', 'true');
    expect(chatTab).toHaveAttribute('tabindex', '0');
    expect(ticketsTab).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Chat' })).toHaveAttribute(
      'aria-labelledby',
      'tickets-mobile-tab-chat',
    );

    fireEvent.keyDown(chatTab, { key: 'ArrowRight' });

    expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Info' })).toContainElement(
      screen.getByTestId('tickets-details'),
    );
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

    expect(screen.queryByTestId('tickets-next-priority-strip')).not.toBeInTheDocument();
    expect(screen.queryByText('Score 135')).not.toBeInTheDocument();
    expect(screen.queryByText('Hay actividad del vecino')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tickets-queue-command-card')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /atender prioridad/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /más opciones/i }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByTestId('tickets-deeplink-focus')).toHaveTextContent('open geocoding queue');
  });
});
