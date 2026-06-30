import { ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK, PUBLIC_SURVEY_BASE_URL } from '@/config';
import { ApiError, apiFetch } from '@/utils/api';
import {
  PreguntaTipo,
  PublicResponsePayload,
  SurveyAdmin,
  SurveyAnalyticsFilters,
  SurveyComment,
  SurveyDraftPayload,
  SurveyAnalyticsHeatmap,
  SurveyHeatmapPoint,
  SurveyListResponse,
  SurveyLivePublicResultsPayload,
  SurveyPublic,
  SurveyResponseFilters,
  SurveyResponseList,
  SurveySnapshot,
  SurveySummary,
  SurveyTimeseriesPoint,
  SurveyForecast,
  SurveyAlert,
  SurveyBrief,
  SurveySegmentsCompare,
  SurveySegmentsSuggestions,
  SurveyAnomalies,
  SurveyDashboardBundle,
} from '@/types/encuestas';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

type PrimitiveParam = string | number | boolean | undefined | null;
type QueryParamValue = PrimitiveParam | PrimitiveParam[] | readonly PrimitiveParam[];
type QueryParams = object;

const PUBLIC_SURVEY_API_BASE =
  typeof PUBLIC_SURVEY_BASE_URL === 'string' && PUBLIC_SURVEY_BASE_URL.trim()
    ? PUBLIC_SURVEY_BASE_URL.trim().replace(/\/$/, '')
    : undefined;

const PUBLIC_CHAT_CONTEXT_STORAGE_KEY = 'chatboc_public_chat_context';
const PUBLIC_RESPONSE_CONTRACTS = new Set([
  'surveys.public_response.v2',
  'encuestas.public_response.v1',
  'demo.survey_response_ack.v1',
]);

const buildQueryString = (params?: QueryParams) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params as Record<string, QueryParamValue>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    const appendValue = (input: PrimitiveParam) => {
      if (input === undefined || input === null || input === '') return;
      if (typeof input === 'number' && !Number.isFinite(input)) return;
      if (typeof input === 'boolean') {
        search.set(key, input ? '1' : '0');
        return;
      }
      search.set(key, String(input));
    };

    if (Array.isArray(value)) {
      const normalized = (value as readonly PrimitiveParam[])
        .map((item) => {
          if (item === undefined || item === null || item === '') return null;
          if (typeof item === 'number') {
            return Number.isFinite(item) ? String(item) : null;
          }
          if (typeof item === 'boolean') {
            return item ? '1' : '0';
          }
          return String(item);
        })
        .filter((item): item is string => item !== null);

      if (normalized.length) {
        search.set(key, normalized.join(','));
      }
      return;
    }

    appendValue(value as PrimitiveParam);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const withTenantSlugParam = (path: string, tenantSlug?: string) => {
  const normalizedTenant = tenantSlug?.trim();
  if (!normalizedTenant) return path;
  const query = buildQueryString({ tenant_slug: normalizedTenant });
  if (!query) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${query.slice(1)}`;
};

type ApiFetchOptions = Parameters<typeof apiFetch>[1];


const isDevEnvironment = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  return Boolean(metaEnv?.DEV || metaEnv?.MODE === 'development');
};

const ADMIN_SURVEY_BASE_PATHS = [
  '/api/admin/encuestas',
  '/admin/encuestas',
  '/municipal/encuestas',
  '/admin/surveys',
  '/municipal/surveys/admin',
] as const;

const joinAdminPath = (base: string, suffix?: string) => {
  if (!suffix) return base;
  if (suffix.startsWith('?')) {
    return `${base}${suffix}`;
  }
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedSuffix = suffix.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedSuffix}`;
};

const shouldRetryAdminRequest = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return true;
    }

    // Retry 403/404 because we might be hitting a tenant-scoped endpoint
    // that the current token isn't authorized for in that specific way,
    // but a generic admin endpoint might work with X-Tenant.
    if (error.status === 404 || error.status === 405) {
      return true;
    }

    if (error.status === 401 || error.status === 403) {
      return false;
    }

    if (error.status >= 500) {
      return true;
    }

    if (error.status === 200 && error.message.toLowerCase().includes('respuesta inesperada')) {
      return true;
    }

    return false;
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    return normalized.includes('conexión') || normalized.includes('cors');
  }

  return false;
};

