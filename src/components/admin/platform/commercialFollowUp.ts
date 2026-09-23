/** Canonical identities for the tenant CRM. Display numbers are never write IDs. */
export const COMMERCIAL_STAGES = [
  'nuevo', 'contactado', 'calificado', 'demo_agendada', 'propuesta_enviada', 'ganado', 'perdido',
] as const;
export type CommercialStage = typeof COMMERCIAL_STAGES[number];
export const STAGE_LABELS: Record<CommercialStage, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', calificado: 'Calificado',
  demo_agendada: 'Demo agendada', propuesta_enviada: 'Propuesta enviada', ganado: 'Ganado', perdido: 'Perdido',
};
export interface CommercialIdentity { tenantSlug: string; ticketType: 'municipio' | 'pyme' | 'tenant'; ticketId: string }
export interface CommercialLead extends CommercialIdentity {
  key: string; number: string; name: string; email: string; phone: string;
  stage: string; category: string; lastSeen: string | null;
}
export interface CommercialEvent {
  at: string | null; actor: string | null; event: string; from: string; to: string; note: string;
}
export interface CommercialList { items: CommercialLead[]; received: number; excluded: number; reportedTotal: number | null }
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const scalar = (value: unknown) => typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '';
export const normalizeCommercialSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export const isCommercialStage = (stage: string): stage is CommercialStage => (COMMERCIAL_STAGES as readonly string[]).includes(stage);
export const stageLabel = (stage: string) => isCommercialStage(stage) ? STAGE_LABELS[stage] : 'Etapa no informada';
export function canonicalTicketId(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) ? value : null;
}
export function assertIdentity(identity: CommercialIdentity): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(identity.tenantSlug) ||
      !['municipio', 'pyme', 'tenant'].includes(identity.ticketType) || !canonicalTicketId(identity.ticketId)) {
    throw new Error('No se pudo verificar la identidad del caso.');
  }
}
export const commercialKey = (identity: CommercialIdentity) => JSON.stringify([identity.tenantSlug, identity.ticketType, identity.ticketId]);
export function commercialPath(identity: CommercialIdentity, action: 'timeline' | 'stage'): string {
  assertIdentity(identity);
  return `/api/admin/tenants/${encodeURIComponent(identity.tenantSlug)}/leads/${identity.ticketType}/${identity.ticketId}/${action}`;
}
export function parseCommercialList(raw: unknown, tenantSlug: string): CommercialList {
  const data = record(raw);
  if (data.tenant_slug !== tenantSlug || !Array.isArray(data.items)) throw new Error('La respuesta no corresponde a esta organización.');
  const candidates: CommercialLead[] = [];
  for (const value of data.items) {
    const row = record(value), ticketId = canonicalTicketId(row.ticket_id);
    if (!ticketId || !['municipio', 'pyme', 'tenant'].includes(text(row.ticket_type)) ||
        (row.tenant_slug !== undefined && row.tenant_slug !== tenantSlug)) continue;
    const identity: CommercialIdentity = { tenantSlug, ticketType: row.ticket_type as CommercialIdentity['ticketType'], ticketId };
    assertIdentity(identity);
    candidates.push({ ...identity, key: commercialKey(identity), number: scalar(row.nro) || scalar(row.nro_ticket) || ticketId,
      name: text(row.nombre) || text(row.name) || 'Sin nombre informado', email: text(row.email),
      phone: text(row.telefono) || text(row.phone), stage: text(row.stage), category: text(row.categoria), lastSeen: validDate(row.last_seen) });
  }
  const counts = new Map<string, number>();
  candidates.forEach((row) => counts.set(row.key, (counts.get(row.key) || 0) + 1));
  // Ambiguous duplicate identities are excluded entirely, not arbitrarily deduplicated.
  const items = candidates.filter((row) => counts.get(row.key) === 1);
  return { items, received: data.items.length, excluded: data.items.length - items.length,
    reportedTotal: typeof data.total === 'number' && Number.isSafeInteger(data.total) && data.total >= 0 ? data.total : null };
}
export function validDate(value: unknown): string | null {
  const date = text(value);
  return date && /^\d{4}-\d{2}-\d{2}T/.test(date) && Number.isFinite(Date.parse(date)) ? date : null;
}
function assertReceipt(raw: unknown, identity: CommercialIdentity, writing: boolean): Record<string, unknown> {
  assertIdentity(identity);
  const data = record(raw);
  if (canonicalTicketId(data.ticket_id) !== identity.ticketId || data.ticket_type !== identity.ticketType ||
      (data.tenant_slug !== undefined && data.tenant_slug !== identity.tenantSlug) || (writing && data.ok !== true)) {
    throw new Error('El servidor no confirmó la operación para este caso.');
  }
  return data;
}
export function parseCommercialTimeline(raw: unknown, identity: CommercialIdentity, writing = false): CommercialEvent[] {
  const data = assertReceipt(raw, identity, writing);
  if (!Array.isArray(data.timeline)) throw new Error('El historial recibido no es válido.');
  const events = data.timeline.map((value): CommercialEvent => {
    const item = record(value);
    return { at: validDate(item.at), actor: canonicalTicketId(item.by_user_id), event: text(item.event),
      from: text(item.from), to: text(item.to), note: text(item.note) };
  });
  return events.reverse(); // Server order is chronological; unknown dates must not reorder events.
}
export function assertStageReceipt(raw: unknown, identity: CommercialIdentity, stage: CommercialStage): void {
  const data = assertReceipt(raw, identity, true);
  if (data.lead_stage !== stage) throw new Error('El servidor no confirmó la etapa elegida.');
}
export function validateCommercialNote(note: string): string {
  const value = note.trim();
  if (!value || value.length > 1000) throw new Error('La nota debe tener entre 1 y 1000 caracteres.');
  return value;
}
export function filterCommercialLeads(items: CommercialLead[], query: string, stage: string): CommercialLead[] {
  const q = normalizeCommercialSearch(query.trim());
  return items.filter((row) => (stage === 'all' || (stage === 'open' ? isCommercialStage(row.stage) && !['ganado', 'perdido'].includes(row.stage) : row.stage === stage)) &&
    normalizeCommercialSearch([row.name, row.email, row.phone, row.number, row.ticketId, row.category].join(' ')).includes(q));
}
export function commercialCsv(items: CommercialLead[]): string {
  const cell = (value: string) => {
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [['Organización', 'Tipo', 'ID interno', 'Número visible', 'Contacto', 'Correo', 'Teléfono', 'Etapa', 'Última actividad'],
    ...items.map((row) => [row.tenantSlug, row.ticketType, row.ticketId, row.number, row.name, row.email, row.phone, stageLabel(row.stage), row.lastSeen || ''])]
    .map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function downloadCommercialCsv(items: CommercialLead[]): void {
  const url = URL.createObjectURL(new Blob([commercialCsv(items)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'chatboc-seguimiento-filtrado.csv';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
