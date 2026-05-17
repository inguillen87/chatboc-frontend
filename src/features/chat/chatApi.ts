import { panelApi } from '@/api/v2/client';
import { ApiError, apiFetch } from '@/utils/api';
import { getOrCreateAnonId } from '@/utils/anonIdGenerator';
import { createLeadCaptureIdempotencyKey } from '@/utils/leadCapture';
import type { ChatBootstrapConfig, ChatRatingValue } from './chatTypes';
import type { ChatLeadCaptureConfig } from '@/types/chat';

export { createLeadCaptureIdempotencyKey };

export interface ChatBootstrapMessagePayload {
  text?: string;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
  attachmentInfo?: unknown;
  location?: { lat: number; lng?: number; lon?: number; address?: string | null; accuracy?: number | null };
  audioBlob?: Blob;
  audioFilename?: string;
  audioField?: string;
  audioEndpoint?: string;
  action_id?: string | null;
  extraPayload?: Record<string, unknown>;
}

export interface LeadCaptureNextAction {
  id?: string | null;
  label?: string | null;
  endpoint?: string | null;
  method?: string | null;
  payload?: Record<string, unknown> | null;
  ui_hint?: string | null;
}

export interface OperationalAttachment {
  id?: string | number | null;
  name?: string | null;
  filename?: string | null;
  url?: string | null;
  type?: string | null;
  archivo_adjunto_id?: string | number | null;
  raw?: unknown;
}

export interface OperationalTicketResult {
  nro_ticket?: string | number | null;
  ticket_id?: string | number | null;
  chat_id?: string | number | null;
  status?: string | null;
  ticket_type?: string | null;
  categoria?: string | null;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  nombre_vecino?: string | null;
  telefono_vecino?: string | null;
  canal_ingreso?: string | null;
  foto_url_directa?: string | null;
  archivos_count?: number | null;
  archivos?: OperationalAttachment[];
  detail_endpoint?: string | null;
  raw?: unknown;
}

export interface OperationalOrderDetail {
  nombre_producto?: string | null;
  cantidad?: number | null;
  precio_unitario_original?: number | null;
  subtotal_con_descuento?: number | null;
  moneda?: string | null;
  presentacion?: string | null;
  sku?: string | null;
  raw?: unknown;
}

export interface OperationalOrderResult {
  nro_pedido?: string | number | null;
  nombre_cliente?: string | null;
  telefono_cliente?: string | null;
  monto_total?: number | null;
  detalles?: OperationalOrderDetail[];
  tracking_url?: string | null;
  raw?: unknown;
}

export interface LeadCaptureResponse {
  ok?: boolean;
  contract_version?: string | null;
  request_id?: string | null;
  tenant?: {
    slug?: string | null;
    tipo?: string | null;
  } | null;
  lead_id?: string | number | null;
  ticket_id?: string | number | null;
  ticket_type?: string | null;
  status?: string | null;
  deduplicated?: boolean;
  idempotency_key?: string | null;
  message_body?: string | null;
  next_actions?: LeadCaptureNextAction[];
  ticket?: OperationalTicketResult | null;
  order?: OperationalOrderResult | null;
  media_understanding?: OperationalMediaUnderstanding | null;
  raw?: unknown;
}

export interface OperationalMediaUnderstanding {
  supports?: string[];
  received?: string[];
  raw?: unknown;
}

