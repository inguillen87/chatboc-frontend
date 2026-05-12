import { panelApi } from '@/api/v2/client';
import type { V2Ticket, V2TicketComment, V2TicketEvent, V2TicketListResponse } from './ticketTypes';
import type { EducationCaseAlias } from '@/types/education';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim()
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : undefined;

const getFirst = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const normalizeEducationCaseAlias = (value: unknown): EducationCaseAlias | null => {
  if (!isRecord(value)) return null;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    id: asString(getFirst(value, ['id', 'alias_id'])),
    case_id: getFirst(value, ['case_id', 'school_case_id', 'education_case_id']) as string | number | null | undefined,
    ticket_id: getFirst(value, ['ticket_id', 'ticketId']) as string | number | null | undefined,
    school_id: getFirst(value, ['school_id', 'colegio_id']) as string | number | null | undefined,
    school_name: asString(getFirst(value, ['school_name', 'colegio_nombre', 'institution_name'])) ?? null,
    student_id: getFirst(value, ['student_id', 'alumno_id']) as string | number | null | undefined,
    student_name: asString(getFirst(value, ['student_name', 'alumno_nombre'])) ?? null,
    guardian_id: getFirst(value, ['guardian_id', 'family_id', 'tutor_id']) as string | number | null | undefined,
    guardian_name: asString(getFirst(value, ['guardian_name', 'family_name', 'tutor_nombre'])) ?? null,
    case_type: asString(getFirst(value, ['case_type', 'type', 'tipo'])) ?? null,
    taxonomy_label: asString(getFirst(value, ['taxonomy_label', 'case_label', 'label'])) ?? null,
    status: asString(getFirst(value, ['status', 'estado'])) ?? null,
    sensitivity_level: asString(getFirst(value, ['sensitivity_level', 'sensitivity', 'sensibilidad'])) ?? null,
    requires_handoff: typeof value.requires_handoff === 'boolean' ? value.requires_handoff : null,
  };
};

const buildQueryString = (params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const normalizeTicket = (value: unknown): V2Ticket | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id) ?? asString(value.ticket_id) ?? asString(value.nro_ticket);
  if (!id) return null;

  const assignee = isRecord(value.assignee) ? value.assignee : null;
  const slaState = asString(value.sla_state) ?? asString(value.sla_status);
  const schoolCase = normalizeEducationCaseAlias(getFirst(value, ['school_case', 'education_case', 'case_alias']));
  return {
    id,
    title:
      asString(value.title) ??
      asString(value.asunto) ??
      asString(value.subject) ??
      asString(value.descripcion) ??
      id,
    description: asString(value.description) ?? asString(value.descripcion) ?? null,
    status: asString(value.status) ?? asString(value.estado) ?? 'unknown',
    priority: asString(value.priority) ?? asString(value.prioridad),
    sla_state: slaState,
    sla_status: asString(value.sla_status) ?? slaState,
    channel: asString(value.channel) ?? asString(value.canal) ?? asString(value.canal_ingreso),
    category: asString(value.category) ?? asString(value.categoria),
    assignee: assignee
      ? {
          id: asString(getFirst(assignee, ['id', 'user_id', 'employee_id'])) ?? null,
          name: asString(getFirst(assignee, ['name', 'nombre', 'email'])) ?? null,
        }
      : null,
    assignee_name: asString(value.assignee_name) ?? (assignee ? asString(getFirst(assignee, ['name', 'nombre', 'email'])) : undefined) ?? null,
    school_case: schoolCase,
    created_at: asString(value.created_at) ?? asString(value.fecha_creacion) ?? null,
    updated_at: asString(value.updated_at) ?? asString(value.ultima_actualizacion) ?? null,
    raw: value,
  };
};

