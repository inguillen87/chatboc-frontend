import { describe, expect, it } from 'vitest';

import type { AssignableAgent } from '@/services/ticketService';
import type { Ticket } from '@/types/tickets';
import { filterCategoryAssignableAgents } from './TicketAssignment';

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
