import { describe, expect, it } from 'vitest';

import { deriveTicketOperationalGuidance } from './ticketOperationalGuidance';
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

const ticketWith = (overrides: Partial<Ticket>): Ticket => ({
  ...baseTicket,
  ...overrides,
});

describe('deriveTicketOperationalGuidance', () => {
  it('respects backend recommended actions first', () => {
    const guidance = deriveTicketOperationalGuidance(
      ticketWith({ recommended_next_action: 'Derivar a Obras Publicas' }),
    );

    expect(guidance).toEqual({
      label: 'Derivar a Obras Publicas',
      source: 'backend',
      tags: ['backend'],
    });
  });

  it('prioritizes unread citizen activity', () => {
    const guidance = deriveTicketOperationalGuidance(
      ticketWith({
        hasUnreadMessages: true,
        assignedAgentId: 7,
        direccion: 'Don Bosco 55',
      }),
    );

    expect(guidance.source).toBe('ui');
    expect(guidance.label).toMatch(/Responder la ultima consulta/i);
    expect(guidance.tags).toContain('respuesta pendiente');
  });

  it('surfaces SLA and priority risk when no backend action exists', () => {
    const guidance = deriveTicketOperationalGuidance(
      ticketWith({
        priority: 'alta',
        sla_status: 'breached',
        assignedAgentId: 7,
        direccion: 'Don Bosco 55',
      }),
    );

    expect(guidance.label).toMatch(/Priorizar este caso/i);
    expect(guidance.tags).toEqual(expect.arrayContaining(['riesgo', 'SLA']));
  });

  it('asks the operator to assign an owner before regular follow-up', () => {
    const guidance = deriveTicketOperationalGuidance(
      ticketWith({ direccion: 'Don Bosco 55' }),
    );

    expect(guidance.label).toMatch(/Asignar responsable/i);
    expect(guidance.tags).toContain('asignacion');
  });

  it('asks for location when the municipal ticket has an owner but no map signal', () => {
    const guidance = deriveTicketOperationalGuidance(
      ticketWith({ assignedAgentId: 7 }),
    );

    expect(guidance.label).toMatch(/Solicitar ubicacion exacta/i);
    expect(guidance.tags).toContain('ubicacion');
  });

  it('keeps closed tickets focused on audit and citizen history', () => {
    const guidance = deriveTicketOperationalGuidance(
      ticketWith({ estado: 'resuelto' }),
    );

    expect(guidance.label).toMatch(/Verificar cierre/i);
    expect(guidance.tags).toEqual(expect.arrayContaining(['cierre', 'historial']));
  });
});
