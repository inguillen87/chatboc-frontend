import { describe, expect, it } from 'vitest';

import { normalizeTicketSla } from './ticketSla';

describe('normalizeTicketSla', () => {
  it('normalizes the three authoritative clocks without collapsing healthy and warning states', () => {
    const sla = normalizeTicketSla({
      contract_version: 'ticket.sla.v1',
      evaluated_at: '2026-08-30T12:00:00Z',
      clocks: {
        first_response: {
          state: 'ok',
          status: 'due',
          due_at: '2026-08-30T13:00:00Z',
          known: true,
        },
        next_update: {
          state: 'warning',
          status: 'due',
          due_at: '2026-08-30T12:15:00Z',
          known: true,
        },
        resolution: {
          state: 'breached',
          status: 'overdue',
          due_at: '2026-08-30T11:00:00Z',
          known: true,
        },
      },
    });

    expect(sla.contract_version).toBe('ticket.sla.v1');
    expect(sla.clocks.first_response.state).toBe('healthy');
    expect(sla.clocks.next_update.state).toBe('due');
    expect(sla.clocks.resolution.state).toBe('overdue');
    expect(sla.state).toBe('overdue');
    expect(sla.overdue).toBe(true);
    expect(sla.known).toBe(true);
  });

  it('fails closed when a date has no explicit clock state', () => {
    const sla = normalizeTicketSla({
      status: 'active',
      clocks: {
        first_response: { due_at: '2026-08-30T13:00:00Z' },
      },
    });

    expect(sla.clocks.first_response.state).toBe('unknown');
    expect(sla.state).toBe('unknown');
    expect(sla.known).toBe(false);
  });

  it('does not call every open due deadline por vencer without an explicit warning', () => {
    const open = normalizeTicketSla({
      clocks: {
        next_update: {
          status: 'due',
          due_at: '2026-08-30T13:00:00Z',
          known: true,
        },
      },
    });
    const warning = normalizeTicketSla({
      clocks: {
        next_update: {
          status: 'due',
          at_risk: true,
          due_at: '2026-08-30T13:00:00Z',
          known: true,
        },
      },
    });

    expect(open.clocks.next_update.state).toBe('unknown');
    expect(warning.clocks.next_update.state).toBe('due');
  });

  it('does not infer timely fulfillment from an orphan fulfilled timestamp', () => {
    const sla = normalizeTicketSla({
      clocks: {
        first_response: { fulfilled_at: '2026-08-30T12:00:00Z' },
      },
    });

    expect(sla.clocks.first_response.state).toBe('unknown');
    expect(sla.clocks.first_response.known).toBe(false);
  });

  it('does not hide a late fulfillment behind a satisfied label', () => {
    const sla = normalizeTicketSla({
      clocks: {
        first_response: {
          status: 'satisfied',
          due_at: '2026-08-30T11:00:00Z',
          fulfilled_at: '2026-08-30T12:00:00Z',
          known: true,
        },
      },
    });

    expect(sla.clocks.first_response.state).toBe('overdue');
    expect(sla.state).toBe('overdue');
  });

  it('preserves a clock breach even when the root contract is paused', () => {
    const sla = normalizeTicketSla({
      paused: true,
      clocks: {
        resolution: {
          state: 'breached',
          due_at: '2026-08-30T11:00:00Z',
          known: true,
        },
      },
    });

    expect(sla.clocks.resolution.state).toBe('overdue');
    expect(sla.state).toBe('overdue');
  });

  it('keeps the summary unknown when fulfilled evidence is mixed with unknown clocks', () => {
    const sla = normalizeTicketSla({
      clocks: {
        first_response: {
          status: 'satisfied',
          due_at: '2026-08-30T13:00:00Z',
          fulfilled_at: '2026-08-30T12:00:00Z',
          known: true,
        },
      },
    });

    expect(sla.clocks.first_response.state).toBe('satisfied');
    expect(sla.clocks.next_update.state).toBe('unknown');
    expect(sla.state).toBe('unknown');
    expect(sla.known).toBe(false);
  });

  it('preserves explicit paused and inactive states without calling them active', () => {
    const paused = normalizeTicketSla({ paused: true });
    const inactive = normalizeTicketSla({
      clocks: {
        first_response: { state: 'inactive', known: true },
        next_update: { state: 'inactive', known: true },
        resolution: { state: 'inactive', known: true },
      },
    });

    expect(paused.clocks.first_response.state).toBe('paused');
    expect(paused.state).toBe('paused');
    expect(inactive.state).toBe('inactive');
    expect(inactive.known).toBe(true);
  });

  it('accepts flat compatibility aliases only when their evidence is explicit', () => {
    const sla = normalizeTicketSla({
      first_response_status: 'overdue',
      first_response_due_at: '2026-08-30T10:00:00Z',
    });

    expect(sla.clocks.first_response.state).toBe('overdue');
    expect(sla.clocks.next_update.state).toBe('unknown');
    expect(sla.state).toBe('overdue');
  });
});