async function callAdminSurveyEndpoint<T>(pathSuffix = '', options?: ApiFetchOptions): Promise<T> {
  let lastError: unknown = null;

  for (const basePath of ADMIN_SURVEY_BASE_PATHS) {
    try {
      const targetPath = joinAdminPath(basePath, pathSuffix);
      const result = await apiFetch<T>(targetPath, options ?? {});

      if (basePath !== ADMIN_SURVEY_BASE_PATHS[0] && isDevEnvironment()) {
        console.warn(
          '[encuestas] Falling back to alternate admin endpoint',
          { preferred: ADMIN_SURVEY_BASE_PATHS[0], used: basePath },
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      if (!shouldRetryAdminRequest(error)) {
        break;
      }
    }
  }

  throw lastError ?? new Error('No fue posible contactar al módulo de encuestas.');
}

const serializeUnknown = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('[encuestas] No se pudo serializar la respuesta inesperada', error);
    return '';
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const unwrapSurveyEnvelope = <T>(payload: unknown): T => {
  if (!isRecord(payload)) {
    return payload as T;
  }

  const nestedSurvey = payload.encuesta;
  if (isRecord(nestedSurvey)) {
    return {
      ...payload,
      ...nestedSurvey,
    } as T;
  }

  return payload as T;
};

const normalizePreguntaTipo = (value: unknown): PreguntaTipo => {
  if (typeof value !== 'string') {
    return 'opcion_unica';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z_]/g, '');

  switch (normalized) {
    case 'opcion_unica':
    case 'opcion_simple':
    case 'opcion':
    case 'single':
    case 'single_choice':
    case 'radio':
      return 'opcion_unica';
    case 'multiple':
    case 'seleccion_multiple':
    case 'seleccionmultiple':
    case 'multiple_choice':
    case 'multiplechoice':
    case 'checkbox':
    case 'checkboxes':
      return 'multiple';
    case 'abierta':
    case 'respuesta_abierta':
    case 'texto':
    case 'text':
    case 'open':
    case 'open_text':
    case 'open_texto':
      return 'abierta';
    case 'rating':
    case 'rating_emoji':
    case 'emoji':
    case 'estrellas':
    case 'stars':
      return 'rating_emoji';
    default:
      return 'opcion_unica';
  }
};

const normalizeSurveyPreguntas = <T extends { preguntas?: Array<{ tipo?: unknown }> }>(survey: T): T => {
  if (!survey || !Array.isArray(survey.preguntas)) {
    return survey;
  }

  return {
    ...survey,
    preguntas: survey.preguntas.map((pregunta) => {
      if (!pregunta || typeof pregunta !== 'object') {
        return pregunta;
      }

      return {
        ...pregunta,
        tipo: normalizePreguntaTipo((pregunta as { tipo?: unknown }).tipo),
      };
    }) as T['preguntas'],
  };
};

export type PublicSurveyListResult = SurveyPublic[] & {
  __badPayload?: true;
  __raw?: string;
  __status?: number;
  __fallbackNotice?: string;
};

const asFlaggedEmptyList = (
  payload: { raw?: string; status?: number; fallbackNotice?: string },
): PublicSurveyListResult =>
  Object.assign([], {
    __badPayload: true as const,
    __raw: payload.raw,
    __status: payload.status,
    __fallbackNotice: payload.fallbackNotice,
  });

const hasPanelToken = () => {
  try {
    const token = safeLocalStorage.getItem('authToken');
    return Boolean(token && token.trim());
  } catch (error) {
    console.warn('[encuestas] No se pudo acceder al token del panel para el fallback público', error);
    return false;
  }
};

const sanitizeAdminSurveys = (items: SurveyAdmin[]): SurveyPublic[] =>
  items.map(({ estado: _estado, created_at: _createdAt, updated_at: _updatedAt, anonimato: _anonimato, unica_por_persona: _unica, ...rest }) => rest);

const attemptRecoveryFromAdminList = async (): Promise<PublicSurveyListResult | null> => {
  if (!hasPanelToken()) {
    return null;
  }

  try {
    const adminResponse = await callAdminSurveyEndpoint<SurveyListResponse>(buildQueryString({ estado: 'publicada' }));
    const published = Array.isArray(adminResponse?.data)
      ? adminResponse.data.filter((survey) => survey.estado === 'publicada')
      : [];

    if (!published.length) {
      return null;
    }

    const sanitized = sanitizeAdminSurveys(published);
    return Object.assign(sanitized, {
      __badPayload: true as const,
      __fallbackNotice:
        'Mostramos las encuestas publicadas recuperadas desde el panel porque el listado público devolvió un resultado vacío.',
    });
  } catch (error) {
    console.warn('[encuestas] No se pudo recuperar el listado público desde el panel como fallback', error);
    return null;
  }
};

export const getPublicSurvey = async (slug: string, tenantSlug?: string): Promise<SurveyPublic> => {
  const response = await callPublicSurveyEndpoint<unknown>(buildPublicSurveyPaths(
    withTenantSlugParam(`/api/v2/public/surveys/${slug}`, tenantSlug),
    withTenantSlugParam(`/api/public/encuestas/v1/${slug}`, tenantSlug),
  ), {
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
    omitTenant: true,
  });

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('El servidor devolvió un formato inesperado para la encuesta solicitada.');
  }

  if ((response as Record<string, unknown>).contract_version === 'encuestas.public.v1') {
    return normalizeSurveyPreguntas(unwrapSurveyEnvelope<SurveyPublic>(response));
  }

  if ((response as Record<string, unknown>).contract_version === 'public.survey_resolution.v1') {
    const record = response as Record<string, unknown>;
    const status =
      typeof record.status === 'number'
        ? record.status
        : typeof record.status_code === 'number'
          ? record.status_code
          : 404;
    const message =
      typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : typeof record.title === 'string' && record.title.trim()
          ? record.title.trim()
          : 'No encontramos esta encuesta.';
    throw new ApiError(message, status, record, typeof record.request_id === 'string' ? record.request_id : undefined);
  }

  return normalizeSurveyPreguntas(response as SurveyPublic);
};


