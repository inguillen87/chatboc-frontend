import { panelApi } from '@/api/v2/client';

type UnknownRecord = Record<string, unknown>;

export interface SlaPolicyV2 {
  id: string;
  label: string;
  name?: string;
  status?: string;
  first_response_minutes?: number;
  resolution_minutes?: number;
  next_update_minutes?: number;
  raw?: unknown;
}

export interface SlaPoliciesV2Response {
  contract_version?: string;
  request_id?: string;
  items: SlaPolicyV2[];
  raw: unknown;
}

export interface SlaBreachV2 {
  id: string;
  ticket_id?: string;
  type?: string;
  status?: string;
  due_at?: string;
  detected_at?: string;
  ticket?: UnknownRecord;
  raw?: unknown;
}

export interface SlaBreachesV2Response {
  contract_version?: string;
  request_id?: string;
  items: SlaBreachV2[];
  raw: unknown;
}

export type SlaPolicyPayload = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const getSource = (response: unknown) => {
  if (isRecord(response) && isRecord(response.data)) return response.data;
  return response;
};

const getFirst = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const firstArray = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.items)) return value.items;
  }
  return [];
};

const normalizePolicy = (value: unknown, index = 0): SlaPolicyV2 | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'policy_id', 'key', 'slug'])) ?? `sla_policy_${index + 1}`;
  const label = asString(getFirst(value, ['label', 'name', 'title', 'nombre'])) ?? id;

  return {
    id,
    label,
    name: asString(getFirst(value, ['name', 'nombre'])),
    status: asString(getFirst(value, ['status', 'state', 'estado'])),
    first_response_minutes: asNumber(getFirst(value, ['first_response_minutes', 'first_response_sla_minutes', 'first_response'])),
    resolution_minutes: asNumber(getFirst(value, ['resolution_minutes', 'resolution_sla_minutes', 'resolution'])),
    next_update_minutes: asNumber(getFirst(value, ['next_update_minutes', 'next_update_sla_minutes', 'next_update'])),
    raw: value,
  };
};

const normalizeBreach = (value: unknown, index = 0): SlaBreachV2 | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'breach_id', 'event_id'])) ?? `sla_breach_${index + 1}`;
  const ticket = asRecord(value.ticket);

  return {
    id,
    ticket_id: asString(getFirst(value, ['ticket_id', 'ticketId', 'nro_ticket']) ?? ticket.id),
    type: asString(getFirst(value, ['type', 'breach_type', 'kind'])),
    status: asString(getFirst(value, ['status', 'state', 'estado'])),
    due_at: asString(getFirst(value, ['due_at', 'deadline', 'sla_due_at'])),
    detected_at: asString(getFirst(value, ['detected_at', 'created_at', 'timestamp'])),
    ticket: isRecord(value.ticket) ? ticket : undefined,
    raw: value,
  };
};

export const normalizeSlaPoliciesV2 = (response: unknown): SlaPoliciesV2Response => {
  const source = getSource(response);
  const record = asRecord(source);
  const itemsSource = Array.isArray(source) ? source : firstArray(record, ['items', 'policies', 'data']);

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    items: itemsSource.map(normalizePolicy).filter((item): item is SlaPolicyV2 => Boolean(item)),
    raw: response,
  };
};

export const normalizeSlaBreachesV2 = (response: unknown): SlaBreachesV2Response => {
  const source = getSource(response);
  const record = asRecord(source);
  const itemsSource = Array.isArray(source) ? source : firstArray(record, ['items', 'breaches', 'data']);

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    items: itemsSource.map(normalizeBreach).filter((item): item is SlaBreachV2 => Boolean(item)),
    raw: response,
  };
};

export const getSlaPoliciesV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/sla/policies', { tenantSlug });
  return normalizeSlaPoliciesV2(response);
};

export const createSlaPolicyV2 = async (payload: SlaPolicyPayload, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>('/api/v2/sla/policies', payload, { tenantSlug });
  const source = getSource(response);
  const policy =
    normalizePolicy(isRecord(source) ? getFirst(source, ['policy', 'item', 'data']) ?? source : source) ??
    normalizePolicy(payload);

  return {
    contract_version: isRecord(source) ? asString(source.contract_version) : undefined,
    request_id: isRecord(source) ? asString(source.request_id) : undefined,
    item: policy,
    raw: response,
  };
};

export const getSlaBreachesV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/sla/breaches', { tenantSlug });
  return normalizeSlaBreachesV2(response);
};
