import { describe, expect, it } from 'vitest';
import { clearTicketFocus, toggleTicketFocus, TICKET_FOCUS_FILTERS, type TicketFocusKey } from './ticketFocusFilters';
const base = { unread: 'all', sla: 'all', agent: 'all', channel: 'whatsapp', search: 'consulta', area: 'obras', status: 'nuevo' };

describe('ticket focus uses existing filters without widening the search', () => {
  for (const key of Object.keys(TICKET_FOCUS_FILTERS) as TicketFocusKey[]) {
    it(`toggles ${key} and preserves every unrelated filter`, () => {
      const result = toggleTicketFocus(base, key);
      expect(result).toEqual({ ...base, [key]: TICKET_FOCUS_FILTERS[key] });
      expect(toggleTicketFocus(result, key)).toEqual(base);
      expect(base[key]).toBe('all');
    });
  }
  it('combines shortcuts rather than resetting earlier selections', () => {
    const combined = toggleTicketFocus(toggleTicketFocus(base, 'unread'), 'sla');
    expect(combined.unread).toBe('unread');
    expect(combined.sla).toBe('risk');
    expect(combined.channel).toBe('whatsapp');
  });
  it('removes only shortcuts while preserving a manually selected agent', () => {
    expect(clearTicketFocus({ ...base, unread: 'unread', sla: 'risk', agent: 'operator-7' }))
      .toEqual({ ...base, agent: 'operator-7' });
  });
  it('does not clear another SLA criterion', () => {
    expect(clearTicketFocus({ ...base, sla: 'healthy', agent: 'unassigned' }))
      .toEqual({ ...base, sla: 'healthy' });
  });
});
