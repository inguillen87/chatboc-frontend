import { describe, expect, it } from 'vitest';

import { buildOperationalReplyDraft } from './ticketOperationalGuidance';
import type { Ticket } from '@/types/tickets';

const baseTicket: Ticket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo de calle',
  estado: 'nuevo',
  fecha: '2026-06-06T00:03:00Z',
  categoria: 'Arreglo de calle',
};

describe('buildOperationalReplyDraft', () => {
  it('asks for exact location when guidance requires it', () => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Solicitar ubicacion exacta',
      source: 'ui',
      tags: ['ubicacion'],
    });

    expect(draft).toContain('M-378430');
    expect(draft).toMatch(/confirmes la ubicacion exacta/i);
  });

  it('keeps unread conversations focused on a same-channel response', () => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Responder ultima consulta',
      source: 'ui',
      tags: ['respuesta pendiente'],
    });

    expect(draft).toMatch(/por este mismo chat/i);
  });

  it('uses a safe generic draft for regular follow-up', () => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Revisar conversacion',
      source: 'ui',
      tags: ['seguimiento'],
    });

    expect(draft).toMatch(/Registramos tu consulta/i);
    expect(draft).toMatch(/por Arreglo de calle/i);
  });
});