export const normalizeTicketsResponse = (response: unknown): V2TicketListResponse => {
  const responseData = isRecord(response) && isRecord(response.data) ? response.data : null;
  const rawItems = Array.isArray(response)
    ? response
    : isRecord(response) && Array.isArray(response.items)
      ? response.items
      : isRecord(response) && Array.isArray(response.tickets)
        ? response.tickets
        : responseData && Array.isArray(responseData.items)
          ? responseData.items
          : responseData && Array.isArray(responseData.tickets)
            ? responseData.tickets
            : [];
  const record = isRecord(response) ? response : {};

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    items: rawItems.map((item) => normalizeTicket(item)).filter((item): item is V2Ticket => Boolean(item)),
    pagination: isRecord(record.pagination) ? record.pagination : undefined,
    summary: isRecord(record.summary) ? record.summary : undefined,
    raw: response,
  };
};

const normalizeComment = (value: unknown, index = 0): V2TicketComment | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'comment_id', 'message_id'])) ?? `comment_${index + 1}`;
  return {
    id,
    ticket_id: asString(getFirst(value, ['ticket_id', 'ticketId'])),
    body: asString(getFirst(value, ['body', 'text', 'message', 'comment', 'comentario'])) ?? '',
    visibility: asString(getFirst(value, ['visibility', 'visibilidad'])) ?? 'public',
    author_name: asString(getFirst(value, ['author_name', 'agent_name', 'user_name'])) ?? null,
    created_at: asString(getFirst(value, ['created_at', 'timestamp', 'fecha'])) ?? null,
    raw: value,
  };
};

const normalizeEvent = (value: unknown, index = 0): V2TicketEvent | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'event_id'])) ?? `event_${index + 1}`;
  return {
    id,
    ticket_id: asString(getFirst(value, ['ticket_id', 'ticketId'])),
    type: asString(getFirst(value, ['type', 'event_type', 'kind'])) ?? 'ticket.event',
    label: asString(getFirst(value, ['label', 'title', 'message'])) ?? null,
    actor_name: asString(getFirst(value, ['actor_name', 'author_name', 'user_name'])) ?? null,
    created_at: asString(getFirst(value, ['created_at', 'timestamp', 'fecha'])) ?? null,
    payload: isRecord(value.payload) ? value.payload : undefined,
    raw: value,
  };
};

const firstArray = (response: unknown, keys: string[]) => {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];
  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.items)) return value.items;
  }
  return [];
};

export const listV2Tickets = async (
  tenantSlug?: string | null,
  filters?: Record<string, string | number | boolean | null | undefined>,
) => {
  const query = buildQueryString(filters);
  const response = await panelApi.get<unknown>(`/api/v2/tickets${query}`, {
    tenantSlug,
    legacyFallbackPath: `/tickets${query}`,
  });
  return normalizeTicketsResponse(response);
};

export const createV2Ticket = async (payload: Record<string, unknown>, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>('/api/v2/tickets', payload, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeTicket(getFirst(record, ['ticket', 'item', 'data']) ?? response);
};

export const updateV2Ticket = async (
  ticketId: string | number,
  payload: Record<string, unknown>,
  tenantSlug?: string | null,
) => {
  const response = await panelApi.patch<unknown>(`/api/v2/tickets/${encodeURIComponent(String(ticketId))}`, payload, {
    tenantSlug,
  });
  const record = isRecord(response) ? response : {};
  return normalizeTicket(getFirst(record, ['ticket', 'item', 'data']) ?? response);
};

export const addV2TicketComment = async (
  ticketId: string | number,
  payload: { body?: string; message?: string; visibility?: 'public' | 'internal' | 'private' | string; [key: string]: unknown },
  tenantSlug?: string | null,
) => {
  const response = await panelApi.post<unknown>(
    `/api/v2/tickets/${encodeURIComponent(String(ticketId))}/comments`,
    payload,
    { tenantSlug },
  );
  const record = isRecord(response) ? response : {};
  return normalizeComment(getFirst(record, ['comment', 'item', 'data']) ?? response);
};

export const getV2TicketEvents = async (ticketId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>(`/api/v2/tickets/${encodeURIComponent(String(ticketId))}/events`, {
    tenantSlug,
  });
  return {
    contract_version: isRecord(response) ? asString(response.contract_version) : undefined,
    request_id: isRecord(response) ? asString(response.request_id) : undefined,
    items: firstArray(response, ['items', 'events', 'data'])
      .map(normalizeEvent)
      .filter((item): item is V2TicketEvent => Boolean(item)),
    raw: response,
  };
};
