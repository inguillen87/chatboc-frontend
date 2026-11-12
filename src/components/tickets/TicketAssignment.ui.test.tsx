import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Ticket } from '@/types/tickets';
import { normalizeEmployeeRoutingV2, normalizeOmnichannelInboxItemV2 } from '@/api/v2/saas';
import { resolveTicketRoutingAuthority } from './ticketRoutingAuthority';
import { inboxAssignmentTicket } from './inbox/inboxAssignmentTicket';

const mocks = vi.hoisted(() => ({
  user: { id: 10, name: 'Operadora Junín', rol: 'empleado' } as Record<string, unknown>,
  hasAssignCapability: false,
  contextAvailable: true,
  readContext: vi.fn(),
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
  routingPayload: null as Record<string, unknown> | null,
  postAction: vi.fn(),
  updateTicket: vi.fn(),
  refresh: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => {
    mocks.readContext();
    if (!mocks.contextAvailable) throw new Error('useTickets must be used within a TicketProvider');
    return { selectedTicket: mocks.ticket, updateTicket: mocks.updateTicket };
  },
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
  default: (ticket: Ticket | null) => {
    if (mocks.routingPayload) {
      const routing = normalizeEmployeeRoutingV2(mocks.routingPayload);
      return {
        loading: mocks.loading,
        error: mocks.error,
        routing,
        refresh: mocks.refresh,
        resolution: resolveTicketRoutingAuthority(routing, ticket),
      };
    }
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

// Mirrors the exact employee.routing.v1 ticket/candidate shape emitted by the
// backend, through the production normalizer and identity resolver.
const publishedRouting = (category: string, candidateIds?: number[]) => {
  const snapshot = {
    source_model: 'MunicipioTicket', id: 396, ticket_id: 396,
    category, authoritative_category: category, category_id: null,
    zone: 'sin_zona', channel: 'whatsapp', assignee_id: null,
  };
  return {
    contract_version: 'employee.routing.v1',
    employees: [10, 11].map((id) => ({
      id, name: `Operador ${id}`, workload_open: 0,
      scope: { categorias: ['luminarias'], zonas: [], channels: ['whatsapp'], permisos: [] },
    })),
    queues: { open: [snapshot], unassigned: [snapshot] },
    recommendations: [{
      ticket: snapshot, suggested_assignee: null, score: 0, reasons: [],
      ...(candidateIds === undefined ? {} : {
        candidate_ids: candidateIds,
        eligible_assignees: candidateIds.map((id) => ({ employee: { id, name: `Operador ${id}` }, score: 0, reasons: [] })),
      }),
    }],
  };
};

const detailCategory = (verified: boolean): Ticket => ({
  id: 396, tipo: 'municipio', estado: 'nuevo', source_model: 'MunicipioTicket', tenant_slug: 'junin',
  categoria: verified ? 'luminarias' : 'reclamo ciudadano',
  authoritative_category: verified ? 'luminarias' : null,
  category_authority: {
    contract_version: 'ticket.category_authority.v1', verified, conflict: false,
    source: verified ? 'tenant_category_catalog' : 'persisted_category_unverified',
    reason_code: verified ? 'verified_tenant_category' : 'category_id_missing_and_alias_unverified',
    category_id: verified ? 7 : null,
    authoritative_category: verified ? 'luminarias' : null,
    persisted_category: verified ? 'luminarias' : 'reclamo ciudadano',
  },
} as unknown as Ticket);

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
    mocks.contextAvailable = true;
    mocks.readContext.mockClear();
    mocks.loading = false;
    mocks.error = null;
    mocks.resolutionOk = true;
    mocks.failureReason = 'invalid_contract';
    mocks.eligible = true;
    mocks.currentAssigneeId = null;
    mocks.routingPayload = null;
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

  it('preserva la denegación explícita del detalle a través del normalizador y el adaptador Inbox ante routing legacy', () => {
    const descriptor = { ...detailCategory(false).category_authority!,
      message: 'Clasificación pendiente del servidor.', recovery_text: 'Revisá el catálogo antes de derivar.' };
    const item = normalizeOmnichannelInboxItemV2({
      id: 'municipio:396', ticket_id: 396, source_model: 'MunicipioTicket', tenant_slug: 'junin',
      category: 'reclamo ciudadano', authoritative_category: null, category_authority: descriptor,
    })!;
    const ticket = inboxAssignmentTicket(item, { tenantSlug: 'junin' })!;
    mocks.routingPayload = publishedRouting('reclamo ciudadano', [10]);
    render(<TicketAssignment ticket={ticket} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);

    const claimAction = screen.queryByRole('button', { name: 'Tomar ticket' });
    if (claimAction) fireEvent.click(claimAction);
    expect(mocks.postAction).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Clasificación pendiente del servidor. Revisá el catálogo antes de derivar.');
    expect(ticket.authoritative_category).toBeNull();
    expect(ticket.category_authority).toEqual(descriptor);
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
  });

  it('muestra recuperación server-side para autoridad nula de la matriz sin confundirla con responsables contradictorios', () => {
    const payload = publishedRouting('reclamo ciudadano', [10]);
    Object.assign(payload.queues.open[0], { authoritative_category: null,
      category_authority: { ...detailCategory(false).category_authority!, message: 'Revisá la clasificación oficial.', recovery_text: null } });
    mocks.routingPayload = payload;
    mocks.ticket = { ...detailCategory(false), authoritative_category: undefined };
    delete mocks.ticket.category_authority;
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);

    expect(screen.getByRole('status')).toHaveTextContent('Categoría pendiente de verificación');
    expect(screen.getByRole('status')).toHaveTextContent('Revisá la clasificación oficial.');
    expect(screen.queryByText(/datos de responsable.*no coinciden/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar matriz' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it.each([null, { contract_version: 'unknown', verified: true, conflict: false },
    { contract_version: 'ticket.category_authority.v1', verified: 'true', conflict: false },
    { contract_version: 'ticket.category_authority.v1', verified: true },
    { contract_version: 'ticket.category_authority.v1', verified: true, conflict: false }])('no promueve un descriptor publicado malformado aunque routing anuncie candidato %j', descriptor => {
    const item = normalizeOmnichannelInboxItemV2({ id: 396, source_model: 'MunicipioTicket', tenant_slug: 'junin',
      category: 'luminarias', authoritative_category: 'luminarias', category_authority: descriptor })!;
    mocks.routingPayload = publishedRouting('luminarias', [10]);
    render(<TicketAssignment ticket={inboxAssignmentTicket(item)} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);
    const claimAction = screen.queryByRole('button', { name: 'Tomar ticket' });
    if (claimAction) fireEvent.click(claimAction);
    expect(mocks.postAction).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Categoría pendiente de verificación');
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
  });

  it('acepta un descriptor verificado mínimo consistente sin exigir IDs ni textos opcionales', () => {
    const item = normalizeOmnichannelInboxItemV2({ id: 396, source_model: 'MunicipioTicket', tenant_slug: 'junin',
      category: 'luminarias', authoritative_category: 'luminarias',
      category_authority: { contract_version: 'ticket.category_authority.v1', verified: true, conflict: false, authoritative_category: 'Luminarias' } })!;
    mocks.routingPayload = publishedRouting('luminarias', [10]);
    render(<TicketAssignment ticket={inboxAssignmentTicket(item)} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);
    expect(screen.getByRole('button', { name: 'Tomar ticket' })).toBeEnabled();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('bloquea un descriptor verifiedtrue cuya autoridad anidada contradice la categoría top sin permitir POST', () => {
    const item = normalizeOmnichannelInboxItemV2({ id: 396, source_model: 'MunicipioTicket', tenant_slug: 'junin',
      category: 'luminarias', authoritative_category: 'luminarias',
      category_authority: { contract_version: 'ticket.category_authority.v1', verified: true, conflict: false, authoritative_category: 'agua' } })!;
    mocks.routingPayload = publishedRouting('luminarias', [10]);
    render(<TicketAssignment ticket={inboxAssignmentTicket(item)} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);
    const claimAction = screen.queryByRole('button', { name: 'Tomar ticket' });
    if (claimAction) fireEvent.click(claimAction);
    expect(mocks.postAction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Los datos de responsable de este caso no coinciden');
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
  });

  it.each(['default', 'compact'] as const)('muestra UNKNOWN del detalle real como pendiente, sin denegación ni acción (%s)', (variant) => {
    mocks.ticket = detailCategory(false);
    // The older routing read model still derives an authoritative-looking text
    // and even publishes this actor. It cannot override the explicit detail.
    mocks.routingPayload = publishedRouting('reclamo ciudadano', [10]);
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} variant={variant} />);

    expect(screen.getByRole('status')).toHaveTextContent('Categoría pendiente de verificación');
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos confirmar la categoría y la cobertura');
    expect(screen.queryByText(/Cobertura verificada|fuera de las categorías|El servidor no habilitó/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar matriz' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('conserva protegida la asignación supervisada cuando el detalle declara categoría no verificada', () => {
    mocks.user = { id: 99, rol: 'supervisor' };
    mocks.ticket = detailCategory(false);
    mocks.routingPayload = publishedRouting('reclamo ciudadano', [10]);
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'assign', label: 'Asignar' }]} variant="compact" />);

    expect(screen.getByRole('status')).toHaveTextContent('Categoría pendiente de verificación');
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('distingue denegación publicada para el actor con categoría verificada de autoridad desconocida', () => {
    mocks.ticket = detailCategory(true);
    mocks.routingPayload = publishedRouting('luminarias', [11]);
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);

    expect(screen.getByText(/Categoría verificada · luminarias/)).toBeInTheDocument();
    expect(screen.getByText('El servidor no habilitó tu usuario entre las personas que pueden tomar este caso.')).toBeInTheDocument();
    expect(screen.queryByText(/pendiente de verificación|fuera de las categorías/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('no atribuye una denegación al actor si el contrato no publica candidatos', () => {
    mocks.user = { id: 99, rol: 'admin_municipio' };
    mocks.ticket = detailCategory(true);
    mocks.routingPayload = publishedRouting('luminarias');
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);

    expect(screen.getByText(/No pudimos confirmar la cobertura de asignación para tu usuario/)).toBeInTheDocument();
    expect(screen.queryByText(/El servidor no habilitó|fuera de las categorías/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('no declara cobertura verificada si la categoría del detalle difiere de la matriz del mismo caso', () => {
    mocks.ticket = detailCategory(true);
    mocks.routingPayload = publishedRouting('reclamo ciudadano', [10]);
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'claim', label: 'Tomar ticket' }]} />);

    expect(screen.getByRole('status')).toHaveTextContent('Categoría pendiente de verificación');
    expect(screen.queryByText(/Categoría verificada|El servidor no habilitó/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar ticket' })).not.toBeInTheDocument();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('conserva la acción publicada para el actor compatible y el payload protegido', async () => {
    mocks.ticket = detailCategory(true);
    mocks.routingPayload = publishedRouting('luminarias', [10]);
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'claim', label: 'Atender este caso' }]} />);

    expect(screen.getByText(/Categoría verificada · luminarias/)).toBeInTheDocument();
    expect(screen.queryByText(/pendiente de verificación|El servidor no habilitó/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atender este caso' }));
    await waitFor(() => expect(mocks.postAction).toHaveBeenCalledWith('396', {
      action: 'claim', payload: { source_model: 'MunicipioTicket', ticket_id: 396 },
    }, 'junin'));
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('no confunde una acción ausente con la exclusión de un actor que sí tiene cobertura publicada', () => {
    mocks.ticket = detailCategory(true);
    mocks.routingPayload = publishedRouting('luminarias', [10]);
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{ id: 'assign', label: 'Asignar' }]} />);

    expect(screen.getByText('La acción de tomar este caso no está habilitada para tu usuario.')).toBeInTheDocument();
    expect(screen.queryByText(/entre las personas que pueden|fuera de las categorías/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Asignar|Tomar ticket/ })).not.toBeInTheDocument();
    expect(mocks.postAction).not.toHaveBeenCalled();
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

  it('uses an explicit inbox ticket without mutating the global ticket context', async () => {
    const inboxTicket={...mocks.ticket,id:403,tenant_slug:'junin'} as Ticket;
    const confirmed=vi.fn();
    render(<TicketAssignment ticket={inboxTicket} assignmentActions={[{id: 'claim', label: 'Tomar ticket'}]} variant="compact" onAssignmentConfirmed={confirmed}/>);
    fireEvent.click(screen.getByRole('button',{name:'Tomar ticket'}));
    await waitFor(()=>expect(mocks.postAction).toHaveBeenCalledTimes(1));
    expect(mocks.updateTicket).not.toHaveBeenCalled();
    await waitFor(()=>expect(confirmed).toHaveBeenCalledOnce());
  });

  it('renders an explicit inbox ticket without consulting the absent TicketProvider', () => {
    mocks.contextAvailable = false;
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{id:'claim',label:'Atender este caso'}]} />);
    expect(screen.getByRole('button', {name:'Atender este caso'})).toBeEnabled();
    expect(mocks.readContext).not.toHaveBeenCalled();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('accepts an explicit null ticket without consulting TicketContext', () => {
    mocks.contextAvailable = false;
    const view = render(<TicketAssignment ticket={null} />);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocks.readContext).not.toHaveBeenCalled();
  });

  it('fails closed for an explicit ticket without published assignment actions', () => {
    const view = render(<TicketAssignment ticket={mocks.ticket} />);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocks.postAction).not.toHaveBeenCalled();
  });

  it('does not grant supervisor assignment when only claim was published', async () => {
    mocks.user = {id:10, rol:'supervisor'};
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{id:'claim',label:'Atender este caso'}]} variant="compact" />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Atender este caso'}));
    await waitFor(()=>expect(mocks.postAction).toHaveBeenCalledOnce());
    expect(mocks.postAction.mock.calls[0][1].action).toBe('claim');
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('does not grant claim when only assignment was published', async () => {
    mocks.user = {id:10, rol:'supervisor'};
    render(<TicketAssignment ticket={mocks.ticket} assignmentActions={[{id:'assign',label:'Elegir responsable oficial'}]} variant="compact" />);
    expect(screen.queryByRole('button',{name:'Tomar ticket'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Elegir responsable oficial'}));
    await waitFor(()=>expect(mocks.postAction).toHaveBeenCalledOnce());
    expect(mocks.postAction.mock.calls[0][1].action).toBe('assign');
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
