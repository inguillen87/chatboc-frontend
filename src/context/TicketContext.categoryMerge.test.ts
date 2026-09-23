import { describe, expect, it } from 'vitest';

import { mergeTicketInboxRecord, normalizeTicketForInbox } from './TicketContext';
import type { Ticket } from '@/types/tickets';

const compactM419: Ticket = {
  id: 419,
  source_model: 'MunicipioTicket',
  tipo: 'municipio',
  nro_ticket: 'M-419',
  asunto: 'Poste sin luz',
  estado: 'nuevo',
  fecha: '2026-08-31T10:00:00Z',
  categoria: 'Luminarias',
};

describe('ticket category list-detail reconciliation', () => {
  it('lee categoria_reclamo del detalle autoritativo', () => {
    const detail = normalizeTicketForInbox({
      ...compactM419,
      categoria: undefined,
      categoria_reclamo: 'Luminarias',
    });
    expect(detail.categoria).toBe('Luminarias');
  });

  it('no pisa Luminarias del listado con General cuando el detalle omite categoría', () => {
    const merged = mergeTicketInboxRecord(compactM419, {
      description: 'Detalle ampliado sin categoría',
      categoria: undefined,
    });
    expect(merged.categoria).toBe('Luminarias');
    expect(merged.description).toBe('Detalle ampliado sin categoría');
  });
});

