import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Ticket } from '@/types/tickets';

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  claim: vi.fn(),
  updateTicket: vi.fn(),
  agents: [] as Array<Record<string, unknown>>,
  loading: false,
  error: null as string | null,
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
vi.mock('@/hooks/useAssignableAgents', () => ({
  default: () => ({ agents: mocks.agents, loading: mocks.loading, error: mocks.error }),
}));
vi.mock('@/services/ticketService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/ticketService');
  return { ...actual, assignTicketToAgent: (...args: unknown[]) => mocks.assign(...args) };
});
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
    mocks.assign.mockReset().mockResolvedValue(undefined);
    mocks.claim.mockReset().mockResolvedValue({});
    mocks.updateTicket.mockReset();
    mocks.loading = false;
    mocks.error = null;
    mocks.user = { id: 10, name: 'Operadora Junín' };
    mocks.ticket = { ...baseTicket };
    mocks.agents = [{ id: 10, nombre_usuario: 'Operadora Junín', categoria_ids: [4] }];
  });

  it('permite tomar un ticket solo cuando el backend publica al usuario para la categoría', async () => {
    render(<TicketClaimButton />);
    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeEnabled();

    fireEvent.click(claim);

    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(77, 'municipio', 10));
    expect(mocks.updateTicket).toHaveBeenCalledWith(77, expect.objectContaining({ assigned_user_id: 10 }));
    expect(screen.getByRole('button', { name: 'Asignado a mí' })).toBeDisabled();
  });

  it('usa el claim omnicanal atómico cuando el ticket publica su modelo de origen', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    render(<TicketClaimButton />);

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
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(mocks.updateTicket).toHaveBeenCalledWith(77, expect.objectContaining({ assigned_user_id: 10 }));
  });

  it('deja que el backend autorice el claim atómico aunque el listado auxiliar no publique al operador', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'MunicipioTicket' };
    mocks.agents = [];
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeEnabled();
    expect(claim).toHaveAttribute(
      'title',
      'El backend verificará tu permiso, tenant y categoría antes de asignar',
    );

    fireEvent.click(claim);

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(1));
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(mocks.updateTicket).toHaveBeenCalledWith(77, expect.objectContaining({
      assigned_user_id: 10,
      assignedAgent: expect.objectContaining({ id: 10, nombre_usuario: 'Operadora Junín' }),
    }));
  });

  it('no confirma cambios cuando el backend rechaza rol o categoría en el claim atómico', async () => {
    mocks.ticket = { ...baseTicket, source_model: 'TenantTicket' };
    mocks.agents = [{ id: 10, nombre_usuario: 'Operadora Junín', categoria_ids: [9] }];
    mocks.claim.mockRejectedValueOnce(new (await import('@/utils/api')).ApiError(
      'Categoría incompatible',
      403,
    ));
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeEnabled();
    fireEvent.click(claim);

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(1));
    expect(mocks.updateTicket).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tomar ticket' })).toBeEnabled();
  });

  it('bloquea la toma cuando el usuario no cubre la categoría', () => {
    mocks.agents = [{ id: 10, nombre_usuario: 'Operadora Junín', categoria_ids: [9] }];
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeDisabled();
    expect(claim).toHaveAccessibleDescription('Tu perfil no tiene habilitada la categoría de este ticket.');
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('mantiene la acción bloqueada mientras la capacidad o la asignación están en vuelo', async () => {
    mocks.loading = true;
    const view = render(<TicketClaimButton />);
    expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled();

    mocks.loading = false;
    let resolveAssignment: (() => void) | null = null;
    mocks.assign.mockReturnValue(new Promise<void>((resolve) => { resolveAssignment = resolve; }));
    view.rerender(<TicketClaimButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Tomar ticket' }));
    expect(screen.getByRole('button', { name: 'Asignando…' })).toBeDisabled();

    await act(async () => resolveAssignment?.());
    expect(await screen.findByRole('button', { name: 'Asignado a mí' })).toBeDisabled();
  });

  it('no permite tomar un ticket asignado a otra persona y reserva la reasignación al supervisor', () => {
    mocks.ticket = { ...baseTicket, assigned_user_id: 22 };
    render(<TicketClaimButton />);

    const claim = screen.getByRole('button', { name: 'Tomar ticket' });
    expect(claim).toBeDisabled();
    expect(claim).toHaveAccessibleDescription(
      'El ticket ya tiene responsable. La reasignación se gestiona desde el inspector de supervisión.',
    );
  });
});
