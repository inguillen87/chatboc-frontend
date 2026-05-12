import { panelApi } from '@/api/v2/client';
import { ApiError, apiFetch } from '@/utils/api';
import { createLeadCaptureIdempotencyKey } from '@/utils/leadCapture';
import type { ChatBootstrapConfig, ChatRatingValue } from './chatTypes';
import type { ChatLeadCaptureConfig } from '@/types/chat';

export { createLeadCaptureIdempotencyKey };

export interface ChatBootstrapMessagePayload {
  text?: string;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
  attachmentInfo?: unknown;
  location?: { lat: number; lon: number; accuracy?: number | null };
  audioBlob?: Blob;
  audioFilename?: string;
  audioField?: string;
  audioEndpoint?: string;
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
  raw?: unknown;
}

interface LeadCaptureSubmitOptions {
  idempotencyKey?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const shouldFallbackEndpoint = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

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

const normalizeBootstrapHeaders = (bootstrap: ChatBootstrapConfig) => {
  const headers = normalizeHeaders(bootstrap.headers) ?? {};
  const demoSessionId = readBootstrapString(bootstrap.payload, [
    'demo_session_id',
    'session',
  ]) ?? readBootstrapString(bootstrap.query, ['demo_session_id', 'session']);
  const tenantSlug = readBootstrapString(bootstrap.payload, [
    'tenant_slug',
    'tenant',
    'slug',
  ]) ?? readBootstrapString(bootstrap.query, ['tenant_slug', 'tenant', 'slug']);

  if (demoSessionId) {
    headers['X-Demo-Session-Id'] ||= demoSessionId;
    headers['X-Demo-Session'] ||= demoSessionId;
    headers['X-Chat-Session-Id'] ||= demoSessionId;
  }
  if (tenantSlug) {
    headers['X-Tenant-Slug'] ||= tenantSlug;
  }

  return Object.keys(headers).length ? headers : undefined;
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
  const text = payload.text?.trim() ?? '';
  basePayload.pregunta = text;

  if (payload.intent) basePayload.intent = payload.intent;
  if (payload.payload) basePayload.payload = payload.payload;
  if (payload.attachmentInfo) basePayload.attachmentInfo = payload.attachmentInfo;
  if (payload.location) basePayload.location = payload.location;
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

const normalizeLeadCaptureResponse = (response: unknown): LeadCaptureResponse => {
  const source = isRecord(response) ? response : {};
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
    : [];

  return {
    ok: typeof source.ok === 'boolean' ? source.ok : undefined,
    contract_version: typeof source.contract_version === 'string' ? source.contract_version : null,
    request_id: typeof source.request_id === 'string' ? source.request_id : null,
    tenant,
    lead_id:
      typeof source.lead_id === 'string' || typeof source.lead_id === 'number'
        ? source.lead_id
        : null,
    ticket_id:
      typeof source.ticket_id === 'string' || typeof source.ticket_id === 'number'
        ? source.ticket_id
        : null,
    ticket_type: typeof source.ticket_type === 'string' ? source.ticket_type : null,
    status: typeof source.status === 'string' ? source.status : null,
    deduplicated: source.deduplicated === true,
    idempotency_key: typeof source.idempotency_key === 'string' ? source.idempotency_key : null,
    message_body: typeof source.message_body === 'string' ? source.message_body : null,
    next_actions: nextActions,
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
      : bootstrap.endpoint?.trim();
  const fallbackEndpoint = bootstrap.fallback_endpoint?.trim();

  if (!endpoint && !fallbackEndpoint) {
    throw new ApiError('El contrato de chat demo no incluye endpoint.', 400);
  }

  const requestEndpoint = async (target: string) =>
    apiFetch<unknown>(appendQuery(target, bootstrap.query), {
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

  try {
    return normalizeChatBootstrapResponse(await requestEndpoint(endpoint || fallbackEndpoint || '/ask'));
  } catch (error) {
    if (!fallbackEndpoint || !shouldFallbackEndpoint(error)) throw error;
    return normalizeChatBootstrapResponse(await requestEndpoint(fallbackEndpoint));
  }
};
