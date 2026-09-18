import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  failureReason: 'invalid_contract',
  eligible: true,
  currentAssigneeId: null as string | null,
  postAction: vi.fn(),
  updateTicket: vi.fn(),
  refresh: vi.fn(),
  invalidateQueries: vi.fn(),
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
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  };
});
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
        : { ok: false, reason: mocks.failureReason },
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
    mocks.ticket = {
      id: 403,
      tipo: 'municipio',
      estado: 'nuevo',
      source_model: 'MunicipioTicket',
      categoria: 'General',
      tenant_slug: 'junin',
    } as Ticket;
    mocks.user = { id: 10, name: 'Operadora Junín', rol: 'empleado' };
    mocks.hasAssignCapability = false;
    mocks.loading = false;
    mocks.error = null;
    mocks.resolutionOk = true;
    mocks.failureReason = 'invalid_contract';
    mocks.eligible = true;
    mocks.currentAssigneeId = null;
    mocks.postAction.mockReset().mockResolvedValue({});
    mocks.updateTicket.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  it('muestra Tomar ticket al empleado compatible sin exponer el selector', () => {
    render(<TicketAssignment />);

    expect(screen.getByTestId('ticket-assignment-employee-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar ticket' })).toBeEnabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/luminarias/i)).toBeInTheDocument();
  });

  it('permite tomar el caso desde el control compacto sin mutarlo al montar', async () => {
    render(<TicketAssignment variant="compact" />);

    expect(screen.getByTestId('ticket-assignment-employee-view')).toHaveAttribute(
      'data-variant',
      'compact',
    );
    expect(mocks.postAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Tomar ticket' }));

    await waitFor(() => expect(mocks.postAction).toHaveBeenCalledWith(
      '403',
      {
        action: 'claim',
        payload: {
          source_model: 'MunicipioTicket',
          ticket_id: 403,
        },
      },
      'junin',
    ));
    expect(mocks.updateTicket).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ticket-composer-action-contract'],
    });
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

  it('compacta la reasignación supervisada en una sola superficie', async () => {
    mocks.user = { id: 99, name: 'Supervisora', rol: 'supervisor' };
    mocks.currentAssigneeId = '22';
    render(<TicketAssignment variant="compact" />);

    const ownership = screen.getByTestId('ticket-assignment-supervisor-view');
    expect(ownership).toHaveAttribute('data-variant', 'compact');
    expect(within(ownership).getByRole('combobox', { name: 'Responsable compatible' })).toBeEnabled();
    expect(within(ownership).getByRole('button', { name: 'Reasignar' })).toBeEnabled();
    expect(within(ownership).queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(within(ownership).queryByRole('button', { name: 'Aplicar sugerencia' })).not.toBeInTheDocument();

    fireEvent.click(within(ownership).getByRole('button', { name: 'Reasignar' }));

    await waitFor(() => expect(mocks.postAction).toHaveBeenCalledWith(
      '403',
      {
        action: 'assign',
        payload: {
          source_model: 'MunicipioTicket',
          ticket_id: 403,
          assignee_id: 10,
          expected_assignee_id: 22,
        },
      },
      'junin',
    ));
  });

  it('no muestra un responsable cacheado si su identidad difiere de la autoridad', () => {
    mocks.user = { id: 99, name: 'Supervisora', rol: 'supervisor' };
    mocks.currentAssigneeId = '22';
    mocks.ticket = {
      ...mocks.ticket,
      assignedAgentId: 77,
      assigned_agent_id: 77,
      assignedAgent: {
        id: 77,
        nombre_usuario: 'Responsable cacheado',
        email: 'cacheado@junin.gob.ar',
      },
    };

    render(<TicketAssignment variant="compact" />);

    const ownership = screen.getByTestId('ticket-assignment-supervisor-view');
    expect(within(ownership).getByText('Responsable #22')).toBeInTheDocument();
    expect(within(ownership).queryByText('Responsable cacheado')).not.toBeInTheDocument();
  });

  it('falla cerrado y no monta acciones si el contrato autoritativo falta', () => {
    mocks.resolutionOk = false;
    render(<TicketAssignment variant="compact" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Asignación protegida');
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it.each(['missing_ticket_identity', 'ticket_not_published', 'invalid_contract', 'conflicting_authority'])(
    'explica %s sin códigos técnicos y conserva el bloqueo',
    (reason) => {
      mocks.resolutionOk = false;
      mocks.failureReason = reason;
      render(<TicketAssignment variant="compact" />);

      expect(screen.getByRole('alert')).toHaveTextContent('Actualizá la bandeja');
      expect(screen.getByRole('alert')).not.toHaveTextContent(/source_model|employee\.routing|backend|tenant|autoritativ/);
      expect(screen.queryByRole('button', { name: /Asignar|Tomar ticket/ })).not.toBeInTheDocument();
      expect(mocks.postAction).not.toHaveBeenCalled();
    },
  );

  it('distingue un contrato ausente de datos autoritativos contradictorios', () => {
    mocks.resolutionOk = false;
    mocks.failureReason = 'conflicting_authority';
    render(<TicketAssignment variant="compact" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Los datos de responsable de este caso no coinciden',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'employee.routing.v1',
    );
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