const shouldRetryPublicSurveyRequest = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 405 || error.status >= 500;
  }
  return false;
};

const callPublicSurveyEndpoint = async <T>(paths: string[], options: ApiFetchOptions): Promise<T> => {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await apiFetch<T>(path, options);
    } catch (error) {
      lastError = error;
      if (!shouldRetryPublicSurveyRequest(error)) {
        break;
      }
    }
  }

  throw lastError ?? new Error('No fue posible consultar el endpoint público de encuestas.');
};

const buildPublicSurveyPaths = (...paths: string[]) => {
  if (paths.length === 0) return [];
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const contractPaths = unique.filter(
    (path) => path.startsWith('/api/v2/public/surveys') || path.startsWith('/api/public/encuestas/v1'),
  );
  if (contractPaths.length) return contractPaths;
  return unique.filter((path) => path.startsWith('/api/v2/public/') || path.startsWith('/api/public/'));
};

const FALLBACK_SURVEY_URL_REGEX = /https?:\/\/[\S]+\/e\/([a-z0-9-]+)/gi;

const extractSlugsFromRawPayload = (raw?: string | null): string[] => {
  if (!raw) return [];
  const slugs = new Set<string>();
  let match: RegExpExecArray | null = null;
  while ((match = FALLBACK_SURVEY_URL_REGEX.exec(raw)) !== null) {
    const [, slug] = match;
    if (slug) {
      slugs.add(slug.trim());
    }
  }
  return Array.from(slugs);
};

const attemptRecoveryFromRawPayload = async (
  raw: string,
  status?: number,
  tenantSlug?: string,
): Promise<PublicSurveyListResult | null> => {
  const slugs = extractSlugsFromRawPayload(raw);
  if (!slugs.length) {
    return null;
  }

  const recovered = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await getPublicSurvey(slug, tenantSlug);
      } catch (fetchError) {
        console.warn('[encuestas] No se pudo recuperar la encuesta pública a partir del enlace', {
          slug,
          error: fetchError,
        });
        return null;
      }
    }),
  );

  const surveys = recovered.filter((item): item is SurveyPublic => Boolean(item));
  if (!surveys.length) {
    return null;
  }

  return Object.assign(surveys, {
    __badPayload: true as const,
    __raw: raw,
    __status: status,
    __fallbackNotice:
      'Mostramos las encuestas detectadas desde los enlaces publicados porque la lista principal devolvió un formato inesperado.',
  });
};

