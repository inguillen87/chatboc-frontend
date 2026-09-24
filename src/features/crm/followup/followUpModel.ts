export interface FollowUpIdentity { tenantSlug: string; contactId: string }
export interface FollowUpSnapshot extends FollowUpIdentity {
  name: string; notes: string; nextActionAt: string | null;
  updatedAt: string | null; updatedBy: string | null;
}
export interface FollowUpRow extends FollowUpIdentity {
  key: string; name: string; organization: string; nextActionAt: string | null;
}
export const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function assertFollowUpIdentity(identity: FollowUpIdentity): void {
  for (const value of [identity.tenantSlug, identity.contactId]) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) throw new Error('Identidad del contacto no verificable.');
  }
}
export const followUpKey = (identity: FollowUpIdentity) => JSON.stringify([identity.tenantSlug, identity.contactId]);
export function assertFollowUpScope(value: unknown, identity: FollowUpIdentity): void {
  const data = asRecord(value), tenant = asRecord(data.tenant);
  for (const slug of [data.tenant_slug, tenant.slug]) {
    if (slug !== undefined && slug !== null && slug !== identity.tenantSlug) throw new Error('La respuesta corresponde a otra organización.');
  }
}
export function validScheduledInstant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)) && validCalendarDate(value);
}
export function parseFollowUpHistory(raw: unknown, identity: FollowUpIdentity): FollowUpSnapshot {
  assertFollowUpIdentity(identity); assertFollowUpScope(raw, identity);
  const contact = asRecord(asRecord(raw).contact), preferences = asRecord(contact.preferences);
  assertFollowUpScope(contact, identity);
  if (String(contact.id ?? '') !== identity.contactId || contact.pii_masked === true) throw new Error('Contacto no verificado.');
  if (contact.preferences !== null && contact.preferences !== undefined && (typeof contact.preferences !== 'object' || Array.isArray(contact.preferences))) throw new Error('Seguimiento inválido.');
  if (preferences.owner_notes != null && typeof preferences.owner_notes !== 'string') throw new Error('Notas no verificables.');
  if (preferences.next_action_at != null && typeof preferences.next_action_at !== 'string') throw new Error('Fecha no verificable.');
  return { ...identity, name: asText(contact.name) || 'Contacto sin nombre informado',
    notes: typeof preferences.owner_notes === 'string' ? preferences.owner_notes : '',
    nextActionAt: asText(preferences.next_action_at) || null,
    updatedAt: asText(preferences.stage_updated_at) || null,
    updatedBy: typeof preferences.stage_updated_by === 'number' || typeof preferences.stage_updated_by === 'string' ? String(preferences.stage_updated_by) : null };
}
export const followUpRevision = (snapshot: FollowUpSnapshot) => JSON.stringify([snapshot.notes,snapshot.nextActionAt,snapshot.updatedAt,snapshot.updatedBy]);
export function toLocalDateTime(value: string | null): string {
  if (!validScheduledInstant(value)) return '';
  const date = new Date(value), pad = (n: number) => String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function fromLocalDateTime(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Ingresá una fecha y hora válidas.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || toLocalDateTime(date.toISOString()) !== value) throw new Error('La fecha no existe en la zona horaria seleccionada.');
  return date.toISOString();
}
export type FollowUpQueueView = 'all' | 'overdue' | 'today' | 'scheduled' | 'unscheduled' | 'unverified';
export function parseFollowUpQueue(value: unknown): {items: FollowUpRow[]; received: number; excluded: number} {
  const data = asRecord(value);
  if (!Array.isArray(data.items)) throw new Error('La agenda no publicó una lista verificable.');
  const rows: FollowUpRow[] = [];
  for (const item of data.items) {
    const row = asRecord(item), tenant = asRecord(row.tenant);
    const identity = { tenantSlug: asText(tenant.slug), contactId: asText(row.contact_id) };
    try { assertFollowUpIdentity(identity); assertFollowUpScope(row,identity); } catch { continue; }
    if (row.pii_masked === true) continue;
    const nextActionAt = Object.hasOwn(row,'next_action_at') && (row.next_action_at === null || row.next_action_at === '') ? null
      : typeof row.next_action_at === 'string' ? row.next_action_at : 'unverified';
    rows.push({...identity,key:followUpKey(identity),name:asText(row.name)||'Contacto sin nombre informado',organization:asText(tenant.nombre)||asText(tenant.name)||identity.tenantSlug,nextActionAt});
  }
  const counts = new Map<string,number>(); rows.forEach(row=>counts.set(row.key,(counts.get(row.key)||0)+1));
  const items = rows.filter(row=>counts.get(row.key)===1);
  return {items,received:data.items.length,excluded:data.items.length-items.length};
}
export function followUpState(when: string | null, now: Date): Exclude<FollowUpQueueView,'all'> {
  if (when === null) return 'unscheduled';
  if (!validScheduledInstant(when)) return 'unverified';
  const date = new Date(when);
  if (date.getTime() < now.getTime()) return 'overdue';
  return date.toDateString() === now.toDateString() ? 'today' : 'scheduled';
}
export const FOLLOW_UP_LABELS: Record<FollowUpQueueView,string> = {all:'Todos',overdue:'Vencidos',today:'Hoy',scheduled:'Próximos',unscheduled:'Sin fecha',unverified:'Fecha no verificable'};
export const followUpDateLabel = (when: string | null) => when === null ? 'Sin fecha programada' : validScheduledInstant(when)
  ? new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(when)) : 'Fecha no verificable';
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Zona local del navegador';

function validCalendarDate(value: string): boolean {
  const [year,month,day]=value.slice(0,10).split('-').map(Number);
  if(year<1000||year>9999||month<1||month>12||day<1)return false;
  return day<=new Date(Date.UTC(year,month,0)).getUTCDate();
}