interface LeadCaptureSubmitOptions {
  idempotencyKey?: string | null;
  persistTenantSlug?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (source: Record<string, unknown> | null | undefined, keys: string[]): string | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const readNumber = (source: Record<string, unknown> | null | undefined, keys: string[]): number | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const readFirstValue = (source: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const readNestedRecord = (source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null => {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) return value;
  }
  return null;
};

const normalizeOperationalAttachment = (value: unknown): OperationalAttachment | null => {
  if (typeof value === 'string' && value.trim()) {
    return { url: value.trim(), raw: value };
  }
  if (!isRecord(value)) return null;
  const url = readString(value, ['url', 'file_url', 'download_url', 'media_url', 'foto_url_directa', 'href']);
  const name = readString(value, ['name', 'nombre', 'label', 'title']);
  const filename = readString(value, ['filename', 'file_name', 'nombre_archivo', 'original_filename']);
  const id = readFirstValue(value, ['id', 'archivo_adjunto_id', 'attachment_id']);
  const type = readString(value, ['type', 'tipo', 'mime_type', 'mimeType']);
  if (!url && !name && !filename && id === undefined) return null;
  return {
    id: typeof id === 'string' || typeof id === 'number' ? id : null,
    name,
    filename,
    url,
    type,
    archivo_adjunto_id: readFirstValue(value, ['archivo_adjunto_id', 'attachment_id']) as string | number | null | undefined,
    raw: value,
  };
};

const collectOperationalAttachments = (source: Record<string, unknown>): OperationalAttachment[] => {
  const arrays = ['archivos', 'archivos_adjuntos', 'attachments', 'adjuntos', 'files', 'evidencias']
    .flatMap((key) => {
      const value = source[key];
      if (Array.isArray(value)) return value;
      return [];
    });
  const seen = new Set<string>();
  return arrays
    .map(normalizeOperationalAttachment)
    .filter((item): item is OperationalAttachment => Boolean(item))
    .filter((item) => {
      const key = `${item.id ?? ''}|${item.url ?? ''}|${item.filename ?? item.name ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeOperationalTicket = (source: unknown): OperationalTicketResult | null => {
  if (!isRecord(source)) return null;
  const location = isRecord(source.location) ? source.location : {};
  const map = isRecord(source.map) ? source.map : {};
  const contact = isRecord(source.contact) ? source.contact : {};
  const archivos = collectOperationalAttachments(source);
  const archivosRaw = readFirstValue(source, ['archivos', 'archivos_count', 'cantidad_archivos', 'attachments_count']);
  const archivosCount = Array.isArray(archivosRaw)
    ? archivosRaw.length
    : readNumber(source, ['archivos_count', 'cantidad_archivos', 'attachments_count']);
  const ticket: OperationalTicketResult = {
    nro_ticket: readString(source, ['nro_ticket', 'ticket_number', 'ticket_id', 'id']),
    ticket_id: readString(source, ['ticket_id', 'id']),
    chat_id: readString(source, ['chat_id', 'case_id', 'nro_caso']),
    status: readString(source, ['status', 'estado']),
    ticket_type: readString(source, ['ticket_type', 'kind', 'type', 'alias']),
    categoria: readString(source, ['categoria', 'category']),
    direccion: readString(source, ['direccion', 'address']) ?? readString(location, ['direccion', 'address']),
    latitud:
      readNumber(source, ['latitud', 'lat', 'latitude']) ??
      readNumber(location, ['latitud', 'lat', 'latitude']) ??
      readNumber(map, ['latitud', 'lat', 'latitude']),
    longitud:
      readNumber(source, ['longitud', 'lng', 'lon', 'longitude']) ??
      readNumber(location, ['longitud', 'lng', 'lon', 'longitude']) ??
      readNumber(map, ['longitud', 'lng', 'lon', 'longitude']),
    nombre_vecino:
      readString(source, ['nombre_vecino', 'vecino_nombre', 'nombre_cliente', 'customer_name']) ??
      readString(contact, ['nombre_vecino', 'nombre', 'name', 'display_name']),
    telefono_vecino:
      readString(source, ['telefono_vecino', 'telefono', 'phone', 'telefono_cliente']) ??
      readString(contact, ['telefono_vecino', 'telefono', 'phone']),
    canal_ingreso: readString(source, ['canal_ingreso', 'channel', 'canal']),
    foto_url_directa: readString(source, ['foto_url_directa', 'foto_url', 'image_url', 'photo_url']),
    archivos_count: archivosCount ?? (archivos.length ? archivos.length : null),
    archivos,
    detail_endpoint: readString(source, ['detail_endpoint', 'detail_url', 'endpoint']),
    raw: source,
  };

  const hasRealSignal = Boolean(
    ticket.nro_ticket ||
    ticket.ticket_id ||
    ticket.categoria ||
    ticket.direccion ||
    (ticket.latitud !== null && ticket.longitud !== null) ||
    ticket.foto_url_directa ||
    ticket.archivos?.length ||
    ticket.archivos_count,
  );
  return hasRealSignal ? ticket : null;
};

const normalizeOperationalOrderDetail = (value: unknown): OperationalOrderDetail | null => {
  if (!isRecord(value)) return null;
  const detail: OperationalOrderDetail = {
    nombre_producto: readString(value, ['nombre_producto', 'producto', 'nombre', 'name', 'title']),
    cantidad: readNumber(value, ['cantidad', 'quantity']),
    precio_unitario_original: readNumber(value, ['precio_unitario_original', 'precio_unitario', 'unit_price', 'price']),
    subtotal_con_descuento: readNumber(value, ['subtotal_con_descuento', 'subtotal', 'total']),
    moneda: readString(value, ['moneda', 'currency']),
    presentacion: readString(value, ['presentacion', 'presentation']),
    sku: readString(value, ['sku', 'codigo']),
    raw: value,
  };
  return detail.nombre_producto || detail.cantidad !== null || detail.subtotal_con_descuento !== null ? detail : null;
};

const normalizeOperationalOrder = (source: unknown): OperationalOrderResult | null => {
  if (!isRecord(source)) return null;
  const customer = isRecord(source.customer) ? source.customer : {};
  const detalles = Array.isArray(source.detalles)
    ? source.detalles.map(normalizeOperationalOrderDetail).filter((item): item is OperationalOrderDetail => Boolean(item))
    : [];
  const nroPedido = readString(source, ['nro_pedido', 'order_number', 'pedido_id', 'order_id', 'id']);
  const order: OperationalOrderResult = {
    nro_pedido: nroPedido,
    nombre_cliente:
      readString(source, ['nombre_cliente', 'customer_name', 'name']) ??
      readString(customer, ['nombre_cliente', 'name', 'nombre']),
    telefono_cliente:
      readString(source, ['telefono_cliente', 'customer_phone', 'telefono', 'phone']) ??
      readString(customer, ['telefono_cliente', 'telefono', 'phone']),
    monto_total: readNumber(source, ['monto_total', 'total', 'total_amount', 'amount']),
    detalles,
    tracking_url: readString(source, ['tracking_url', 'trackingUrl', 'tracking_endpoint']) ?? (nroPedido ? `/tracking/order/${encodeURIComponent(nroPedido)}` : null),
    raw: source,
  };

  const hasRealSignal = Boolean(order.nro_pedido || order.monto_total !== null || order.detalles?.length);
  return hasRealSignal ? order : null;
};

const extractOperationalTicket = (source: Record<string, unknown>): OperationalTicketResult | null => {
  const candidates = [
    source.ticket,
    source.created_entity,
    source.reclamo,
    source.claim,
    source.case,
    readNestedRecord(source, ['data']),
    readNestedRecord(source, ['data'])?.school_case,
    readNestedRecord(source, ['data'])?.created_entity,
    readNestedRecord(source, ['lead'])?.ticket,
    readNestedRecord(source, ['lead'])?.reclamo,
    readNestedRecord(source, ['data'])?.ticket,
    readNestedRecord(source, ['data'])?.reclamo,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeOperationalTicket(candidate);
    if (normalized) return normalized;
  }
  return normalizeOperationalTicket(source);
};

const extractOperationalOrder = (source: Record<string, unknown>): OperationalOrderResult | null => {
  const candidates = [
    source.order,
    source.created_entity,
    source.pedido,
    source.market_order,
    readNestedRecord(source, ['lead'])?.order,
    readNestedRecord(source, ['lead'])?.pedido,
    readNestedRecord(source, ['data'])?.order,
    readNestedRecord(source, ['data'])?.pedido,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeOperationalOrder(candidate);
    if (normalized) return normalized;
  }
  return normalizeOperationalOrder(source);
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const normalizeMediaUnderstanding = (source: unknown): OperationalMediaUnderstanding | null => {
  if (!isRecord(source)) return null;
  const supports = normalizeStringArray(source.supports);
  const received = normalizeStringArray(source.received);
  if (!supports.length && !received.length) return null;
  return {
    supports,
    received,
    raw: source,
  };
};

const extractMediaUnderstanding = (source: Record<string, unknown>): OperationalMediaUnderstanding | null =>
  normalizeMediaUnderstanding(source.media_understanding) ??
  normalizeMediaUnderstanding(readNestedRecord(source, ['data'])?.media_understanding) ??
  normalizeMediaUnderstanding(readNestedRecord(source, ['lead'])?.media_understanding);

const appendQuery = (endpoint: string, query?: Record<string, unknown>) => {
  if (!query || !Object.keys(query).length) return endpoint;
  const [pathWithSearch, hash = ''] = endpoint.split('#');
  const [path, rawSearch = ''] = pathWithSearch.split('?');
  const params = new URLSearchParams(rawSearch);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => (item === undefined || item === null ? '' : String(item)))
        .filter(Boolean);
      if (normalized.length) params.set(key, normalized.join(','));
      return;
    }
    params.set(key, String(value));
  });

  const search = params.toString();
  return `${path}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
};

const normalizeHeaders = (headers?: Record<string, string>) => {
  if (!headers) return undefined;
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .map(([key, value]) => [key, value.trim()]),
  );
};

const readBootstrapString = (
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const readShortChatSessionId = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  return trimmed.length <= 64 && !trimmed.includes('.') ? trimmed : null;
};

const readBootstrapSession = (bootstrap: ChatBootstrapConfig): Record<string, unknown> | undefined =>
  isRecord(bootstrap.session) ? bootstrap.session : undefined;

const getBootstrapSessionValues = (bootstrap: ChatBootstrapConfig) => {
  const headers = normalizeHeaders(bootstrap.headers) ?? {};
  const session = readBootstrapSession(bootstrap);
  const demoSessionId =
    readBootstrapString(session, ['demo_session_id', 'demoSessionId'])
    ?? readBootstrapString(bootstrap.payload, ['demo_session_id', 'demoSessionId', 'session'])
    ?? readBootstrapString(bootstrap.query, ['demo_session_id', 'demoSessionId', 'session'])
    ?? readBootstrapString(headers, ['X-Demo-Session-Id', 'X-Demo-Session']);
  const chatSessionId =
    readShortChatSessionId(session?.chat_session_id)
    ?? readShortChatSessionId(session?.session_id)
    ?? readShortChatSessionId(headers['X-Chat-Session-Id'])
    ?? readShortChatSessionId(bootstrap.payload?.chat_session_id)
    ?? readShortChatSessionId(bootstrap.payload?.session_id)
    ?? readShortChatSessionId(bootstrap.query?.chat_session_id)
    ?? readShortChatSessionId(bootstrap.query?.session_id);
  const tenantSlug =
    readBootstrapString(session, ['tenant_slug', 'tenant', 'slug'])
    ?? readBootstrapString(bootstrap.payload, ['tenant_slug', 'tenant', 'slug'])
    ?? readBootstrapString(bootstrap.query, ['tenant_slug', 'tenant', 'slug'])
    ?? readBootstrapString(headers, ['X-Tenant-Slug']);
  const anonId =
    readBootstrapString(bootstrap.payload, ['anon_id', 'anonId'])
    ?? readBootstrapString(bootstrap.query, ['anon_id', 'anonId'])
    ?? readBootstrapString(headers, ['X-Anon-Id', 'X-Anonymous-Id']);

  return {
    chatSessionId,
    demoSessionId,
    tenantSlug,
    anonId,
  };
};

const normalizeBootstrapHeaders = (bootstrap: ChatBootstrapConfig) => {
  const headers = normalizeHeaders(bootstrap.headers) ?? {};
  if (headers['X-Chat-Session-Id'] && !readShortChatSessionId(headers['X-Chat-Session-Id'])) {
    delete headers['X-Chat-Session-Id'];
  }
  const { chatSessionId, demoSessionId, tenantSlug, anonId } = getBootstrapSessionValues(bootstrap);

  if (demoSessionId) {
    headers['X-Demo-Session-Id'] ||= demoSessionId;
    headers['X-Demo-Session'] ||= demoSessionId;
  }
  if (chatSessionId) {
    headers['X-Chat-Session-Id'] ||= chatSessionId;
  }
  if (tenantSlug) {
    headers['X-Tenant-Slug'] ||= tenantSlug;
  }
  const resolvedAnonId = anonId || getOrCreateAnonId();
  if (resolvedAnonId) {
    headers['X-Anon-Id'] ||= resolvedAnonId;
  }

  return Object.keys(headers).length ? headers : undefined;
};

const sanitizeBootstrapQuery = (bootstrap: ChatBootstrapConfig) => {
  const query = isRecord(bootstrap.query) ? { ...bootstrap.query } : {};
  delete query.chat_session_id;
  delete query.session_id;
  delete query.demo_session_id;
  delete query.demoSessionId;
  delete query.session;

  const { tenantSlug } = getBootstrapSessionValues(bootstrap);
  if (tenantSlug) {
    if (!query.tenant_slug) query.tenant_slug = tenantSlug;
    if (!query.tenant) query.tenant = tenantSlug;
  }

  return Object.keys(query).length ? query : undefined;
};

const isBackendRootChatEndpoint = (endpoint: string) => {
  const normalized = endpoint.trim();
  if (!normalized || /^https?:\/\//i.test(normalized)) return false;
  const path = normalized.replace(/^\/+/, '').toLowerCase();
  return path === 'ask' || path.startsWith('ask/');
};

const resolveSameOriginChatBase = (endpoint: string) => {
  if (!isBackendRootChatEndpoint(endpoint)) return undefined;
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;
  return window.location.origin;
};

type ChatBootstrapHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const resolveBootstrapMethod = (method?: string | null): ChatBootstrapHttpMethod => {
  const normalized = method?.trim().toUpperCase();
  if (normalized === 'GET' || normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH' || normalized === 'DELETE') {
    return normalized;
  }
  return 'POST';
};

const buildJsonPayload = (bootstrap: ChatBootstrapConfig, payload: ChatBootstrapMessagePayload) => {
  const basePayload = isRecord(bootstrap.payload) ? { ...bootstrap.payload } : {};
  if ('chat_session_id' in basePayload && !readShortChatSessionId(basePayload.chat_session_id)) {
    delete basePayload.chat_session_id;
  }
  if ('session_id' in basePayload && !readShortChatSessionId(basePayload.session_id)) {
    delete basePayload.session_id;
  }
  const { chatSessionId, demoSessionId, tenantSlug } = getBootstrapSessionValues(bootstrap);
  if (demoSessionId && !basePayload.demo_session_id) basePayload.demo_session_id = demoSessionId;
  if (chatSessionId && !basePayload.chat_session_id) basePayload.chat_session_id = chatSessionId;
  if (tenantSlug) {
    if (!basePayload.tenant_slug) basePayload.tenant_slug = tenantSlug;
    if (!basePayload.tenant) basePayload.tenant = tenantSlug;
  } else if (typeof basePayload.tenant_slug === 'string' && !basePayload.tenant) {
    basePayload.tenant = basePayload.tenant_slug;
  } else if (typeof basePayload.tenant === 'string' && !basePayload.tenant_slug) {
    basePayload.tenant_slug = basePayload.tenant;
  }
  const text = payload.text?.trim() ?? '';
  basePayload.pregunta = text;

  if (payload.intent) basePayload.intent = payload.intent;
  if (payload.action_id) basePayload.action_id = payload.action_id;
  if (payload.payload) basePayload.payload = payload.payload;
  if (payload.attachmentInfo) basePayload.attachmentInfo = payload.attachmentInfo;
  if (payload.location) {
    const location = {
      ...payload.location,
      lng: payload.location.lng ?? payload.location.lon,
    };
    if ('lon' in location) delete location.lon;
    basePayload.location = location;
  }
  if (payload.extraPayload) {
    const protectedBackendKeys = new Set(['tipo_chat', 'tenant_slug', 'tenant', 'rubro', 'rubro_clave', 'demo_session_id', 'demo_mode']);
    Object.entries(payload.extraPayload).forEach(([key, value]) => {
      if (protectedBackendKeys.has(key)) return;
      if (value !== undefined) basePayload[key] = value;
    });
  }

  return basePayload;
};

const buildAudioPayload = (bootstrap: ChatBootstrapConfig, payload: ChatBootstrapMessagePayload) => {
  const formData = new FormData();
  const field = payload.audioField?.trim() || 'audio_file';
  if (payload.audioBlob) {
    formData.append(field, payload.audioBlob, payload.audioFilename || `audio-${Date.now()}.webm`);
  }

  const basePayload = buildJsonPayload(bootstrap, payload);
  Object.entries(basePayload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      formData.append(key, value);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      formData.append(key, String(value));
      return;
    }
    formData.append(key, JSON.stringify(value));
  });

  return formData;
};

export const extractChatBootstrapReplyText = (response: unknown): string | null => {
  if (typeof response === 'string' && response.trim()) return response.trim();
  if (!isRecord(response)) return null;

  const directKeys = [
    'respuesta_usuario',
    'respuesta',
    'response',
    'answer',
    'message',
    'text',
    'content',
    'reply',
    'mensaje',
  ];
  for (const key of directKeys) {
    const value = response[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  for (const key of ['data', 'message', 'bot_message', 'assistant']) {
    const nested = response[key];
    if (isRecord(nested)) {
      const nestedText = extractChatBootstrapReplyText(nested);
      if (nestedText) return nestedText;
    }
  }

  return null;
};

const normalizeChatBootstrapResponse = (response: unknown) => {
  const replyText = extractChatBootstrapReplyText(response);
  if (replyText && isRecord(response) && typeof response.respuesta_usuario !== 'string') {
    return {
      ...response,
      respuesta_usuario: replyText,
    };
  }
  return response;
};

const normalizeLeadNextAction = (value: unknown): LeadCaptureNextAction | null => {
  if (!isRecord(value)) return null;
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  const method = typeof value.method === 'string' ? value.method.trim() : '';
  const uiHint = typeof value.ui_hint === 'string' ? value.ui_hint.trim() : '';
  const payload = isRecord(value.payload) ? value.payload : null;
  if (!label && !id && !endpoint) return null;
  return {
    id: id || null,
    label: label || id || endpoint || null,
    endpoint: endpoint || null,
    method: method || null,
    payload,
    ui_hint: uiHint || null,
  };
};

export const normalizeLeadCaptureResponse = (response: unknown): LeadCaptureResponse => {
  const source = isRecord(response) ? response : {};
  const lead = isRecord(source.lead) ? source.lead : {};
  const tenant = isRecord(source.tenant)
    ? {
        slug: typeof source.tenant.slug === 'string' ? source.tenant.slug : null,
        tipo: typeof source.tenant.tipo === 'string' ? source.tenant.tipo : null,
      }
    : null;
  const nextActions = Array.isArray(source.next_actions)
    ? source.next_actions
        .map(normalizeLeadNextAction)
        .filter((item): item is LeadCaptureNextAction => Boolean(item))
    : Array.isArray(lead.next_actions)
      ? lead.next_actions
          .map(normalizeLeadNextAction)
          .filter((item): item is LeadCaptureNextAction => Boolean(item))
    : [];
  const ticket = extractOperationalTicket(source);
  const order = extractOperationalOrder(source);
  const mediaUnderstanding = extractMediaUnderstanding(source);

  return {
    ok: typeof source.ok === 'boolean' ? source.ok : undefined,
    contract_version: typeof source.contract_version === 'string' ? source.contract_version : null,
    request_id: typeof source.request_id === 'string' ? source.request_id : null,
    tenant,
    lead_id:
      typeof source.lead_id === 'string' || typeof source.lead_id === 'number'
        ? source.lead_id
        : typeof lead.lead_id === 'string' || typeof lead.lead_id === 'number'
          ? lead.lead_id
          : typeof lead.id === 'string' || typeof lead.id === 'number'
            ? lead.id
            : null,
    ticket_id:
      typeof source.ticket_id === 'string' || typeof source.ticket_id === 'number'
        ? source.ticket_id
        : typeof readNestedRecord(source, ['data'])?.ticket_id === 'string' ||
            typeof readNestedRecord(source, ['data'])?.ticket_id === 'number'
          ? (readNestedRecord(source, ['data'])?.ticket_id as string | number)
        : typeof lead.ticket_id === 'string' || typeof lead.ticket_id === 'number'
          ? lead.ticket_id
          : typeof lead.case_id === 'string' || typeof lead.case_id === 'number'
            ? lead.case_id
            : null,
    ticket_type:
      typeof source.ticket_type === 'string'
        ? source.ticket_type
        : typeof readNestedRecord(source, ['data'])?.ticket_type === 'string'
          ? (readNestedRecord(source, ['data'])?.ticket_type as string)
          : null,
    status:
      typeof source.status === 'string'
        ? source.status
        : typeof readNestedRecord(source, ['data'])?.status === 'string'
          ? (readNestedRecord(source, ['data'])?.status as string)
          : typeof lead.status === 'string'
            ? lead.status
            : null,
    deduplicated: source.deduplicated === true,
    idempotency_key: typeof source.idempotency_key === 'string' ? source.idempotency_key : null,
    message_body: typeof source.message_body === 'string' ? source.message_body : null,
    next_actions: nextActions,
    ticket,
    order,
    media_understanding: mediaUnderstanding,
    raw: response,
  };
};

export const sendConversationFeedback = async (
  conversationId: string,
  rating: ChatRatingValue,
  comment?: string,
): Promise<'sent' | 'noop'> => {
  if (!conversationId) return 'noop';

  try {
    await panelApi.post(`/api/v2/chat/conversations/${encodeURIComponent(conversationId)}/feedback`, {
      rating,
      comment: comment?.trim() || undefined,
    });
    return 'sent';
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 501].includes(error.status)) {
      return 'noop';
    }
    throw error;
  }
};

export const submitLeadCapture = async (
  config: ChatLeadCaptureConfig,
  payload: Record<string, unknown>,
  tenantSlug?: string | null,
  options: LeadCaptureSubmitOptions = {},
): Promise<LeadCaptureResponse> => {
  const endpoint = config.endpoint?.trim() || '/api/public/lead-capture';
  const idempotencyKey = options.idempotencyKey?.trim();
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: payload,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    skipAuth: true,
    isWidgetRequest: true,
    tenantSlug,
    persistTenantSlug: options.persistTenantSlug,
    suppressPanel401Redirect: true,
    sendAnonId: true,
  });
  return normalizeLeadCaptureResponse(response);
};