export const listPublicSurveys = async (tenantSlug?: string): Promise<PublicSurveyListResult> => {
  try {
    const response = await callPublicSurveyEndpoint<unknown>(buildPublicSurveyPaths(
      withTenantSlugParam('/api/public/encuestas/v1', tenantSlug),
    ), {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
      tenantSlug,
      baseUrlOverride: PUBLIC_SURVEY_API_BASE,
      omitEntityToken: true,
      omitTenant: true,
    });

    if (Array.isArray(response)) {
      if (response.length > 0) {
        return response as SurveyPublic[];
      }

      if (ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK && !tenantSlug) {
        const recoveredFromAdmin = await attemptRecoveryFromAdminList();
        if (recoveredFromAdmin) {
          return recoveredFromAdmin;
        }
      }

      return response as SurveyPublic[];
    }

    const record =
      response && typeof response === 'object' && !Array.isArray(response)
        ? (response as Record<string, unknown>)
        : null;
    if (record) {
      const items = Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.encuestas)
          ? record.encuestas
          : Array.isArray(record.data)
            ? record.data
            : null;
      if (items) {
        return items as SurveyPublic[];
      }
    }

    const raw = serializeUnknown(response);
    if (ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK && raw) {
      const recovered = await attemptRecoveryFromRawPayload(raw, undefined, tenantSlug);
      if (recovered) {
        return recovered;
      }
    }

    return asFlaggedEmptyList({
      raw,
      fallbackNotice: ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK
        ? undefined
        : 'No pudimos cargar esta encuesta en este momento.',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const rawBody =
        typeof error.body?.raw === 'string'
          ? error.body.raw
          : typeof error.body === 'string'
            ? error.body
            : serializeUnknown(error.body);

      if (ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK && rawBody) {
        const recovered = await attemptRecoveryFromRawPayload(rawBody, error.status, tenantSlug);
        if (recovered) {
          return recovered;
        }
      }

      if (!ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK) {
        return asFlaggedEmptyList({
          raw: rawBody,
          status: error.status,
          fallbackNotice: 'No se pudo obtener el listado público de encuestas con contrato v1.',
        });
      }

      return asFlaggedEmptyList({
        raw: rawBody,
        status: error.status,
        fallbackNotice:
          'No se pudo obtener el listado público de encuestas desde el backend.',
      });
    }

    return asFlaggedEmptyList({
      fallbackNotice: 'No se pudo consultar el listado público de encuestas.',
    });
  }
};


export const getPublicSurveyLiveResults = (
  slug: string,
  tenantSlug?: string,
  params?: {
    include_heatmap?: 0 | 1;
    window_minutes?: number;
    max_points?: number;
    max_cells?: number;
    canal?: string;
    barrio?: string;
    ciudad?: string;
    provincia?: string;
  },
): Promise<SurveyLivePublicResultsPayload> =>
  callPublicSurveyEndpoint<SurveyLivePublicResultsPayload>(buildPublicSurveyPaths(
    `/api/v2/public/surveys/${slug}/live-results${buildQueryString({ ...(params ?? {}), tenant_slug: tenantSlug?.trim() })}`,
    `/api/public/encuestas/v1/${slug}/live-results${buildQueryString({ ...(params ?? {}), tenant_slug: tenantSlug?.trim() })}`,
  ), {
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
    omitTenant: true,
  });

type PublicSurveyResponseAck = {
  ok: boolean;
  id?: number;
  respuesta_id?: number | string;
  response_id?: number | string;
  contact_key?: string;
  conversation_id?: string;
  contract_version?: string;
  request_id?: string;
  live_results_url?: string;
  realtime?: Record<string, unknown>;
  [key: string]: unknown;
};

