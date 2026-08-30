import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Ticket } from '@/types/tickets';

const mocks = vi.hoisted(() => ({
  user: { id: 10, name: 'Operadora Junín', rol: 'empleado' } as Record<string, unknown>,
  hasAssignCapability: false,
  ticket: {
    id: 403,
    tipo: 'municipio',
    estado: 'nuevo',
    source_model: 'MunicipioTicket',
    categoria: 'General',
    tenant_slug: 'junin',
  } as Ticket,
  loading: false,
  error: null as string | null,
  resolutionOk: true,
  eligible: true,
  currentAssigneeId: null as string | null,
  postAction: vi.fn(),
  updateTicket: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => ({
    selectedTicket: mocks.ticket,
    updateTicket: mocks.updateTicket,
  }),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: mocks.user }),
}));
vi.mock('@/context/CapabilitiesContext', () => ({
  useCapabilities: () => ({
    hasCapability: (capability: string) => capability === 'tickets.assign' && mocks.hasAssignCapability,
  }),
}));
vi.mock('@/hooks/useTicketRoutingAuthority', () => ({
  default: () => {
    const employee = {
      id: '10',
      name: 'Operadora Junín',
      scope: { categorias: ['luminarias'], zonas: ['centro'], channels: ['whatsapp'], permisos: [] },
      workload_open: 2,
      raw: { id: 10, email: 'operadora@junin.gob.ar' },
    };
    return {
      loading: mocks.loading,
      error: mocks.error,
      routing: null,
      refresh: mocks.refresh,
      resolution: mocks.resolutionOk
        ? {
            ok: true,
            authority: {
              identity: 'municipioticket:403',
              sourceModel: 'MunicipioTicket',
              ticketId: '403',
              ticket: {
                source_model: 'MunicipioTicket',
                id: 403,
                category: 'luminarias',
                zone: 'centro',
                channel: 'whatsapp',
                assignee_id: mocks.currentAssigneeId,
              },
              recommendation: {
                id: 'municipioticket_403',
                ticket: { source_model: 'MunicipioTicket', id: 403 },
                suggested_assignee: { id: 10, name: 'Operadora Junín' },
                score: 91,
                reasons: ['category_match', 'zone_match'],
                raw: {},
              },
              eligibleEmployees: mocks.eligible ? [employee] : [],
              suggestedEmployee: mocks.eligible ? employee : null,
              currentAssigneeId: mocks.currentAssigneeId,
              category: 'luminarias',
              zone: 'centro',
              channel: 'whatsapp',
            },
          }
        : { ok: false, reason: 'invalid_contract' },
    };
  },
}));
vi.mock('@/api/v2/saas', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/api/v2/saas');
  return {
    ...actual,
    postOmnichannelInboxActionV2: (...args: unknown[]) => mocks.postAction(...args),
  };
});

import TicketAssignment from './TicketAssignment';

describe('TicketAssignment enterprise authority UI', () => {
  beforeEach(() => {
    mocks.user = { id: 10, name: 'Operadora Junín', rol: 'empleado' };
    mocks.hasAssignCapability = false;
    mocks.loading = false;
    mocks.error = null;
    mocks.resolutionOk = true;
    mocks.eligible = true;
    mocks.currentAssigneeId = null;
    mocks.postAction.mockReset().mockResolvedValue({});
    mocks.updateTicket.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
  });

  it('muestra Tomar ticket al empleado compatible sin exponer el selector', () => {
    render(<TicketAssignment />);

    expect(screen.getByTestId('ticket-assignment-employee-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar ticket' })).toBeEnabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/luminarias/i)).toBeInTheDocument();
  });

  it('reserva el selector y la recomendación a supervisión o tickets.assign', async () => {
    mocks.user = { id: 99, name: 'Supervisora', rol: 'supervisor' };
    render(<TicketAssignment />);

    expect(screen.getByTestId('ticket-assignment-supervisor-view')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Operadora Junín')).toBeInTheDocument();
    expect(screen.getByText('Categoría compatible')).toBeInTheDocument();
    expect(screen.getByText('Carga actual: 2 casos abiertos.')).toBeInTheDocument();

    const assign = screen.getByRole('button', { name: 'Asignar' });
    await waitFor(() => expect(assign).toBeEnabled());
    fireEvent.click(assign);

    await waitFor(() => expect(mocks.postAction).toHaveBeenCalledWith(
      '403',
      {
        action: 'assign',
        payload: {
          source_model: 'MunicipioTicket',
          ticket_id: 403,
          assignee_id: 10,
          expected_assignee_id: null,
        },
      },
      'junin',
    ));
  });

  it('falla cerrado y no monta acciones si el contrato autoritativo falta', () => {
    mocks.resolutionOk = false;
    render(<TicketAssignment />);

    expect(screen.getByRole('alert')).toHaveTextContent('Asignación protegida');
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
