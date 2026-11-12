import { describe, expect, it } from 'vitest';
import type { OmnichannelInboxItem } from '@/api/v2/saas';
import { assertInboxTenantEnvelope, buildInboxCounters, filterInboxItems, inboxActivityTime, inboxAssignment, INITIAL_INBOX_FILTERS, validInboxTenant, verifiedInboxItems } from './inboxWorkspaceModel';
const item = (id = 'municipio:12', extra: Partial<OmnichannelInboxItem> = {}): OmnichannelInboxItem => ({
  id, title: 'José luminaria', status: 'nuevo', channel: 'whatsapp', lastMessageAt: '2026-09-23T12:00:00Z', unreadCount: 2,
  attachments: [], presence: [], timeline: [], actions: [], allowed_actions: [], next_steps: [], agent_copilot_suggestions: [], ...extra,
});
describe('operational inbox model', () => {
  it.each([null, undefined, '', 'org/a', 'a?b', ' a'])('requires a confirmed tenant: %s', value => expect(validInboxTenant(value)).toBe(false));
  it('accepts a configured organization slug', () => expect(validInboxTenant('tierra-del-fuego')).toBe(true));
  it.each(['', 'invalid', '2026-09-23T12:00:00', null])('does not invent activity for %s', value => expect(inboxActivityTime(value)).toBeNull());
  it('reads zoned timestamps', () => expect(inboxActivityTime('2026-09-23T09:00:00-03:00')).toBe(Date.parse('2026-09-23T12:00:00Z')));
  it('separates unknown assignment from unassignment', () => {
    expect(inboxAssignment(item())).toBe('unknown');
    expect(inboxAssignment(item('a', { raw: { id: 'a', assignee: null } }))).toBe('unassigned');
    expect(inboxAssignment(item('a', { assignee: { id: 7, name: 'Operador' } }))).toBe('assigned');
  });
  it('counts conversations rather than unread messages', () => expect(buildInboxCounters([item(), item('b', { unreadCount: 9 })]).unread).toBe(2));
  it('only counts a queue declared by the server', () => expect(buildInboxCounters([item(), item('b', { live_chat: { channel_state: 'queued' } })]).queued).toBe(1));
  it('combines accent search, channel and unread view', () => {
    const rows = [item(), item('b', { channel: 'web' }), item('c', { unreadCount: 0 })];
    expect(filterInboxItems(rows, { ...INITIAL_INBOX_FILTERS, search: 'jose', channel: 'whatsapp', queue: 'unread' }).map(value => value.id)).toEqual(['municipio:12']);
  });
  it('places unknown dates last without mutating the list', () => {
    const rows = [item('b', { lastMessageAt: '' }), item('a'), item('c', { lastMessageAt: '2026-09-21T00:00:00Z' })];
    expect(filterInboxItems(rows, { ...INITIAL_INBOX_FILTERS, sort: 'oldest' }).map(row => row.id)).toEqual(['c', 'a', 'b']);
    expect(rows.map(row => row.id)).toEqual(['b', 'a', 'c']);
  });
  it('excludes all duplicate identities and does not use display numbers as IDs', () => {
    const rows = [item(), item(), item('b', { raw: { nro_ticket: '9001' } }), item('c', { tenant_slug: 'other' }), item('d')];
    expect(verifiedInboxItems(rows, 'junin').map(row => row.id)).toEqual(['d']);
  });
  it.each([
    { tenant_slug: 'other' }, { data: { tenantSlug: 'other' } },
    { data: { ticket: { tenant: { slug: 'other' } } } }, { data: { items: [{ tenant_slug: 'other' }] } },
  ])('rejects a foreign response envelope', raw => expect(() => assertInboxTenantEnvelope(raw, 'junin')).toThrow());
  it('does not infer tenant identity from an unrelated contact value', () => expect(() => assertInboxTenantEnvelope({ tenant_slug: 'junin', contact: { tenant_slug: 'other' } }, 'junin')).not.toThrow());
});
