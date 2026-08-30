import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Ticket } from '@/types/tickets';

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  updateTicket: vi.fn(),
  routingLoading: false,
  routingError: null as string | null,
  routingEligible: true,
  routingAssigneeId: null as string | null,
  routingRefresh: vi.fn(),
  user: { id: 10, name: 'Operadora Junín' } as Record<string, unknown>,
  ticket: null as Ticket | null,
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => ({ selectedTicket: mocks.ticket, updateTicket: mocks.updateTicket }),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useTicketRoutingAuthority', () => ({
  default: (ticket: Ticket | null) => {
    const employee = {
      id: '10',
      name: 'Operadora Junín',
      scope: { categorias: ['arbolado'], zonas: [], channels: [], permisos: [] },
      workload_open: 1,
      raw: { id: 10, email: 'operadora@junin.gob.ar' },
    };
    return {
      loading: Boolean(ticket) && mocks.routingLoading,
      error: Boolean(ticket) ? mocks.routingError : null,
      routing: null,
      refresh: mocks.routingRefresh,
      resolution: !ticket
        ? null
        : !ticket.source_model
          ? { ok: false, reason: 'missing_ticket_identity' }
        : {
            ok: true,
            authority: {
              identity: `${String(ticket.source_model).toLowerCase()}:${ticket.id}`,
              sourceModel: ticket.source_model,
              ticketId: String(ticket.id),
              ticket: {
                source_model: ticket.source_model,
                id: ticket.id,
                category: 'arbolado',
                assignee_id: mocks.routingAssigneeId,
              },
              recommendation: null,
              eligibleEmployees: mocks.routingEligible ? [employee] : [],
              suggestedEmployee: mocks.routingEligible ? employee : null,
              currentAssigneeId: mocks.routingAssigneeId,
              category: 'arbolado',
              zone: null,
              channel: 'whatsapp',
            },
          },
    };
  },
}));
vi.mock('@/api/v2/saas', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/api/v2/saas');
  return { ...actual, postOmnichannelInboxActionV2: (...args: unknown[]) => mocks.claim(...args) };
});

import TicketClaimButton from './TicketClaimButton';

const baseTicket: Ticket = {
  id: 77,
  tipo: 'municipio',
  nro_ticket: 'M-77',
  asunto: 'Árbol caído',
  estado: 'nuevo',
  fecha: '2026-08-27T10:00:00Z',
  categoria_id: 4,
  categoria: 'Arbolado',
  tenant_slug: 'junin',
};

describe('TicketClaimButton', () => {
  beforeEach(() => {
    mocks.claim.mockReset().mockResolvedValue({});
    mocks.updateTicket.mockReset();
    mocks.routingLoading = false;
    mocks.routingError = null;
    mocks.routingEligible = true;
    mocks.routingAssigneeId = null;
    mocks.routingRefresh.mockReset().mockResolvedValue(undefined);
    mocks.user = { id: 10, name: 'Operadora Junín' };
    mocks.ticket = { ...baseTicket };
  });

  it('falla cerrado sin source_model y nunca usa una asignación legacy no atómica', () => {
    render(<TicketClaimButton />);
    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeDisabled();
    expect(claim).toHaveAccessibleDescription(
      'El ticket no publica una identidad source_model + id válida para una toma atómica.',
    );
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('usa el claim omnicanal atómico cuando el ticket publica su modelo de origen', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    const onClaimConfirmed = vi.fn().mockResolvedValue(undefined);
    render(<TicketClaimButton onClaimConfirmed={onClaimConfirmed} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tomar ticket' }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledWith(
      '77',
      {
        action: 'claim',
        payload: {
          source_model: 'MunicipioTicket',
          ticket_id: 77,
        },
      },
      'junin',
    ));
    expect(mocks.updateTicket).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ assigned_user_id: 10 }),
      'MunicipioTicket',
    );
    expect(onClaimConfirmed).toHaveBeenCalledTimes(1);
  });

  it('usa exclusivamente la elegibilidad de employee.routing.v1 para habilitar el claim', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeEnabled();
    expect(claim).toHaveAttribute(
      'title',
      'El backend verificará tu permiso, tenant y categoría antes de asignar',
    );

    fireEvent.click(claim);

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(1));
    expect(mocks.updateTicket).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        assigned_user_id: 10,
        assignedAgent: expect.objectContaining({ id: 10, nombre_usuario: 'Operadora Junín' }),
      }),
      'MunicipioTicket',
    );
  });

  it('oculta Tomar ticket si employee.routing.v1 no publica al usuario como compatible', () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    mocks.routingEligible = false;

    render(<TicketClaimButton />);

    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('no confirma cambios cuando el backend rechaza rol o categoría en el claim atómico', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'TenantTicket' };
    mocks.claim.mockRejectedValueOnce(new (await import('@/utils/api')).ApiError(
      'Categoría incompatible',
      403,
    ));
    const onClaimConfirmed = vi.fn();
    render(<TicketClaimButton onClaimConfirmed={onClaimConfirmed} />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeEnabled();
    fireEvent.click(claim);

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(1));
    expect(mocks.updateTicket).not.toHaveBeenCalled();
    expect(onClaimConfirmed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tomar ticket' })).toBeEnabled();
  });

  it('bloquea la toma cuando falla la consulta de autoridad', () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    mocks.routingError = 'backend unavailable';
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeDisabled();
    expect(claim).toHaveAccessibleDescription('No se pudo verificar la autoridad de asignación con el backend.');
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('mantiene la acción bloqueada mientras la autoridad o la asignación están en vuelo', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    mocks.routingLoading = true;
    const view = render(<TicketClaimButton />);
    expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled();

    mocks.routingLoading = false;
    let resolveAssignment: (() => void) | null = null;
    mocks.claim.mockReturnValue(new Promise<void>((resolve) => { resolveAssignment = resolve; }));
    view.rerender(<TicketClaimButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Tomar ticket' }));
    expect(screen.getByRole('button', { name: 'Asignando…' })).toBeDisabled();

    await act(async () => resolveAssignment?.());
    expect(await screen.findByRole('button', { name: 'Asignado a mí' })).toBeDisabled();
  });

  it('no permite tomar un ticket asignado a otra persona y reserva la reasignación al supervisor', () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    mocks.routingAssigneeId = '22';
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeDisabled();
    expect(claim).toHaveAccessibleDescription(
      'El ticket ya tiene responsable. La reasignación se gestiona desde el inspector de supervisión.',
    );
  });
});