export const sendChatBootstrapMessage = async (
  bootstrap: ChatBootstrapConfig,
  payload: ChatBootstrapMessagePayload,
  tenantSlug?: string | null,
): Promise<any> => {
  const endpoint =
    payload.audioBlob && payload.audioEndpoint?.trim()
      ? payload.audioEndpoint.trim()
      : bootstrap.same_origin_endpoint?.trim() || bootstrap.endpoint?.trim();

  if (!endpoint) {
    throw new ApiError('El contrato de chat demo no incluye endpoint.', 400);
  }

  const requestEndpoint = async (target: string) =>
    apiFetch<unknown>(appendQuery(target, sanitizeBootstrapQuery(bootstrap)), {
      method: resolveBootstrapMethod(bootstrap.method),
      body: payload.audioBlob ? buildAudioPayload(bootstrap, payload) : buildJsonPayload(bootstrap, payload),
      headers: (() => {
        const headers = normalizeBootstrapHeaders(bootstrap);
        if (payload.audioBlob && headers) {
          delete headers['Content-Type'];
          delete headers['content-type'];
        }
        return headers;
      })(),
      skipAuth: true,
      isWidgetRequest: true,
      tenantSlug: null,
      omitTenant: true,
      omitChatSessionId: true,
      suppressPanel401Redirect: true,
      baseUrlOverride: resolveSameOriginChatBase(target),
    });

  return normalizeChatBootstrapResponse(await requestEndpoint(endpoint));
};
