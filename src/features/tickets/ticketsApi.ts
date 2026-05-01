import { panelApi } from '@/api/v2/client';
import type { V2Ticket } from './ticketTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const normalizeTicket = (value: unknown): V2Ticket | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id) ?? asString(value.ticket_id) ?? asString(value.nro_ticket);
  if (!id) return null;

  const assignee = isRecord(value.assignee) ? value.assignee : null;
  return {
    id,
    title:
      asString(value.title) ??
      asString(value.asunto) ??
      asString(value.subject) ??
      asString(value.descripcion) ??
      id,
    status: asString(value.status) ?? asString(value.estado) ?? 'unknown',
    priority: asString(value.priority) ?? asString(value.prioridad),
    sla_state: asString(value.sla_state) ?? asString(value.sla_status),
    channel: asString(value.channel) ?? asString(value.canal) ?? asString(value.canal_ingreso),
    category: asString(value.category) ?? asString(value.categoria),
    assignee_name: asString(value.assignee_name) ?? asString(assignee?.name) ?? null,
    updated_at: asString(value.updated_at) ?? asString(value.ultima_actualizacion) ?? null,
  };
};

const normalizeTicketsResponse = (response: unknown): { items: V2Ticket[] } => {
  const rawItems = Array.isArray(response)
    ? response
    : isRecord(response) && Array.isArray(response.items)
      ? response.items
      : isRecord(response) && Array.isArray(response.tickets)
        ? response.tickets
        : [];

  return {
    items: rawItems.map((item) => normalizeTicket(item)).filter((item): item is V2Ticket => Boolean(item)),
  };
};

export const listV2Tickets = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/tickets', {
    tenantSlug,
    legacyFallbackPath: '/tickets',
  });
  return normalizeTicketsResponse(response);
};
