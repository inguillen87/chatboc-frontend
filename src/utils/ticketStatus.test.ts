import { describe, expect, it } from 'vitest';

import {
  formatTicketDisplayLabel,
  formatTicketStatusLabel,
  getPublishedTicketTransitions,
  replaceTicketVocabulary,
} from './ticketStatus';

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

describe('plain-language ticket labels', () => {
  it('maps known internal codes and never humanizes an unknown code', () => {
    expect(formatTicketDisplayLabel('queue_offline_message')).toBe('Mensaje pendiente para el equipo');
    expect(formatTicketStatusLabel('waiting_agent')).toBe('Esperando atención');
    expect(formatTicketStatusLabel('pending_data')).toBe('Esperando datos');
    expect(formatTicketStatusLabel('unpublished_internal_state')).toBe('En espera');
    expect(formatTicketDisplayLabel('unpublished_internal_state')).toBe('En espera');
  });

  it('keeps human labels while replacing technical public vocabulary', () => {
    expect(formatTicketDisplayLabel('Arreglo de calle')).toBe('Arreglo de calle');
    expect(replaceTicketVocabulary('Tomar ticket · SLA vencido')).toBe('Tomar caso · plazo vencido');
  });
});