export const postPublicResponse = (
  slug: string,
  payload: PublicResponsePayload,
  tenantSlug?: string,
): Promise<PublicSurveyResponseAck> =>
  callPublicSurveyEndpoint<PublicSurveyResponseAck>(buildPublicSurveyPaths(
    withTenantSlugParam(`/api/v2/public/surveys/${slug}/respond`, tenantSlug),
    withTenantSlugParam(`/api/public/encuestas/v1/${slug}/responder`, tenantSlug),
  ), {
    method: 'POST',
    body: payload,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
    omitTenant: true,
  }).then((response) => {
    const contractVersion =
      typeof (response as Record<string, unknown>)?.contract_version === 'string'
        ? String((response as Record<string, unknown>).contract_version)
        : undefined;
    if (!ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK && (!contractVersion || !PUBLIC_RESPONSE_CONTRACTS.has(contractVersion))) {
      throw new Error('No pudimos confirmar la respuesta de la encuesta en este momento.');
    }

    const contactKey = typeof response?.contact_key === 'string' ? response.contact_key.trim() : '';
    const conversationId =
      typeof response?.conversation_id === 'string' ? response.conversation_id.trim() : '';
    const rawNormalizedId = response?.id ?? response?.response_id ?? response?.respuesta_id;
    const numericId =
      typeof rawNormalizedId === 'number'
        ? rawNormalizedId
        : typeof rawNormalizedId === 'string' && rawNormalizedId.trim() && Number.isFinite(Number(rawNormalizedId))
          ? Number(rawNormalizedId)
          : undefined;
    const normalizedResponse = {
      ...response,
      ...(numericId !== undefined ? { id: numericId } : {}),
      ...(contractVersion ? { contract_version: contractVersion } : {}),
    };

    if (!contactKey && !conversationId) {
      return normalizedResponse;
    }

    try {
      const currentRaw = safeLocalStorage.getItem(PUBLIC_CHAT_CONTEXT_STORAGE_KEY);
      const currentContext = currentRaw ? JSON.parse(currentRaw) : null;
      const normalizedContext =
        currentContext && typeof currentContext === 'object'
          ? (currentContext as Record<string, unknown>)
          : {};

      safeLocalStorage.setItem(
        PUBLIC_CHAT_CONTEXT_STORAGE_KEY,
        JSON.stringify({
          ...normalizedContext,
          ...(contactKey ? { contact_key: contactKey } : {}),
          ...(conversationId ? { conversation_id: conversationId } : {}),
          ...(tenantSlug ? { tenantSlug } : {}),
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // no-op: identity persistence is best-effort
    }

    return normalizedResponse;
  });

export const getSurveyComments = (
  slug: string,
  tenantSlug?: string,
  limit = 50,
  offset = 0,
): Promise<SurveyComment[]> =>
  callPublicSurveyEndpoint<SurveyComment[]>(buildPublicSurveyPaths(
    `/api/public/encuestas/v1/${slug}/comentarios${buildQueryString({ limit, offset, tenant_slug: tenantSlug?.trim() })}`,
  ), {
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
    omitTenant: true,
  });

export const postSurveyComment = (
  slug: string,
  payload: {
    texto: string;
    nombre?: string;
    nombre_autor?: string;
    anon_id?: string;
    modo?: 'anonimo' | 'facebook' | 'google' | 'instagram' | 'social';
    auth_provider?: string;
    auth_user_id?: string;
    auth_email?: string;
    auth_first_name?: string;
    auth_last_name?: string;
  },
  tenantSlug?: string,
): Promise<SurveyComment> =>
  callPublicSurveyEndpoint<SurveyComment>(buildPublicSurveyPaths(
    withTenantSlugParam(`/api/public/encuestas/v1/${slug}/comentarios`, tenantSlug),
  ), {
    method: 'POST',
    body: payload,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
    omitTenant: true,
  });

const isSurveyListMeta = (value: unknown): SurveyListResponse['meta'] | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as SurveyListResponse['meta'];
  const knownKeys = ['total', 'draftCount', 'activeCount'] as const;
  if (knownKeys.some((key) => Object.prototype.hasOwnProperty.call(candidate, key))) {
    return candidate;
  }

  return undefined;
};

const SURVEY_ARRAY_KEYS = [
  'data',
  'results',
  'items',
  'records',
  'encuestas',
  'surveys',
  'docs',
  'rows',
] as const;

const looksLikeSurveyRecord = (value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.prototype.hasOwnProperty.call(candidate, 'titulo') ||
    Object.prototype.hasOwnProperty.call(candidate, 'slug') ||
    Object.prototype.hasOwnProperty.call(candidate, 'id')
  );
};

const extractSurveyArray = (
  payload: unknown,
  parentMeta?: SurveyListResponse['meta'],
  depth = 0,
  visited: Set<unknown> = new Set(),
): SurveyListResponse | null => {
  if (depth > 6 || payload === null || payload === undefined) {
    return null;
  }

  if (visited.has(payload)) {
    return null;
  }

  if (Array.isArray(payload)) {
    if (!payload.length || looksLikeSurveyRecord(payload[0])) {
      return { data: payload, meta: parentMeta };
    }
    return null;
  }

  if (typeof payload !== 'object') {
    return null;
  }

  visited.add(payload);

  const container = payload as Record<string, unknown>;
  const metaFromCurrent = isSurveyListMeta(container.meta) ?? parentMeta;

  for (const key of SURVEY_ARRAY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(container, key)) {
      const extracted = extractSurveyArray(container[key], metaFromCurrent, depth + 1, visited);
      if (extracted) {
        return {
          data: extracted.data,
          meta: extracted.meta ?? metaFromCurrent,
        };
      }
    }
  }

  for (const value of Object.values(container)) {
    const extracted = extractSurveyArray(value, metaFromCurrent, depth + 1, visited);
    if (extracted) {
      return extracted;
    }
  }

  return null;
};

