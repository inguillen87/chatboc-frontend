import { describe, expect, it } from 'vitest';

import {
  getNextOperationalTicket,
  getQueueScore,
  isRiskQueueTicket,
  isUnreadQueueTicket,
  sortTicketsByOperationalPriority,
} from './ticketOperationalQueue';

const buildTicket = (overrides: Record<string, unknown>) =>
  ({
    id: overrides.id,
    nro_ticket: `M-${overrides.id}`,
    asunto: 'Reclamo',
    estado: 'nuevo',
    fecha: '2026-06-01T10:00:00.000Z',
    tipo: 'municipio',
    ...overrides,
  }) as any;

describe('ticketOperationalQueue', () => {
  it('prioritizes unread tickets before normal open tickets', () => {
    const normal = buildTicket({ id: 1, updated_at: '2026-06-01T11:00:00.000Z' });
    const unread = buildTicket({
      id: 2,
      collaboration_state: { has_unread: true },
      updated_at: '2026-06-01T09:00:00.000Z',
    });

    expect(isUnreadQueueTicket(unread)).toBe(true);
    expect(getNextOperationalTicket([normal, unread])?.id).toBe(2);
  });

  it('keeps SLA risk above regular open tickets', () => {
    const regular = buildTicket({ id: 1, priority: 'media' });
    const risk = buildTicket({ id: 2, sla_status: 'por vencer' });

    expect(isRiskQueueTicket(risk)).toBe(true);
    expect(getQueueScore(risk)).toBeGreaterThan(getQueueScore(regular));
  });

  it('uses recent activity as the tie breaker inside the same priority', () => {
    const older = buildTicket({ id: 1, updated_at: '2026-06-01T10:00:00.000Z' });
    const newer = buildTicket({ id: 2, updated_at: '2026-06-01T12:00:00.000Z' });

    expect(sortTicketsByOperationalPriority([older, newer]).map((ticket) => ticket.id)).toEqual([2, 1]);
  });
});
