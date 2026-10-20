import { describe, expect, it } from 'vitest';

import { getPublishedTicketTransitions } from './ticketStatus';

describe('getPublishedTicketTransitions', () => {
  it('normalizes and returns only states published by the backend', () => {
    expect(getPublishedTicketTransitions({
      estado: 'en_proceso',
      next_states: ['en_vivo', 'closed', 'inventado', 'en_proceso'],
    })).toEqual(['en_vivo', 'resuelto']);
  });

  it('prefers the authoritative workflow instance over a stale legacy field', () => {
    expect(getPublishedTicketTransitions({
      estado: 'nuevo',
      next_states: ['resuelto'],
      workflow: { next_states: ['en_proceso'] },
    })).toEqual(['en_proceso']);
  });

  it('fails closed when the API publishes no valid transition', () => {
    expect(getPublishedTicketTransitions({ estado: 'resuelto', next_states: [] })).toEqual([]);
    expect(getPublishedTicketTransitions({ estado: 'nuevo', next_states: 'en_proceso' })).toEqual([]);
    expect(getPublishedTicketTransitions(null)).toEqual([]);
  });
});
