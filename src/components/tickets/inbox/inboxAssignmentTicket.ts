import type { OmnichannelInboxItem } from '@/api/v2/saas';
import type { Ticket } from '@/types/tickets';
import { validInboxTenant } from './inboxWorkspaceModel';

interface AssignmentScope {
  tenantSlug?: string | null;
  response?: unknown;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const identifier = (value: unknown) => {
  const valueText = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d*)$/.test(valueText)) return null;
  const numeric = Number(valueText);
  return Number.isSafeInteger(numeric) ? numeric : null;
};

const publishedTenant = (item: OmnichannelInboxItem, scope?: AssignmentScope): string | null => {
  if (scope && !validInboxTenant(scope.tenantSlug)) return null;
  const slugs: unknown[] = [item.tenant_slug];
  let envelope = record(scope?.response);
  // Backend responses may publish tenant.slug at the envelope, not on each item.
  // The active scope only checks a published identity; it never supplies one.
  for (let depth = 0; depth < 3; depth++) {
    slugs.push(envelope.tenant_slug, envelope.tenantSlug, record(envelope.tenant).slug);
    envelope = record(envelope.data);
  }
  const published = slugs.filter(value => value !== undefined && value !== null);
  if (!published.length || published.some(value => !validInboxTenant(value))) return null;
  const selected = published[0] as string;
  if (published.some(value => value !== selected)) return null;
  if (scope && selected !== scope.tenantSlug) return null;
  return selected;
};

export function inboxAssignmentTicket(item: OmnichannelInboxItem, scope?: AssignmentScope): Ticket | null {
  const id = identifier(item.ticket_id ?? item.id);
  const sourceModel = text(item.source_model);
  const tenantSlug = publishedTenant(item, scope);
  if (id === null || !sourceModel || !tenantSlug) return null;
  const assignee = item.assignee || {};
  const assigneeId = assignee.id ?? assignee.user_id ?? assignee.assignee_id ?? assignee.assigned_user_id;
  return {
    id,
    tipo: sourceModel.toLowerCase().includes('pyme') ? 'pyme' : 'municipio',
    nro_ticket: text(item.nro_ticket) || String(id),
    asunto: text(item.title) || ('Caso ' + id),
    estado: item.status as Ticket['estado'],
    fecha: text(item.lastMessageAt) || new Date(0).toISOString(),
    categoria: text(item.category) || undefined,
    source_model: sourceModel,
    tenant_slug: tenantSlug,
    assignedAgentId: assigneeId as string | number | undefined,
    assigned_agent_id: assigneeId as string | number | undefined,
    assigned_user_id: assigneeId as string | number | undefined,
    channel: (text(item.channel) || undefined) as Ticket['channel'],
  };
}
