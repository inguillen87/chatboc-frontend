import { panelApi } from '@/api/v2/client';
import { ApiError, apiFetch } from '@/utils/api';
import type { ChatBootstrapConfig, ChatRatingValue } from './chatTypes';
import type { ChatLeadCaptureConfig } from '@/types/chat';

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
    Object.entries(payload.extraPayload).forEach(([key, value]) => {
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
) => {
  const endpoint = config.endpoint?.trim() || '/api/public/lead-capture';
  return apiFetch(endpoint, {
    method: 'POST',
    body: payload,
    skipAuth: true,
    isWidgetRequest: true,
    tenantSlug,
    suppressPanel401Redirect: true,
  });
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
        const headers = normalizeHeaders(bootstrap.headers);
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
    });

  try {
    return normalizeChatBootstrapResponse(await requestEndpoint(endpoint || fallbackEndpoint || '/ask'));
  } catch (error) {
    if (!fallbackEndpoint || !shouldFallbackEndpoint(error)) throw error;
    return normalizeChatBootstrapResponse(await requestEndpoint(fallbackEndpoint));
  }
};
