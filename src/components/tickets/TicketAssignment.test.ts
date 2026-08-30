import { describe, expect, it } from 'vitest';

import { normalizeEmployeeRoutingV2 } from '@/api/v2/saas';
import type { Ticket } from '@/types/tickets';
import { buildSupervisedAssignmentPayload } from './TicketAssignment';
import {
  buildRoutingTicketIdentity,
  canSuperviseTicketAssignments,
  employeeIsEligibleForRoutingTicket,
  resolveTicketRoutingAuthority,
} from './ticketRoutingAuthority';

const selectedTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 403,
  tipo: 'municipio',
  estado: 'nuevo',
  source_model: 'MunicipioTicket',
  categoria: 'General',
  ...overrides,
} as Ticket);

const routing = (overrides: Record<string, unknown> = {}) => normalizeEmployeeRoutingV2({
  contract_version: 'employee.routing.v1',
  employees: [
    {
      id: 10,
      name: 'Cuadrilla de luminarias',
      workload_open: 2,
      scope: { categorias: ['luminarias'], zonas: ['centro'], channels: ['whatsapp'] },
    },
    {
      id: 11,
      name: 'Mesa general',
      workload_open: 7,
      scope: { categorias: ['general'], zonas: ['centro'], channels: ['whatsapp'] },
    },
  ],
  queues: {
    open: [
      {
        source_model: 'TenantTicket',
        id: 403,
        category: 'general',
        assignee_id: null,
      },
      {
        source_model: 'MunicipioTicket',
        id: 403,
        category: 'luminarias',
        zone: 'centro',
        channel: 'whatsapp',
        assignee_id: null,
      },
    ],
    unassigned: [],
  },
  recommendations: [
    {
      ticket: {
        source_model: 'MunicipioTicket',
        id: 403,
        category: 'luminarias',
        zone: 'centro',
        channel: 'whatsapp',
        assignee_id: null,
      },
      suggested_assignee: { id: 10, name: 'Cuadrilla de luminarias' },
      score: 91,
      reasons: ['category_match', 'zone_match', 'workload_penalty_8'],
    },
  ],
  ...overrides,
});

describe('resolveTicketRoutingAuthority', () => {
  it('usa la categoría autoritativa por source_model + id aunque la ficha visible diga General', () => {
    const resolution = resolveTicketRoutingAuthority(routing(), selectedTicket());

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.identity).toBe('municipioticket:403');
    expect(resolution.authority.category).toBe('luminarias');
    expect(resolution.authority.eligibleEmployees.map((employee) => employee.id)).toEqual(['10']);
    expect(resolution.authority.suggestedEmployee?.id).toBe('10');
    expect(resolution.authority.recommendation?.score).toBe(91);
    expect(employeeIsEligibleForRoutingTicket(resolution.authority, 10)).toBe(true);
    expect(employeeIsEligibleForRoutingTicket(resolution.authority, 11)).toBe(false);
  });

  it('no confunde tickets con el mismo id respaldados por modelos distintos', () => {
    expect(buildRoutingTicketIdentity('TenantTicket', 403)).not.toBe(
      buildRoutingTicketIdentity('MunicipioTicket', 403),
    );
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{ source_model: 'TenantTicket', id: 403, category: 'general' }],
          unassigned: [],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );
    expect(resolution).toEqual({ ok: false, reason: 'ticket_not_published' });
  });

  it('falla cerrado ante aliases de identidad contradictorios publicados por el backend', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            sourceModel: 'TenantTicket',
            id: 403,
            ticket_id: 999,
            category: 'luminarias',
          }],
          unassigned: [],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'ticket_not_published' });
  });

  it('falla cerrado cuando dos superficies publican autoridad contradictoria para la misma identidad', () => {
    const base = routing();
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: 403,
            authoritative_category: 'luminarias',
            assignee_id: null,
          }],
          unassigned: [{
            source_model: 'MunicipioTicket',
            id: 403,
            authoritative_category: 'bacheo',
            assignee_id: 77,
          }],
        },
        recommendations: [
          {
            ...base.recommendations[0].raw,
            eligible_assignees: [{ id: 10 }],
          },
          {
            ...base.recommendations[0].raw,
            eligible_assignees: [{ id: 11 }],
          },
        ],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado si falta identidad o el contrato no es employee.routing.v1', () => {
    expect(resolveTicketRoutingAuthority(routing(), selectedTicket({ source_model: null }))).toEqual({
      ok: false,
      reason: 'missing_ticket_identity',
    });
    expect(resolveTicketRoutingAuthority(
      routing({ contract_version: 'employee.routing.v0' }),
      selectedTicket(),
    )).toEqual({ ok: false, reason: 'invalid_contract' });
  });

  it('respeta una lista autoritativa vacía sin reintroducir candidatos por heurística local', () => {
    const base = routing();
    const recommendation = base.recommendations[0];
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation.raw,
          eligible_assignees: [],
        }],
      }),
      selectedTicket(),
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.eligibleEmployees).toEqual([]);
    expect(resolution.authority.suggestedEmployee).toBeNull();
    expect(employeeIsEligibleForRoutingTicket(resolution.authority, 10)).toBe(false);
  });
});

describe('supervised assignment authority', () => {
  it('habilita el selector sólo a supervisor, admin o capability tickets.assign', () => {
    expect(canSuperviseTicketAssignments('empleado', false)).toBe(false);
    expect(canSuperviseTicketAssignments('manager', false)).toBe(false);
    expect(canSuperviseTicketAssignments('administrador', false)).toBe(false);
    expect(canSuperviseTicketAssignments('tenant-admin', false)).toBe(false);
    expect(canSuperviseTicketAssignments('supervisor', false)).toBe(true);
    expect(canSuperviseTicketAssignments('admin', false)).toBe(true);
    expect(canSuperviseTicketAssignments('super-admin', false)).toBe(true);
    expect(canSuperviseTicketAssignments('empleado', true)).toBe(true);
  });

  it('publica expected_assignee_id para detectar una asignación obsoleta', () => {
    const resolution = resolveTicketRoutingAuthority(routing(), selectedTicket());
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    expect(buildSupervisedAssignmentPayload(resolution.authority, 10)).toEqual({
      source_model: 'MunicipioTicket',
      ticket_id: 403,
      assignee_id: 10,
      expected_assignee_id: null,
    });

    const reassignment = {
      ...resolution.authority,
      currentAssigneeId: '22',
    };
    expect(buildSupervisedAssignmentPayload(reassignment, 10).expected_assignee_id).toBe(22);
  });
});
