import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

const useTicketsMock = vi.fn();
const adminGetTicketCategoriesMock = vi.fn();
const selectTicketMock = vi.fn();
const setFiltersMock = vi.fn();
const useTenantMock = vi.fn();

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => useTicketsMock(),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    adminGetTicketCategories: (...args: unknown[]) =>
      adminGetTicketCategoriesMock(...args),
  },
}));

vi.mock('@/services/exportService', () => ({
  exportToPdf: vi.fn(),
  exportToExcel: vi.fn(),
  exportAllToPdf: vi.fn(),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('./TicketListItem', () => ({
  default: ({
    ticket,
    onClick,
    compact,
    queueIndex,
    tabIndex,
    ariaDescribedBy,
    onKeyDown,
  }: {
    ticket: { id?: number | string; asunto?: string; nro_ticket?: string };
    onClick: () => void;
    compact?: boolean;
    queueIndex?: number;
    tabIndex?: number;
    ariaDescribedBy?: string;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  }) => (
    <button
      type="button"
      data-testid={`ticket-row-${ticket.id || ticket.nro_ticket || ticket.asunto}`}
      data-compact={compact ? 'true' : 'false'}
      data-ticket-queue-index={queueIndex}
      tabIndex={tabIndex}
      aria-describedby={ariaDescribedBy}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {ticket.asunto || ticket.nro_ticket}
    </button>
  ),
}));

const defaultFilters = {
  search: '',
  channel: 'all',
  status: 'all',
  area: 'all',
  agent: 'all',
  priority: 'all',
  sla: 'all',
  unread: 'all',
};

const defaultFilterOptions = {
  channels: [],
  statuses: [],
  areas: [],
  agents: [],
  priorities: [],
  slaStatuses: [],
  unreadModes: [{ value: 'all', label: 'Lectura: todos' }],
};

describe('Tickets Sidebar category density', () => {
  beforeEach(() => {
    adminGetTicketCategoriesMock.mockReset();
    selectTicketMock.mockReset();
    setFiltersMock.mockReset();
    adminGetTicketCategoriesMock.mockResolvedValue([]);
    useTenantMock.mockReturnValue({
      currentSlug: 'junin',
      tenant: { slug: 'junin', tipo: 'municipio' },
    });

    const ticket = {
      id: 378430,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo De Calle',
      categoria: 'Arreglo De Calle',
      estado: 'nuevo',
      priority: 'alta',
      hasUnreadMessages: true,
    };

    useTicketsMock.mockReturnValue({
      tickets: [ticket],
      filteredTickets: [ticket],
      ticketsByCategory: {
        'Arreglo De Calle': [ticket],
        luminaria: [],
        limpieza: [],
      },
      selectedTicket: null,
      selectTicket: selectTicketMock,
      filters: defaultFilters,
      setFilters: setFiltersMock,
      filterOptions: defaultFilterOptions,
    });
  });

  it('uses the authenticated tenant while public tenant data is still default', async () => {
    useTenantMock.mockReturnValue({
      currentSlug: 'junin',
      tenant: { slug: 'default', tipo: 'pyme' },
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });
    expect(adminGetTicketCategoriesMock).not.toHaveBeenCalledWith('default');
  });

  it('hides empty categories by default and lets operators reveal them', async () => {
    const { container } = render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.getByRole('button', { name: /^cola$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /^rubros$/i }));

    expect(await screen.findByText('Arreglo De Calle (1)')).toBeInTheDocument();
    expect(screen.queryByText('luminaria (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('limpieza (0)')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /mostrar 2 rubros vacios/i }),
    );

    expect(screen.getByText('luminaria (0)')).toBeInTheDocument();
    expect(screen.getByText('limpieza (0)')).toBeInTheDocument();
    const sidebarText = container.textContent ?? '';
    expect(sidebarText.indexOf('Arreglo De Calle (1)')).toBeLessThan(
      sidebarText.indexOf('luminaria (0)'),
    );
    expect(
      screen.getByRole('button', { name: /ocultar rubros vacios/i }),
    ).toBeInTheDocument();
  });
  it('keeps search and filter controls compact above the queue', async () => {
    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.getByTestId('sidebar-search-controls')).toBeInTheDocument();
    const summaryBar = screen.getByTestId('sidebar-list-summary-bar');
    expect(summaryBar).toHaveTextContent('Cola priorizada: 1 caso');
    expect(summaryBar).toHaveTextContent('Sin filtros');
    expect(summaryBar).toHaveTextContent('1 visible');
    expect(screen.queryByTestId('sidebar-primary-filters')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-shortcuts')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /filtros secundarios/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^todos$/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Canal: todos')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-active-chips')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-ticket-queue')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-row-378430')).toHaveAttribute(
      'data-compact',
      'true',
    );
    expect(screen.getByTestId('sidebar-queue-summary')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-queue-summary')).toHaveTextContent('Cola priorizada');
    expect(screen.getByTestId('sidebar-queue-metrics')).toHaveAccessibleName(
      'Cola priorizada, 1 caso, 1 no leidos, 1 en riesgo, 1 sin responsable',
    );
    expect(screen.getByTestId('sidebar-queue-metrics')).toHaveTextContent('Cola');
    expect(screen.getByTestId('sidebar-queue-metrics')).toHaveTextContent('No leidos');
    expect(screen.getByTestId('sidebar-queue-metrics')).toHaveTextContent('Riesgo');
    expect(screen.getByTestId('sidebar-queue-metrics')).toHaveTextContent('Sin resp.');
    expect(screen.getByRole('button', { name: /^cola$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText('Arreglo De Calle (1)')).not.toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /filtros secundarios/i }));

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-filter-panel')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sidebar-inline-filters')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-filter-shortcuts')).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /filtros rapidos de reclamos/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^todos$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /no le/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /sin resp/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByDisplayValue('Canal: todos')).toBeInTheDocument();
    expect(screen.getByLabelText(/filtrar por canal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filtrar por estado/i)).toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle')).toBeInTheDocument();
  });

  it('supports keyboard-first navigation through the prioritized queue', async () => {
    const tickets = [
      {
        id: 101,
        tipo: 'municipio',
        nro_ticket: 'M-101',
        asunto: 'Caso uno',
        categoria: 'Luminarias',
        estado: 'nuevo',
        priority: 'alta',
      },
      {
        id: 102,
        tipo: 'municipio',
        nro_ticket: 'M-102',
        asunto: 'Caso dos',
        categoria: 'Luminarias',
        estado: 'nuevo',
        priority: 'media',
      },
      {
        id: 103,
        tipo: 'municipio',
        nro_ticket: 'M-103',
        asunto: 'Caso tres',
        categoria: 'Luminarias',
        estado: 'nuevo',
        priority: 'baja',
      },
    ];

    useTicketsMock.mockReturnValue({
      tickets,
      filteredTickets: tickets,
      ticketsByCategory: { Luminarias: tickets },
      selectedTicket: tickets[1],
      selectTicket: selectTicketMock,
      filters: defaultFilters,
      setFilters: setFiltersMock,
      filterOptions: defaultFilterOptions,
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    const first = screen.getByTestId('ticket-row-101');
    const second = screen.getByTestId('ticket-row-102');
    const third = screen.getByTestId('ticket-row-103');
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(second).toHaveAttribute('tabindex', '0');
    expect(third).toHaveAttribute('tabindex', '-1');

    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(selectTicketMock).toHaveBeenCalledWith(103);
    await waitFor(() => expect(third).toHaveFocus());

    fireEvent.keyDown(third, { key: 'Home' });
    expect(selectTicketMock).toHaveBeenLastCalledWith(101);
    await waitFor(() => expect(first).toHaveFocus());
  });

  it('promotes sidebar search to the server-side ticket filters', async () => {
    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    fireEvent.change(screen.getByPlaceholderText('Buscar por nro, asunto o vecino...'), {
      target: { value: 'Don Bosco' },
    });

    await waitFor(() => {
      expect(setFiltersMock).toHaveBeenCalledWith(expect.any(Function));
    });

    const updater = setFiltersMock.mock.calls[setFiltersMock.mock.calls.length - 1]?.[0] as (
      previous: typeof defaultFilters,
    ) => typeof defaultFilters;
    expect(updater(defaultFilters)).toMatchObject({ search: 'Don Bosco' });
  });

  it('lets operators jump from prioritized queue context into rubros and back', async () => {
    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    fireEvent.click(screen.getByRole('button', { name: /^rubros$/i }));

    expect(screen.getByTestId('sidebar-list-summary-bar')).toHaveTextContent('Rubros: 1 visible');
    expect(screen.getByTestId('sidebar-category-summary')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-category-summary')).toHaveTextContent('Vista por rubro');
    expect(screen.getByText('Arreglo De Calle (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /arreglo de calle \(1\)/i }));
    expect(screen.getByTestId('ticket-row-378430')).toHaveAttribute(
      'data-compact',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: /^cola$/i }));

    expect(screen.getByTestId('sidebar-queue-summary')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-queue-summary')).toHaveTextContent('Cola priorizada');
    expect(screen.getByTestId('ticket-row-378430')).toHaveAttribute(
      'data-compact',
      'true',
    );
    expect(screen.queryByText('Arreglo De Calle (1)')).not.toBeInTheDocument();
  });

  it('keeps active filter chips inside the floating filter panel', async () => {
    const ticket = {
      id: 378430,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo De Calle',
      categoria: 'Arreglo De Calle',
      estado: 'nuevo',
    };

    useTicketsMock.mockReturnValue({
      tickets: [ticket],
      filteredTickets: [ticket],
      ticketsByCategory: {
        'Arreglo De Calle': [ticket],
      },
      selectedTicket: null,
      selectTicket: selectTicketMock,
      filters: { ...defaultFilters, channel: 'whatsapp' },
      setFilters: setFiltersMock,
      filterOptions: {
        ...defaultFilterOptions,
        channels: ['whatsapp'],
      },
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    const trigger = screen.getByRole('button', {
      name: /filtros secundarios, 1 activo/i,
    });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('1');
    const summaryBar = screen.getByTestId('sidebar-list-summary-bar');
    expect(summaryBar).toHaveTextContent('1 activo');
    expect(summaryBar).toHaveAttribute('title', 'Canal: whatsapp');
    expect(screen.queryByTestId('sidebar-active-filter-chips')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-active-chips')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-filter-panel')).toBeInTheDocument();
    });
    const chips = screen.getByTestId('sidebar-filter-active-chips');
    expect(chips).toHaveAccessibleName('Filtros activos aplicados');
    expect(chips).toHaveTextContent('Canal: whatsapp');
    expect(screen.getByRole('button', { name: /^limpiar$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros de la vista/i }));
    expect(setFiltersMock).toHaveBeenCalledWith(defaultFilters);
  });

  it('keeps active filters out of the compact vertical flow so the queue starts higher', async () => {
    const ticket = {
      id: 378430,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo De Calle',
      categoria: 'Arreglo De Calle',
      estado: 'nuevo',
    };

    useTicketsMock.mockReturnValue({
      tickets: [ticket],
      filteredTickets: [ticket],
      ticketsByCategory: {
        'Arreglo De Calle': [ticket],
      },
      selectedTicket: null,
      selectTicket: selectTicketMock,
      filters: { ...defaultFilters, channel: 'whatsapp' },
      setFilters: setFiltersMock,
      filterOptions: {
        ...defaultFilterOptions,
        channels: ['whatsapp'],
      },
    });

    render(<Sidebar compact />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.getByRole('button', { name: /filtros secundarios, 1 activo/i })).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-primary-filters')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-compact-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-list-mode-toggle')).toHaveAttribute('data-layout', 'toolbar');
    const summaryBar = screen.getByTestId('sidebar-list-summary-bar');
    expect(summaryBar).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: /limpiar filtros activos/i })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-ticket-queue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cola$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('sidebar-active-filter-chips')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-active-chips')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar reclamo...')).toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle')).toBeInTheDocument();
  });

  it('can delegate filter controls to the parent header in compact CRM embeds', async () => {
    const ticket = {
      id: 378430,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo De Calle',
      categoria: 'Arreglo De Calle',
      estado: 'nuevo',
    };

    useTicketsMock.mockReturnValue({
      tickets: [ticket],
      filteredTickets: [ticket],
      ticketsByCategory: {
        'Arreglo De Calle': [ticket],
      },
      selectedTicket: null,
      selectTicket: selectTicketMock,
      filters: { ...defaultFilters, channel: 'whatsapp' },
      setFilters: setFiltersMock,
      filterOptions: {
        ...defaultFilterOptions,
        channels: ['whatsapp'],
      },
    });

    render(<Sidebar compact showFilterControl={false} />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.queryByRole('button', { name: /filtros secundarios/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-search-controls')).toHaveAttribute('data-density', 'delegated');
    expect(screen.getByTestId('sidebar-compact-summary')).not.toHaveClass('hidden');
    expect(screen.getByTestId('sidebar-compact-summary')).toHaveTextContent('1/1');
    const summaryBar = screen.getByTestId('sidebar-list-summary-bar');
    expect(summaryBar).toHaveClass('sr-only');
    expect(summaryBar).toHaveTextContent('1 activo');
    expect(summaryBar).toHaveTextContent('1 visible');
    expect(screen.queryByRole('button', { name: /^exportar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar filtros activos/i })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-ticket-queue')).toBeInTheDocument();
  });

  it('uses a lightweight work queue header when desktop CRM delegates filters upstream', async () => {
    render(<Sidebar showFilterControl={false} showListSummaryBar={false} />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.getByTestId('sidebar-search-controls')).toHaveAttribute('data-density', 'delegated');
    expect(screen.queryByRole('button', { name: /filtros secundarios/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-list-mode-toggle')).toHaveAttribute('data-layout', 'toolbar');
    expect(screen.getByRole('button', { name: /^cola$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^rubros$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^exportar$/i })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-list-summary-bar')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-ticket-queue')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-queue-metrics')).toHaveAccessibleName(
      'Cola priorizada, 1 caso, 1 no leidos, 1 en riesgo, 1 sin responsable',
    );
    expect(screen.getByTestId('ticket-row-378430')).toHaveAttribute(
      'data-compact',
      'true',
    );
  });

  it('can delegate the list summary bar to the parent operational header', async () => {
    render(<Sidebar compact showFilterControl={false} showListSummaryBar={false} />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.queryByRole('button', { name: /filtros secundarios/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-list-summary-bar')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-search-controls')).toHaveAttribute('data-density', 'delegated');
    expect(screen.getByTestId('sidebar-ticket-queue')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-row-378430')).toHaveAttribute(
      'data-compact',
      'true',
    );
  });

  it('keeps the passive compact summary out of the visual flow when no filters are active', async () => {
    render(<Sidebar compact />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(screen.getByTestId('sidebar-search-controls')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-list-summary-bar')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-ticket-queue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /limpiar filtros de la vista/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-filter-shortcuts')).not.toBeInTheDocument();
  });

  it('uses Todos as a true reset and exposes unassigned as an operational shortcut', async () => {
    const ticket = {
      id: 378430,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo De Calle',
      categoria: 'Arreglo De Calle',
      estado: 'nuevo',
    };

    useTicketsMock.mockReturnValue({
      tickets: [ticket],
      filteredTickets: [ticket],
      ticketsByCategory: {
        'Arreglo De Calle': [ticket],
      },
      selectedTicket: null,
      selectTicket: selectTicketMock,
      filters: { ...defaultFilters, channel: 'whatsapp' },
      setFilters: setFiltersMock,
      filterOptions: {
        ...defaultFilterOptions,
        channels: ['whatsapp'],
      },
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    fireEvent.click(screen.getByRole('button', { name: /filtros secundarios/i }));

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-filter-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^todos$/i }));
    expect(setFiltersMock).toHaveBeenCalledWith(defaultFilters);

    fireEvent.click(screen.getByRole('button', { name: /sin resp/i }));
    expect(setFiltersMock).toHaveBeenCalledWith(expect.any(Function));
    const lastCall = setFiltersMock.mock.calls[setFiltersMock.mock.calls.length - 1];
    const updater = lastCall?.[0] as (previous: typeof defaultFilters) => typeof defaultFilters;
    expect(updater(defaultFilters)).toMatchObject({ agent: 'unassigned' });
  });
});
