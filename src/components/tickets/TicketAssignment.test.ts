import { describe, expect, it } from 'vitest';

import { normalizeEmployeeRoutingV2 } from '@/api/v2/saas';
import type { Ticket } from '@/types/tickets';
import {
  buildSupervisedAssignmentPayload,
  serializeAssignmentIdentifier,
} from './TicketAssignment';
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

  it('prioriza authoritative_category sobre la etiqueta de presentación del contrato real', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: 403,
            authoritative_category: 'luminarias',
            category: 'alumbrado publico',
            zone: 'centro',
            channel: 'whatsapp',
            assignee_id: null,
          }],
          unassigned: [{
            source_model: 'MunicipioTicket',
            id: 403,
            authoritative_category: 'luminarias',
            category: 'alumbrado publico',
            zone: 'centro',
            channel: 'whatsapp',
            assignee_id: null,
          }],
        },
        recommendations: [{
          ticket: {
            source_model: 'MunicipioTicket',
            id: 403,
            authoritativeCategory: 'Luminarias',
            category: 'Alumbrado público',
            zone: 'centro',
            channel: 'whatsapp',
            assignee_id: null,
          },
          suggested_assignee: { id: 10, name: 'Cuadrilla de luminarias' },
          score: 91,
        }],
      }),
      selectedTicket(),
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.category).toBe('luminarias');
    expect(resolution.authority.eligibleEmployees.map((employee) => employee.id)).toEqual(['10']);
    expect(resolution.authority.suggestedEmployee?.id).toBe('10');
  });

  it('ignora fallbacks de presentación contradictorios cuando existe autoridad publicada', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: 403,
            authoritative_category: 'luminarias',
            category: 'alumbrado publico',
          }],
          unassigned: [],
        },
        recommendations: [{
          ticket: {
            source_model: 'MunicipioTicket',
            id: 403,
            category: 'etiqueta operativa heredada',
          },
          suggested_assignee: { id: 10 },
        }],
      }),
      selectedTicket(),
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.category).toBe('luminarias');
    expect(resolution.authority.eligibleEmployees.map((employee) => employee.id)).toEqual(['10']);
  });

  it('falla cerrado si dos aliases autoritativos publican categorías diferentes', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: 403,
            authoritative_category: 'luminarias',
            authoritativeCategory: 'bacheo',
            category: 'alumbrado publico',
          }],
          unassigned: [],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado si los fallbacks de categoría se contradicen sin autoridad publicada', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: 403,
            category: 'luminarias',
            categoria: 'bacheo',
          }],
          unassigned: [],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
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

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado si un alias de identidad está publicado pero vacío', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: '',
            ticket_id: 403,
            category: 'luminarias',
          }],
          unassigned: [],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('no ignora una recomendación con identidad contradictoria junto a una cola válida', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          ticket: {
            source_model: 'MunicipioTicket',
            sourceModel: 'TenantTicket',
            id: 403,
            category: 'luminarias',
          },
          eligible_assignees: [{ id: 10 }],
        }],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('detecta identidad contradictoria aunque el id opaco contenga dos puntos', () => {
    const opaqueId = 'case:403';
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: opaqueId,
            category: 'luminarias',
          }],
          unassigned: [],
        },
        recommendations: [{
          ticket: {
            source_model: 'MunicipioTicket',
            id: opaqueId,
            ticket_id: 'case',
            category: 'luminarias',
          },
          suggested_assignee: { id: 10 },
        }],
      }),
      selectedTicket({ id: opaqueId as unknown as number }),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
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

  it('falla cerrado si una superficie omite la asignación que otra declara', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{ source_model: 'MunicipioTicket', id: 403, category: 'luminarias' }],
          unassigned: [{
            source_model: 'MunicipioTicket',
            id: 403,
            category: 'luminarias',
            assignee_id: 77,
          }],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado cuando un mismo ticket publica aliases operativos contradictorios', () => {
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            id: 403,
            category: 'luminarias',
            categoria: 'tributos',
            assignee_id: 20,
            assigned_user_id: 21,
          }],
          unassigned: [],
        },
        recommendations: [],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado ante aliases contradictorios de candidatos o de su identidad', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;

    expect(resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          eligible_assignees: [{ id: 10 }],
          candidates: [{ id: 11 }],
        }],
      }),
      selectedTicket(),
    )).toEqual({ ok: false, reason: 'conflicting_authority' });

    expect(resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          eligible_assignees: [{ id: 10, employee_id: 11 }],
        }],
      }),
      selectedTicket(),
    )).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado si la sugerencia publica dos identidades de empleado', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          suggested_assignee: { id: 10, employee_id: 11 },
        }],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('nunca amplía elegibilidad con una sugerencia fuera de la categoría autoritativa', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        employees: [
          ...base.employees.map((employee) => employee.raw),
          {
            id: 12,
            name: 'Equipo de tributos',
            scope: { categorias: ['tributos'], zonas: ['centro'], channels: ['whatsapp'] },
          },
        ],
        recommendations: [{
          ...recommendation,
          suggested_assignee: { id: 12, name: 'Equipo de tributos' },
        }],
      }),
      selectedTicket(),
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.eligibleEmployees.map((employee) => employee.id)).toEqual(['10']);
    expect(resolution.authority.suggestedEmployee).toBeNull();
    expect(employeeIsEligibleForRoutingTicket(resolution.authority, 12)).toBe(false);
  });

  it('falla cerrado cuando dos recomendaciones sugieren empleados distintos', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [
          { ...recommendation, suggested_assignee: { id: 10 } },
          { ...recommendation, suggested_assignee: { id: 11 } },
        ],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado si sólo una recomendación publica la lista autoritativa de candidatos', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [
          recommendation,
          { ...recommendation, eligible_assignees: [{ id: 10 }] },
        ],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('firma listas candidatas sin colisiones por separadores dentro de IDs opacos', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [
          { ...recommendation, eligible_assignees: [{ id: 'a' }, { id: 'b' }] },
          { ...recommendation, eligible_assignees: [{ id: 'a|b' }] },
        ],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('acepta aliases redundantes cuando normalizan a la misma autoridad', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        queues: {
          open: [{
            source_model: 'MunicipioTicket',
            sourceModel: 'municipioticket',
            id: 403,
            ticket_id: '403',
            category: 'Luminarias',
            categoria: 'luminarias',
            zone: 'Centro',
            zona: 'centro',
            channel: 'WhatsApp',
            canal: 'whatsapp',
          }],
          unassigned: [],
        },
        recommendations: [{
          ...recommendation,
          eligible_assignees: [{ id: 10, employee_id: '10' }],
          candidates: [{ user_id: 10 }],
          suggested_assignee: { id: 10, employee_id: '10' },
        }],
      }),
      selectedTicket(),
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.eligibleEmployees.map((employee) => employee.id)).toEqual(['10']);
  });

  it('acepta el contrato real candidate_ids más eligible_assignees anidados', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          candidate_ids: [10],
          eligible_assignees: [{
            employee: { id: 10, name: 'Cuadrilla de luminarias' },
            score: 91,
            reasons: ['category_match'],
            workload_open: 2,
          }],
        }],
      }),
      selectedTicket(),
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.authority.eligibleEmployees.map((employee) => employee.id)).toEqual(['10']);
    expect(resolution.authority.suggestedEmployee?.id).toBe('10');
  });

  it('falla cerrado si un candidato anidado contradice el id del wrapper', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          eligible_assignees: [{ id: 10, employee: { id: 11 } }],
        }],
      }),
      selectedTicket(),
    );

    expect(resolution).toEqual({ ok: false, reason: 'conflicting_authority' });
  });

  it('falla cerrado si la sugerencia anidada contradice el id del wrapper', () => {
    const base = routing();
    const recommendation = base.recommendations[0].raw;
    const resolution = resolveTicketRoutingAuthority(
      routing({
        recommendations: [{
          ...recommendation,
          suggested_assignee: { id: 10, employee: { id: 11 } },
        }],
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

  it('preserva identificadores opacos, con ceros iniciales o fuera del rango seguro', () => {
    expect(serializeAssignmentIdentifier('403')).toBe(403);
    expect(serializeAssignmentIdentifier('00403')).toBe('00403');
    expect(serializeAssignmentIdentifier('9007199254740993')).toBe('9007199254740993');
    expect(serializeAssignmentIdentifier('case-403')).toBe('case-403');
  });
});
