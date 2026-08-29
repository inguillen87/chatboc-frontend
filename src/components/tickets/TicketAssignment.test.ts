import { describe, expect, it } from 'vitest';

import type { AssignableAgent } from '@/services/ticketService';
import type { Ticket } from '@/types/tickets';
import {
  buildTicketAssignmentScope,
  filterCategoryAssignableAgents,
  reconcileTicketAssignmentSelection,
  resolveCategoryAssignmentCandidate,
} from './TicketAssignment';

const agent = (id: number, overrides: Partial<AssignableAgent> = {}): AssignableAgent => ({
  id,
  nombre_usuario: `Agente ${id}`,
  email: `agente${id}@junin.gob.ar`,
  ...overrides,
});

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 419,
  tipo: 'municipio',
  estado: 'nuevo',
  ...overrides,
} as Ticket);

describe('filterCategoryAssignableAgents', () => {
  it('incluye solo empleados con la categoría publicada por id', () => {
    const candidates = filterCategoryAssignableAgents(
      ticket({ categoria_id: 4, categoria: 'Luminarias' }),
      [
        agent(1, { categoria_id: 4 }),
        agent(2, { categoria_ids: [7] }),
        agent(3),
      ],
    );

    expect(candidates.map(({ id }) => id)).toEqual([1]);
  });

  it('reconoce categorías por nombre normalizado cuando no hay id', () => {
    const candidates = filterCategoryAssignableAgents(
      ticket({ categoria: 'Árbol-caído' }),
      [
        agent(1, { categorias: [{ id: 10, nombre: 'Arbol caido' }] }),
        agent(2, { categorias: [{ id: 11, nombre: 'Bacheo' }] }),
      ],
    );

    expect(candidates.map(({ id }) => id)).toEqual([1]);
  });

  it('conserva la lista publicada si el ticket todavía no tiene categoría', () => {
    const agents = [agent(1), agent(2, { categoria_ids: [7] })];

    expect(filterCategoryAssignableAgents(ticket(), agents)).toEqual(agents);
  });
});

describe('reconcileTicketAssignmentSelection', () => {
  it('preserva una elección manual aunque cambie la recomendación por carga realtime', () => {
    const scopeKey = buildTicketAssignmentScope(ticket({ categoria_id: 4, categoria: 'Luminarias' }));
    const candidates = [agent(1, { categoria_id: 4 }), agent(2, { categoria_id: 4 }), agent(3, { categoria_id: 4 })];
    const manualSelection = {
      agentId: '2',
      scopeKey,
      source: 'manual' as const,
    };

    const result = reconcileTicketAssignmentSelection(
      manualSelection,
      scopeKey,
      candidates,
      candidates[2],
    );

    expect(result).toBe(manualSelection);
    expect(result.agentId).toBe('2');
  });

  it('descarta la selección anterior al cambiar ticket o categoría aunque el agente siga publicado', () => {
    const previousScope = buildTicketAssignmentScope(ticket({ categoria_id: 4, categoria: 'Luminarias' }));
    const nextScope = buildTicketAssignmentScope(ticket({ categoria_id: 7, categoria: 'Bacheo' }));
    const candidates = [agent(1, { categoria_ids: [4, 7] }), agent(2, { categoria_ids: [4, 7] })];

    expect(reconcileTicketAssignmentSelection(
      { agentId: '2', scopeKey: previousScope, source: 'manual' },
      nextScope,
      candidates,
      candidates[0],
    )).toEqual({
      agentId: '1',
      scopeKey: nextScope,
      source: 'automatic',
    });
  });

  it('reemplaza una elección manual si el agente deja de cubrir la categoría actual', () => {
    const scopeKey = buildTicketAssignmentScope(ticket({ categoria_id: 7, categoria: 'Bacheo' }));
    const eligibleCandidate = agent(1, { categoria_id: 7 });

    expect(reconcileTicketAssignmentSelection(
      { agentId: '2', scopeKey, source: 'manual' },
      scopeKey,
      [eligibleCandidate],
      eligibleCandidate,
    )).toEqual({
      agentId: '1',
      scopeKey,
      source: 'automatic',
    });
  });
});

describe('resolveCategoryAssignmentCandidate', () => {
  it('falla cerrado si el id quedó obsoleto y ya no integra los candidatos de categoría', () => {
    const candidates = [agent(1, { categoria_id: 7 })];

    expect(resolveCategoryAssignmentCandidate(candidates, '2')).toBeUndefined();
    expect(resolveCategoryAssignmentCandidate(candidates, '1')).toBe(candidates[0]);
  });
});
