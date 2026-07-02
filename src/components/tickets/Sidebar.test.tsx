import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

const useTicketsMock = vi.fn();
const adminGetTicketCategoriesMock = vi.fn();
const selectTicketMock = vi.fn();
const setFiltersMock = vi.fn();

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: { slug: 'junin', tipo: 'municipio' } }),
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
  }: {
    ticket: { asunto?: string; nro_ticket?: string };
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {ticket.asunto || ticket.nro_ticket}
    </button>
  ),
}));

const defaultFilters = {
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
    expect(screen.getByTestId('sidebar-queue-summary')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-queue-summary')).toHaveTextContent('Cola priorizada');
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

    fireEvent.click(screen.getByRole('button', { name: /^cola$/i }));

    expect(screen.getByTestId('sidebar-queue-summary')).toHaveClass('sr-only');
    expect(screen.getByTestId('sidebar-queue-summary')).toHaveTextContent('Cola priorizada');
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
