import { PUBLIC_SURVEY_BASE_URL } from '@/config';
import { ApiError, apiFetch } from '@/utils/api';
import { MOCK_SURVEYS } from '@/data/mockTenantData';
import {
  PreguntaTipo,
  PublicResponsePayload,
  SurveyAdmin,
  SurveyAnalyticsFilters,
  SurveyComment,
  SurveyDraftPayload,
  SurveyHeatmapPoint,
  SurveyListResponse,
  SurveyPublic,
  SurveyResponseFilters,
  SurveyResponseList,
  SurveySnapshot,
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

type PrimitiveParam = string | number | boolean | undefined | null;
type QueryParams = Record<string, PrimitiveParam | PrimitiveParam[]>;

const PUBLIC_SURVEY_API_BASE =
  typeof PUBLIC_SURVEY_BASE_URL === 'string' && PUBLIC_SURVEY_BASE_URL.trim()
    ? PUBLIC_SURVEY_BASE_URL.trim().replace(/\/$/, '')
    : undefined;

const buildQueryString = (params?: QueryParams) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
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
      const normalized = value
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

    appendValue(value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

type ApiFetchOptions = Parameters<typeof apiFetch>[1];

const ADMIN_SURVEY_BASE_PATHS = [
  '/admin/encuestas',
  '/municipal/encuestas',
  '/admin/surveys',
  '/municipal/surveys/admin',
  // Fallback to explicit tenant paths if generic ones fail
  '/api/admin/encuestas',
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
      return true;
    }

    if (error.status >= 500) {
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

      if (basePath !== ADMIN_SURVEY_BASE_PATHS[0]) {
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
  const response = await apiFetch<unknown>(`/public/encuestas/${slug}`, {
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
  });

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('El servidor devolvió un formato inesperado para la encuesta solicitada.');
  }

  return normalizeSurveyPreguntas(response as SurveyPublic);
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
    const response = await apiFetch<unknown>('/public/encuestas', {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
      tenantSlug,
      baseUrlOverride: PUBLIC_SURVEY_API_BASE,
      omitEntityToken: true,
    });

    if (Array.isArray(response)) {
      if (response.length > 0) {
        return response as SurveyPublic[];
      }

      if (!tenantSlug) {
        const recoveredFromAdmin = await attemptRecoveryFromAdminList();
        if (recoveredFromAdmin) {
          return recoveredFromAdmin;
        }
      }

      return response as SurveyPublic[];
    }

    const raw = serializeUnknown(response);
    if (raw) {
      const recovered = await attemptRecoveryFromRawPayload(raw, undefined, tenantSlug);
      if (recovered) {
        return recovered;
      }
    }

    return asFlaggedEmptyList({ raw });
  } catch (error) {
    if (error instanceof ApiError) {
      const rawBody =
        typeof error.body?.raw === 'string'
          ? error.body.raw
          : typeof error.body === 'string'
            ? error.body
            : serializeUnknown(error.body);

      if (rawBody) {
        const recovered = await attemptRecoveryFromRawPayload(rawBody, error.status, tenantSlug);
        if (recovered) {
          return recovered;
        }
      }

      // If recovery fails or status indicates failure, fallback to mock data
      console.warn('[encuestas] Returning mock surveys due to API failure', error);
      return MOCK_SURVEYS;
    }

    console.warn('[encuestas] Returning mock surveys due to generic error', error);
    return MOCK_SURVEYS;
  }
};

export const postPublicResponse = (
  slug: string,
  payload: PublicResponsePayload,
  tenantSlug?: string,
): Promise<{ ok: boolean; id?: number }> =>
  apiFetch(`/public/encuestas/${slug}/respuestas`, {
    method: 'POST',
    body: payload,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
  });

export const getSurveyComments = (
  slug: string,
  tenantSlug?: string,
  limit = 50,
  offset = 0,
): Promise<SurveyComment[]> =>
  apiFetch(`/public/encuestas/${slug}/comentarios?limit=${limit}&offset=${offset}`, {
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
  });

export const postSurveyComment = (
  slug: string,
  payload: { texto: string; nombre?: string },
  tenantSlug?: string,
): Promise<SurveyComment> =>
  apiFetch(`/public/encuestas/${slug}/comentarios`, {
    method: 'POST',
    body: payload,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    tenantSlug,
    baseUrlOverride: PUBLIC_SURVEY_API_BASE,
    omitEntityToken: true,
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
  const survey = await callAdminSurveyEndpoint<SurveyAdmin>(`${id}/publicar`, {
    method: 'POST',
    ...options,
  });
  return normalizeSurveyPreguntas(survey);
};

export const adminSeedSurvey = async (id: number, payload: { cantidad: number }, options?: ApiFetchOptions): Promise<{ creadas: number }> => {
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

export const getHeatmap = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<SurveyHeatmapPoint[]> =>
  callAdminSurveyEndpoint(`${id}/analytics/heatmap${buildQueryString(filtros)}`);

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
