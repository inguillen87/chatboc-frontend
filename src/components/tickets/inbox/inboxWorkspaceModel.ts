import type { OmnichannelInboxItem } from '@/api/v2/saas';
export type InboxQueue = 'all' | 'unread' | 'unassigned' | 'queued';
export type InboxSort = 'recent' | 'oldest' | 'name';
export interface InboxFilters { search: string; channel: string; status: string; queue: InboxQueue; sort: InboxSort }
export const INITIAL_INBOX_FILTERS: InboxFilters = { search: '', channel: '', status: '', queue: 'all', sort: 'recent' };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export const inboxSearchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export const validInboxTenant = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
export const inboxChannel = (item: OmnichannelInboxItem) => text(item.canal_ingreso || item.channel).toLowerCase();
export const inboxChannelLabel = (value: string) => value === 'whatsapp' ? 'WhatsApp' : value || 'Canal no informado';
export function inboxActivityTime(value: unknown): number | null {
  const source = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(source)) return null;
  const time = Date.parse(source); return Number.isFinite(time) ? time : null;
}
export function inboxAssignment(item: OmnichannelInboxItem): 'assigned' | 'unassigned' | 'unknown' {
  const assignee = record(item.assignee);
  if (text(assignee.name) || text(assignee.email) || (typeof assignee.id === 'number' && assignee.id > 0) || /^[1-9]\d*$/.test(text(assignee.id))) return 'assigned';
  const raw = record(item.raw);
  return raw.assignee === null || (Object.hasOwn(raw, 'assignee_id') && raw.assignee_id === null) ? 'unassigned' : 'unknown';
}
export function assertInboxTenantEnvelope(value: unknown, tenantSlug?: string | null): void {
  if (!tenantSlug) return; // Server authorization remains required for legacy consumers.
  const visit = (value: unknown, depth: number) => {
    const row = record(value);
    for (const slug of [row.tenant_slug, row.tenantSlug, record(row.tenant).slug]) {
      if (slug !== undefined && slug !== null && slug !== tenantSlug) throw new Error('La respuesta no corresponde a esta organización.');
    }
    if (depth === 0) return;
    for (const key of ['data', 'item', 'ticket', 'conversation']) if (row[key] && !Array.isArray(row[key])) visit(row[key], depth - 1);
    for (const key of ['items', 'tickets', 'conversations', 'inbox']) if (Array.isArray(row[key])) (row[key] as unknown[]).forEach(item => visit(item, 0));
  };
  visit(value, 3);
}
export function verifiedInboxItems(items: OmnichannelInboxItem[], tenantSlug: string) {
  const candidates = items.filter(item => {
    if (!item.id?.trim() || (item.tenant_slug !== undefined && item.tenant_slug !== tenantSlug)) return false;
    const raw = record(item.raw);
    if (Object.keys(raw).length && ![raw.id, raw.ticket_id, raw.conversation_id].some(value => (typeof value === 'string' && value.trim()) || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0))) return false;
    return true;
  });
  const counts = new Map<string, number>();
  candidates.forEach(item => counts.set(item.id, (counts.get(item.id) || 0) + 1));
  return candidates.filter(item => counts.get(item.id) === 1);
}
export function matchesInboxQueue(item: OmnichannelInboxItem, queue: InboxQueue): boolean {
  if (queue === 'unread') return Number.isFinite(item.unreadCount) && item.unreadCount > 0;
  if (queue === 'unassigned') return inboxAssignment(item) === 'unassigned';
  if (queue === 'queued') return item.live_chat?.channel_state === 'queued';
  return true;
}
export function filterInboxItems(items: OmnichannelInboxItem[], filters: InboxFilters) {
  const search = inboxSearchText(filters.search.trim());
  const result = items.filter(item => matchesInboxQueue(item, filters.queue) && (!filters.channel || inboxChannel(item) === filters.channel) && (!filters.status || item.status === filters.status) && inboxSearchText([item.title, item.id, item.nro_ticket, item.description, item.category, text(item.contact?.name), text(item.contact?.email)].filter(Boolean).join(' ')).includes(search));
  return result.sort((a,b) => {
    if (filters.sort === 'name') return a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id);
    const ta = inboxActivityTime(a.lastMessageAt), tb = inboxActivityTime(b.lastMessageAt);
    if (ta === null || tb === null) return ta === tb ? a.id.localeCompare(b.id) : ta === null ? 1 : -1;
    return (filters.sort === 'oldest' ? ta - tb : tb - ta) || a.id.localeCompare(b.id);
  });
}
export function buildInboxCounters(items: OmnichannelInboxItem[]) {
  return { all: items.length, unread: items.filter(item => matchesInboxQueue(item,'unread')).length, unassigned: items.filter(item => matchesInboxQueue(item,'unassigned')).length, queued: items.filter(item => matchesInboxQueue(item,'queued')).length, unknownAssignment: items.filter(item=>inboxAssignment(item)==='unknown').length };
}
