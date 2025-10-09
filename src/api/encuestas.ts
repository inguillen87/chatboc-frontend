import { ApiError, apiFetch } from '@/utils/api';
import {
  PublicResponsePayload,
  SurveyAdmin,
  SurveyAnalyticsFilters,
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

type QueryParams = Record<string, string | number | boolean | undefined | null>;

const buildQueryString = (params?: QueryParams) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
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
    return [0, 400, 401, 402, 403].every((code) => error.status !== code);
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

export const getPublicSurvey = async (slug: string): Promise<SurveyPublic> => {
  const response = await apiFetch<unknown>(`/public/encuestas/${slug}`, {
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
  });

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('El servidor devolvió un formato inesperado para la encuesta solicitada.');
  }

  return response as SurveyPublic;
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
): Promise<PublicSurveyListResult | null> => {
  const slugs = extractSlugsFromRawPayload(raw);
  if (!slugs.length) {
    return null;
  }

  const recovered = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await getPublicSurvey(slug);
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

export const listPublicSurveys = async (): Promise<PublicSurveyListResult> => {
  try {
    const response = await apiFetch<unknown>('/public/encuestas', {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
    });

    if (Array.isArray(response)) {
      if (response.length > 0) {
        return response as SurveyPublic[];
      }

      const recoveredFromAdmin = await attemptRecoveryFromAdminList();
      if (recoveredFromAdmin) {
        return recoveredFromAdmin;
      }

      return response as SurveyPublic[];
    }

    const raw = serializeUnknown(response);
    if (raw) {
      const recovered = await attemptRecoveryFromRawPayload(raw);
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
        const recovered = await attemptRecoveryFromRawPayload(rawBody, error.status);
        if (recovered) {
          return recovered;
        }
      }

      return asFlaggedEmptyList({ raw: rawBody, status: error.status });
    }

    throw error;
  }
};

export const postPublicResponse = (
  slug: string,
  payload: PublicResponsePayload,
): Promise<{ ok: boolean; id?: number }> =>
  apiFetch(`/public/encuestas/${slug}/respuestas`, {
    method: 'POST',
    body: payload,
    omitCredentials: true,
    isWidgetRequest: true,
    skipAuth: true,
    omitChatSessionId: true,
  });

const normalizeSurveyListResponse = (payload: unknown): SurveyListResponse => {
  if (Array.isArray(payload)) {
    return { data: payload };
  }

  if (payload && typeof payload === 'object') {
    const { data, meta, results } = payload as {
      data?: unknown;
      results?: unknown;
      meta?: unknown;
    };

    if (Array.isArray(data)) {
      return { data, meta: typeof meta === 'object' && meta ? (meta as SurveyListResponse['meta']) : undefined };
    }

    if (Array.isArray(results)) {
      return { data: results, meta: typeof meta === 'object' && meta ? (meta as SurveyListResponse['meta']) : undefined };
    }
  }

  console.warn('[encuestas] Respuesta inesperada para el listado de encuestas del panel', payload);
  return { data: [] };
};

export const adminListSurveys = async (params?: QueryParams): Promise<SurveyListResponse> => {
  const rawResponse = await callAdminSurveyEndpoint<SurveyListResponse | SurveyAdmin[]>(buildQueryString(params));
  return normalizeSurveyListResponse(rawResponse);
};

export const adminCreateSurvey = (payload: SurveyDraftPayload): Promise<SurveyAdmin> =>
  callAdminSurveyEndpoint('', {
    method: 'POST',
    body: payload,
  });

export const adminUpdateSurvey = (id: number, payload: SurveyDraftPayload): Promise<SurveyAdmin> =>
  callAdminSurveyEndpoint(`${id}`, {
    method: 'PUT',
    body: payload,
  });

export const adminDeleteSurvey = (id: number): Promise<void> =>
  callAdminSurveyEndpoint(`${id}`, {
    method: 'DELETE',
  });

export const adminGetSurvey = (id: number): Promise<SurveyAdmin> =>
  callAdminSurveyEndpoint(`${id}`);

export const adminPublishSurvey = (id: number): Promise<SurveyAdmin> =>
  callAdminSurveyEndpoint(`${id}/publicar`, {
    method: 'POST',
  });

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