const normalizeSurveyListResponse = (payload: unknown): SurveyListResponse => {
  const extracted = extractSurveyArray(payload);

  if (extracted) {
    return extracted;
  }

  console.warn('[encuestas] Respuesta inesperada para el listado de encuestas del panel', payload);
  return { data: [] };
};

export const adminListSurveys = async (
  params?: QueryParams,
  options?: ApiFetchOptions,
): Promise<SurveyListResponse> => {
  const rawResponse = await callAdminSurveyEndpoint<SurveyListResponse | SurveyAdmin[]>(
    buildQueryString(params),
    options,
  );
  const normalized = normalizeSurveyListResponse(rawResponse);
  if (!Array.isArray(normalized.data)) {
    return normalized;
  }

  return {
    ...normalized,
    data: normalized.data.map((survey) => normalizeSurveyPreguntas(survey)),
  };
};

export const adminCreateSurvey = async (
  payload: SurveyDraftPayload,
  options?: ApiFetchOptions,
): Promise<SurveyAdmin> => {
  const survey = await callAdminSurveyEndpoint<SurveyAdmin>('', {
    method: 'POST',
    body: payload,
    ...options,
  });
  return normalizeSurveyPreguntas(survey);
};

export const adminUpdateSurvey = async (
  id: number,
  payload: SurveyDraftPayload,
  options?: ApiFetchOptions,
): Promise<SurveyAdmin> => {
  const survey = await callAdminSurveyEndpoint<SurveyAdmin>(`${id}`, {
    method: 'PUT',
    body: payload,
    ...options,
  });
  return normalizeSurveyPreguntas(survey);
};

export const adminDuplicateSurvey = async (
  id: number,
  payload?: { titulo?: string; slug?: string },
  options?: ApiFetchOptions,
): Promise<SurveyAdmin> => {
  const survey = await callAdminSurveyEndpoint<unknown>(`${id}/duplicar`, {
    method: 'POST',
    body: payload ?? {},
    ...options,
  });
  return normalizeSurveyPreguntas(unwrapSurveyEnvelope<SurveyAdmin>(survey));
};

export const adminDeleteSurvey = (id: number, options?: ApiFetchOptions): Promise<void> =>
  callAdminSurveyEndpoint(`${id}`, {
    method: 'DELETE',
    ...options,
  });

export const adminGetSurvey = async (id: number, options?: ApiFetchOptions): Promise<SurveyAdmin> => {
  const survey = await callAdminSurveyEndpoint<SurveyAdmin>(`${id}`, options);
  return normalizeSurveyPreguntas(survey);
};

export const adminPublishSurvey = async (id: number, options?: ApiFetchOptions): Promise<SurveyAdmin> => {
  const survey = await callAdminSurveyEndpoint<unknown>(`${id}/publicar`, {
    method: 'POST',
    ...options,
  });
  return normalizeSurveyPreguntas(unwrapSurveyEnvelope<SurveyAdmin>(survey));
};

export const adminSeedSurvey = async (
  id: number,
  payload: { cantidad: number; reset?: boolean; geo_profile_key?: string; municipality_label?: string },
  options?: ApiFetchOptions,
): Promise<{ creadas: number; reset?: { respuestas?: number; comentarios?: number } }> => {
  return callAdminSurveyEndpoint<{ creadas: number }>(`${id}/seed-demo`, {
    method: 'POST',
    body: payload,
    ...options,
  });
};

export const getSummary = (id: number, filtros?: SurveyAnalyticsFilters): Promise<SurveySummary> =>
  callAdminSurveyEndpoint(`${id}/analytics/resumen${buildQueryString(filtros)}`);

