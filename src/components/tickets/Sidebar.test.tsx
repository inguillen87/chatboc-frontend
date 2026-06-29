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
    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(await screen.findByText('Arreglo De Calle (1)')).toBeInTheDocument();
    expect(screen.queryByText('luminaria (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('limpieza (0)')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /mostrar 2 rubros vacíos/i }),
    );

    expect(screen.getByText('luminaria (0)')).toBeInTheDocument();
    expect(screen.getByText('limpieza (0)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ocultar rubros vacíos/i }),
    ).toBeInTheDocument();
  });
  it('keeps secondary filters collapsed so the ticket accordion stays readable', async () => {
    render(<Sidebar />);

    await waitFor(() => {
      expect(adminGetTicketCategoriesMock).toHaveBeenCalledWith('junin');
    });

    expect(
      screen.getByRole('button', { name: /filtros avanzados/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByDisplayValue('Canal: todos')).not.toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /filtros avanzados/i }));

    expect(
      screen.getByRole('button', { name: /filtros avanzados/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByDisplayValue('Canal: todos')).toBeInTheDocument();
  });
});