export const getTimeseries = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<SurveyTimeseriesPoint[]> =>
  callAdminSurveyEndpoint(`${id}/analytics/series${buildQueryString(filtros)}`);

export const getHeatmap = async (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<SurveyAnalyticsHeatmap> => {
  const payload = await callAdminSurveyEndpoint<unknown>(`${id}/analytics/heatmap${buildQueryString(filtros)}`);

  if (Array.isArray(payload)) {
    return { points: payload as SurveyHeatmapPoint[] };
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const points = Array.isArray(record.points)
      ? (record.points as SurveyHeatmapPoint[])
      : Array.isArray(record.data)
        ? (record.data as SurveyHeatmapPoint[])
        : [];

    return {
      points,
      cells: Array.isArray(record.cells) ? (record.cells as Array<Record<string, unknown>>) : undefined,
      metadata: record.metadata && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : undefined,
    };
  }

  return { points: [] };
};


export const getSurveyForecast = (
  id: number,
  params?: { window_minutes?: number; horizon_minutes?: number },
): Promise<SurveyForecast> =>
  callAdminSurveyEndpoint(`${id}/analytics/forecast${buildQueryString(params)}`);

export const getSurveyAlerts = (
  id: number,
  params?: { window_minutes?: number; min_activity?: number },
): Promise<SurveyAlert[]> =>
  callAdminSurveyEndpoint(`${id}/analytics/alerts${buildQueryString(params)}`);

export const getSurveyBrief = (id: number): Promise<SurveyBrief> =>
  callAdminSurveyEndpoint(`${id}/analytics/brief`);


export const getSurveySegmentsCompare = (
  id: number,
  params?: {
    a_canal?: string;
    b_canal?: string;
    a_genero?: string;
    b_genero?: string;
    a_territorio?: string;
    b_territorio?: string;
  },
): Promise<SurveySegmentsCompare> =>
  callAdminSurveyEndpoint(`${id}/analytics/segments/compare${buildQueryString(params)}`);


export const getSurveySegmentsSuggestions = (
  id: number,
  params?: { limit?: number },
): Promise<SurveySegmentsSuggestions> =>
  callAdminSurveyEndpoint(`${id}/analytics/segments/suggestions${buildQueryString(params)}`);

export const getSurveyAnomalies = (
  id: number,
  params?: { burst_window_minutes?: number; burst_threshold?: number },
): Promise<SurveyAnomalies> =>
  callAdminSurveyEndpoint(`${id}/analytics/anomalies${buildQueryString(params)}`);

export const getSurveyDashboardBundle = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<SurveyDashboardBundle> =>
  callAdminSurveyEndpoint(`${id}/analytics/dashboard${buildQueryString(filtros)}`);

export const downloadExportCsv = async (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<Blob> => {
  const responseText = await callAdminSurveyEndpoint<string>(
    `${id}/analytics/export${buildQueryString(filtros)}`,
    {
      method: 'GET',
      headers: { Accept: 'text/csv' },
    },
  );
  return new Blob([responseText], { type: 'text/csv;charset=utf-8' });
};

export const createSnapshot = (
  id: number,
  payload?: { rango?: string },
): Promise<SurveySnapshot> =>
  callAdminSurveyEndpoint(`${id}/snapshots`, {
    method: 'POST',
    body: payload ?? {},
  });

export const publishSnapshot = (
  id: number,
  snapshotId: number,
): Promise<SurveySnapshot> =>
  callAdminSurveyEndpoint(`${id}/snapshots/${snapshotId}/publicar`, {
    method: 'POST',
  });

export const verifyResponse = (
  id: number,
  snapshotId: number,
  respuestaId: number,
): Promise<{ ok: boolean; valido: boolean }> =>
  callAdminSurveyEndpoint(`${id}/snapshots/${snapshotId}/verificar`, {
    method: 'POST',
    body: { respuesta_id: respuestaId },
  });

export const listSnapshots = (id: number): Promise<SurveySnapshot[]> =>
  callAdminSurveyEndpoint(`${id}/snapshots`);

export const listSurveyResponses = (
  id: number,
  params?: SurveyResponseFilters,
): Promise<SurveyResponseList> =>
  callAdminSurveyEndpoint(`${id}/respuestas${buildQueryString(params as QueryParams)}`);
