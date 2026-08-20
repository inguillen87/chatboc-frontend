import { ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK, PUBLIC_SURVEY_BASE_URL } from '@/config';
import { ApiError, apiFetch } from '@/utils/api';
import {
  PreguntaTipo,
  PublicResponsePayload,
  PublicSurveySubmitOptions,
  SurveyAdmin,
  SurveyAnalyticsFilters,
  SurveyComment,
  SurveyDraftPayload,
  SurveyAnalyticsHeatmap,
  SurveyHeatmapPoint,
  SurveyAdminListParams,
  SurveyListResponse,
  SurveyListPagination,
  SurveyLivePublicResultsPayload,
  SurveyPublic,
  SurveyResponseFilters,
  SurveyResponseList,
  SnapshotCreatePayload,
  SnapshotSimulationResponse,
  SnapshotVerificationResult,
  SurveySnapshot,
  SurveySnapshotListResponse,
  SurveySummary,
  SurveyTimeseriesPoint,
  SurveyForecast,
  SurveyAlert,
  SurveyBrief,
  SurveySegmentsCompare,
  SurveySegmentsSuggestions,
  SurveyAnomalies,
  SurveyDashboardBundle,
  SurveyGovernanceRelease,
  SurveyGovernanceReleaseCreatePayload,
  SurveyGovernanceReleaseList,
} from '@/types/encuestas';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { AmbiguousSurveySubmissionError } from '@/utils/surveySubmissionErrors';
import { assertSurveySubmissionId } from '@/utils/surveySubmissionIdentity';
import { SURVEY_ELIGIBILITY_CREDENTIAL_HEADER } from '@/utils/surveyEligibility';

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

const toFiniteNumberOrUndefined = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toTrimmedStringOrUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const firstDefined = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const arrayFromUnknown = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return Object.values(value);
  return [];
};

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


const shouldRetryPublicSurveyRequest = (
  error: unknown,
  method: ApiFetchOptions['method'],
) => {
  if (error instanceof ApiError) {
    const reasonCode =
      error.body && typeof error.body === 'object' && typeof error.body.reason_code === 'string'
        ? error.body.reason_code.trim()
        : '';
    // A reason-coded 404 is an authoritative domain/security decision (for
    // example survey_not_found on a tenant mismatch), not evidence that the
    // route is absent. Retrying a compatibility alias could otherwise mask it.
    if (error.status === 404) return !reasonCode;
    if (error.status === 405) return true;
    return (method === undefined || method === 'GET') && error.status >= 500;
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
      if (!shouldRetryPublicSurveyRequest(error, options.method)) {
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
  const normalizedTenantSlug = tenantSlug?.trim().toLowerCase();
  if (!normalizedTenantSlug || normalizedTenantSlug === 'default') {
    throw new Error('Se requiere una organización explícita para consultar encuestas públicas.');
  }

  try {
    const response = await callPublicSurveyEndpoint<unknown>(buildPublicSurveyPaths(
      withTenantSlugParam('/api/public/encuestas/v1', normalizedTenantSlug),
    ), {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
      tenantSlug: normalizedTenantSlug,
      baseUrlOverride: PUBLIC_SURVEY_API_BASE,
      omitEntityToken: true,
      omitTenant: true,
    });

    if (Array.isArray(response)) {
      if (response.length > 0) {
        return response as SurveyPublic[];
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
      const recovered = await attemptRecoveryFromRawPayload(raw, undefined, normalizedTenantSlug);
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
        const recovered = await attemptRecoveryFromRawPayload(rawBody, error.status, normalizedTenantSlug);
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


const normalizeLiveOption = (
  value: unknown,
  index: number,
): NonNullable<NonNullable<SurveyLivePublicResultsPayload['preguntas']>[number]['opciones']>[number] | null => {
  if (!isRecord(value)) {
    const label = toTrimmedStringOrUndefined(value);
    return label ? { id: index, label, value: label, votos: 0, porcentaje: 0 } : null;
  }

  const label =
    toTrimmedStringOrUndefined(firstDefined(value, ['label', 'texto', 'opcion', 'title', 'name', 'value'])) ??
    `Opcion ${index + 1}`;
  return {
    id: firstDefined(value, ['id', 'option_id', 'key']) as string | number | undefined,
    label,
    texto: toTrimmedStringOrUndefined(firstDefined(value, ['texto', 'label', 'opcion', 'title', 'name'])),
    value: toTrimmedStringOrUndefined(firstDefined(value, ['value', 'key', 'id', 'label', 'texto'])),
    votos: toFiniteNumberOrUndefined(firstDefined(value, ['votos', 'votes', 'count', 'total', 'respuestas'])) ?? 0,
    porcentaje: toFiniteNumberOrUndefined(firstDefined(value, ['porcentaje', 'percentage', 'percent', 'pct'])) ?? 0,
  };
};

const normalizeLiveQuestion = (
  value: unknown,
  index: number,
): NonNullable<SurveyLivePublicResultsPayload['preguntas']>[number] | null => {
  if (!isRecord(value)) return null;
  const rawOptions = firstDefined(value, ['opciones', 'options', 'choices', 'resultados', 'results']);
  const opciones = arrayFromUnknown(rawOptions)
    .map(normalizeLiveOption)
    .filter((option): option is NonNullable<NonNullable<SurveyLivePublicResultsPayload['preguntas']>[number]['opciones']>[number] =>
      Boolean(option),
    );
  const totalVotes =
    toFiniteNumberOrUndefined(firstDefined(value, ['total_votos', 'total_votes', 'votos', 'votes', 'respuestas', 'total'])) ??
    opciones.reduce((sum, option) => sum + (option.votos ?? 0), 0);

  return {
    id: firstDefined(value, ['id', 'pregunta_id', 'question_id', 'key']) as string | number | undefined,
    tipo: toTrimmedStringOrUndefined(firstDefined(value, ['tipo', 'type'])),
    texto: toTrimmedStringOrUndefined(firstDefined(value, ['texto', 'titulo', 'title', 'pregunta', 'label'])),
    titulo: toTrimmedStringOrUndefined(firstDefined(value, ['titulo', 'title', 'texto', 'pregunta', 'label'])) ?? `Pregunta ${index + 1}`,
    total_votos: totalVotes,
    opciones,
  };
};

const normalizeHeatmapPoint = (value: unknown) => {
  if (!isRecord(value)) return null;
  const lat = toFiniteNumberOrUndefined(firstDefined(value, ['lat', 'latitude', 'centroid_lat']));
  const lng = toFiniteNumberOrUndefined(firstDefined(value, ['lng', 'lon', 'longitude', 'centroid_lng', 'centroid_lon']));
  const pointValue =
    toFiniteNumberOrUndefined(firstDefined(value, ['value', 'respuestas', 'votes', 'votos', 'count', 'total', 'weight'])) ?? 1;
  return {
    ...value,
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    value: pointValue,
    respuestas: toFiniteNumberOrUndefined(firstDefined(value, ['respuestas', 'value', 'votes', 'votos', 'count', 'total', 'weight'])) ?? pointValue,
  };
};

const normalizeHeatmapCell = (value: unknown) => {
  if (!isRecord(value)) return null;
  const lat = toFiniteNumberOrUndefined(firstDefined(value, ['lat', 'latitude', 'centroid_lat']));
  const lng = toFiniteNumberOrUndefined(firstDefined(value, ['lng', 'lon', 'longitude', 'centroid_lng', 'centroid_lon']));
  const cellValue =
    toFiniteNumberOrUndefined(firstDefined(value, ['value', 'respuestas', 'votes', 'votos', 'count', 'total', 'weight'])) ?? 1;
  return {
    ...value,
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    value: cellValue,
    respuestas: toFiniteNumberOrUndefined(firstDefined(value, ['respuestas', 'value', 'votes', 'votos', 'count', 'total', 'weight'])) ?? cellValue,
  };
};

export const normalizePublicSurveyLiveResults = (payload: unknown): SurveyLivePublicResultsPayload => {
  if (!isRecord(payload)) {
    return {
      contract_version: 'surveys.live_results.v2',
      total_respuestas: 0,
      preguntas: [],
      timeline_minute: [],
    };
  }

  const contractVersion = toTrimmedStringOrUndefined(firstDefined(payload, ['contract_version', 'contractVersion']));
  const rawResultVersion = firstDefined(payload, ['result_version', 'resultVersion', 'version']);
  const normalizedResultVersion =
    toFiniteNumberOrUndefined(rawResultVersion) ?? toTrimmedStringOrUndefined(rawResultVersion);
  const snapshotVersion = toTrimmedStringOrUndefined(firstDefined(payload, ['snapshot_version', 'snapshotVersion']));
  const rawQuestions = firstDefined(payload, ['preguntas', 'questions', 'resultados', 'results']);
  const preguntas = arrayFromUnknown(rawQuestions)
    .map(normalizeLiveQuestion)
    .filter((question): question is NonNullable<SurveyLivePublicResultsPayload['preguntas']>[number] => Boolean(question));

  const rawTimeline = firstDefined(payload, ['timeline_minute', 'timeline', 'series', 'timeseries']);
  const timeline_minute = arrayFromUnknown(rawTimeline).map((item) => {
    if (!isRecord(item)) return item as NonNullable<SurveyLivePublicResultsPayload['timeline_minute']>[number];
    return {
      ...item,
      respuestas: toFiniteNumberOrUndefined(firstDefined(item, ['respuestas', 'value', 'total', 'count'])),
      total: toFiniteNumberOrUndefined(firstDefined(item, ['total', 'respuestas', 'value', 'count'])),
    };
  });

  const heatmapRecord = isRecord(payload.heatmap) ? payload.heatmap : {};
  const rawHeatmapPoints =
    firstDefined(heatmapRecord, ['points', 'puntos', 'geo_points', 'heatmap_points']) ??
    firstDefined(payload, ['heatmap_points', 'geo_points', 'points', 'puntos']);
  const rawHeatmapCells =
    firstDefined(heatmapRecord, ['cells', 'celdas', 'heatmap_cells']) ??
    firstDefined(payload, ['heatmap_cells', 'cells', 'celdas']);
  const heatmap = {
    ...heatmapRecord,
    points: arrayFromUnknown(rawHeatmapPoints).map(normalizeHeatmapPoint).filter((item): item is NonNullable<ReturnType<typeof normalizeHeatmapPoint>> => Boolean(item)),
    cells: arrayFromUnknown(rawHeatmapCells).map(normalizeHeatmapCell).filter((item): item is NonNullable<ReturnType<typeof normalizeHeatmapCell>> => Boolean(item)),
    metadata: isRecord(heatmapRecord.metadata)
      ? heatmapRecord.metadata
      : isRecord(payload.heatmap_metadata)
        ? payload.heatmap_metadata
        : undefined,
  };

  return {
    ...payload,
    ...(contractVersion ? { contract_version: contractVersion } : {}),
    ...(normalizedResultVersion !== undefined ? { result_version: normalizedResultVersion } : {}),
    ...(snapshotVersion ? { snapshot_version: snapshotVersion } : {}),
    total_respuestas:
      toFiniteNumberOrUndefined(firstDefined(payload, ['total_respuestas', 'total_responses', 'total_votos', 'total_votes', 'votes', 'votos', 'responses', 'total'])) ??
      preguntas.reduce((sum, question) => sum + (question.total_votos ?? 0), 0),
    preguntas,
    timeline_minute,
    heatmap,
  };
};

export const getPublicSurveyLiveResults = (
  slug: string,
  tenantSlug?: string,
  params?: {
    include_heatmap?: 0 | 1;
    range_preset?: 'last_60m' | 'today' | 'last_24h';
    range_timezone?: string;
    desde?: string;
    hasta?: string;
    momentum_window_minutes?: number;
    /** @deprecated Use momentum_window_minutes. */
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
  }).then(normalizePublicSurveyLiveResults);

type PublicSurveyResponseAck = {
  ok: boolean;
  persisted?: boolean;
  replayed?: boolean;
  duplicate?: boolean;
  reason_code?: string;
  message?: string;
  id?: number;
  respuesta_id?: number | string;
  response_id?: number | string;
  contact_key?: string;
  conversation_id?: string;
  contract_version?: string;
  request_id?: string;
  live_results_url?: string;
  realtime?: Record<string, unknown>;
  idempotency?: Record<string, unknown>;
  [key: string]: unknown;
};

const DURABLE_PUBLIC_RESPONSE_CONTRACTS = new Set([
  'surveys.public_response.v2',
  'encuestas.public_response.v1',
]);

const positiveInteger = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const FORBIDDEN_ELIGIBILITY_PAYLOAD_KEYS = new Set([
  'credential',
  'eligibilitycredential',
  'eligibilitytoken',
  'surveyeligibilitycredential',
  'grantcredential',
  'granttoken',
]);

const containsEligibilityCredentialField = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsEligibilityCredentialField(item, seen));
  }
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      FORBIDDEN_ELIGIBILITY_PAYLOAD_KEYS.has(normalizedKey) ||
      containsEligibilityCredentialField(nested, seen)
    );
  });
};

const assertDurablePublicResponseAck = (
  response: PublicSurveyResponseAck,
  payload: PublicResponsePayload,
  contractVersion?: string,
  eligibilityExpectation?: PublicSurveySubmitOptions['eligibilityExpectation'],
) => {
  // Synthetic demos have no durable database receipt by design.
  if (contractVersion === 'demo.survey_response_ack.v1') return;

  if (!contractVersion || !DURABLE_PUBLIC_RESPONSE_CONTRACTS.has(contractVersion)) {
    throw new AmbiguousSurveySubmissionError(
      'El servidor respondio sin un contrato durable de persistencia. Reintenta con la misma respuesta.',
    );
  }

  const receipt = isRecord(response.idempotency) ? response.idempotency : null;
  const responseId = positiveInteger(response.response_id);
  const respuestaId = positiveInteger(response.respuesta_id);
  const receiptResponseId = positiveInteger(receipt?.response_id);
  const receiptId = positiveInteger(receipt?.receipt_id);
  const responseRevision = positiveInteger(response.instrument_revision);
  const receiptRevision = positiveInteger(receipt?.instrument_revision);
  const expectedRevision = payload.instrument_revision ?? null;
  const disposition = receipt?.disposition;
  const replayed = response.replayed;
  const receiptReplayed = receipt?.replayed;
  const expectedGovernance = payload.governance;
  const eligibilityMatches = (raw: unknown, responseIdToMatch: number) => {
    if (!eligibilityExpectation) return true;
    if (!isRecord(raw)) return false;
    const redemption = isRecord(raw.redemption) ? raw.redemption : null;
    const denominatorStatus = isRecord(raw.denominator_status) ? raw.denominator_status : null;
    const redeemedAt = typeof redemption?.redeemed_at === 'string' ? redemption.redeemed_at : '';
    return (
      raw.contract_version === eligibilityExpectation.contractVersion &&
      raw.credential_required === true &&
      raw.gate_status === 'verified' &&
      raw.decision === 'verified_by_opaque_grant' &&
      raw.privacy_assurance === 'pseudonymous_internal_linkability' &&
      raw.assurance_level === 'human_reviewed_opaque_grant' &&
      raw.authority_binding === 'operator_attested_v1' &&
      raw.subject_identifier_exposed === false &&
      raw.plaintext_credential_persisted === false &&
      raw.persist_client_side === false &&
      raw.ballot_secrecy_certified === false &&
      raw.regulated_election_certified === false &&
      raw.result_certified === false &&
      raw.eligible_population === null &&
      raw.participation_rate === null &&
      raw.abstentions === null &&
      denominatorStatus?.available === false &&
      denominatorStatus.reason_code === 'survey_eligible_population_not_sealed' &&
      redemption !== null &&
      redemption.contract_version === 'surveys.eligibility_redemption.v1' &&
      redemption.state === 'committed' &&
      redemption.persisted === true &&
      positiveInteger(redemption.response_id) === responseIdToMatch &&
      positiveInteger(redemption.release_id) === eligibilityExpectation.releaseId &&
      redemption.policy_version === eligibilityExpectation.policyVersion &&
      redeemedAt.length > 0 &&
      Number.isFinite(Date.parse(redeemedAt)) &&
      !('credential' in raw) &&
      !('grant_ref' in raw) &&
      !('subject' in raw) &&
      !('credential' in redemption) &&
      !('grant_ref' in redemption) &&
      !('subject' in redemption)
    );
  };
  const governanceMatches = (raw: unknown, responseIdToMatch: number) => {
    if (!expectedGovernance) return !eligibilityExpectation;
    if (!isRecord(raw)) return false;
    return (
      raw.contract_version === 'surveys.public_governance.v1' &&
      raw.mode === 'governed_release' &&
      positiveInteger(raw.release_id) === expectedGovernance.release_id &&
      raw.snapshot_sha256 === expectedGovernance.snapshot_sha256 &&
      raw.eligibility_policy_version === expectedGovernance.eligibility_policy_version &&
      raw.consent_policy_version === expectedGovernance.consent_policy_version &&
      raw.eligibility_decision ===
        (eligibilityExpectation ? 'verified_by_opaque_grant' : 'not_evaluated') &&
      raw.human_review_required === true &&
      raw.regulated_election_certified === false &&
      raw.result_certified === false &&
      eligibilityMatches(raw.eligibility, responseIdToMatch)
    );
  };

  const durable =
    response.ok === true &&
    response.persisted === true &&
    typeof replayed === 'boolean' &&
    receipt !== null &&
    receipt.contract_version === 'surveys.response_receipt.v1' &&
    receipt.canonical_version === 'survey-response.v1' &&
    receipt.state === 'committed' &&
    (disposition === 'accepted' || disposition === 'replayed') &&
    receipt.persisted === true &&
    typeof receiptReplayed === 'boolean' &&
    receiptReplayed === replayed &&
    disposition === (replayed ? 'replayed' : 'accepted') &&
    receipt.submission_id === payload.submission_id &&
    responseId !== null &&
    respuestaId === responseId &&
    receiptResponseId === responseId &&
    receiptId !== null &&
    responseRevision !== null &&
    receiptRevision === responseRevision &&
    (expectedRevision === null || responseRevision === expectedRevision) &&
    governanceMatches(response.governance, responseId) &&
    governanceMatches(receipt.governance, responseId);

  if (!durable) {
    throw new AmbiguousSurveySubmissionError(
      'El servidor no confirmo un recibo durable completo. Reintenta con la misma respuesta.',
    );
  }
};

export const postPublicResponse = (
  slug: string,
  payload: PublicResponsePayload,
  tenantSlug?: string,
  options?: PublicSurveySubmitOptions,
): Promise<PublicSurveyResponseAck> => {
  const submissionId = assertSurveySubmissionId(payload.submission_id);
  if (containsEligibilityCredentialField(payload)) {
    throw new Error(
      'La credencial de elegibilidad sólo puede enviarse mediante el encabezado seguro dedicado.',
    );
  }
  const eligibilityCredential = options?.eligibilityCredential?.trim() || '';
  const eligibilityExpectation = options?.eligibilityExpectation;
  if (Boolean(eligibilityCredential) !== Boolean(eligibilityExpectation)) {
    throw new Error(
      eligibilityExpectation
        ? 'La credencial de elegibilidad es obligatoria para esta participación.'
        : 'La credencial no está vinculada a un contrato de elegibilidad verificable.',
    );
  }
  if (
    eligibilityExpectation &&
    (
      eligibilityExpectation.contractVersion !== 'surveys.public_eligibility.v1' ||
      (eligibilityExpectation.mode !== 'institution_attested' &&
        eligibilityExpectation.mode !== 'manual_review') ||
      !payload.governance ||
      payload.governance.release_id !== eligibilityExpectation.releaseId ||
      payload.governance.eligibility_policy_version !== eligibilityExpectation.policyVersion
    )
  ) {
    throw new Error(
      'La credencial no coincide con el release y la política de elegibilidad de esta respuesta.',
    );
  }
  const requestPayload: PublicResponsePayload = {
    ...payload,
    submission_id: submissionId,
  };

  return callPublicSurveyEndpoint<PublicSurveyResponseAck>(buildPublicSurveyPaths(
    withTenantSlugParam(`/api/v2/public/surveys/${slug}/respond`, tenantSlug),
    withTenantSlugParam(`/api/public/encuestas/v1/${slug}/responder`, tenantSlug),
  ), {
    method: 'POST',
    headers: {
      'Idempotency-Key': submissionId,
      ...(eligibilityCredential
        ? { [SURVEY_ELIGIBILITY_CREDENTIAL_HEADER]: eligibilityCredential }
        : {}),
    },
    body: requestPayload,
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
    if (
      response.ok === true &&
      response.duplicate === true &&
      response.reason_code === 'survey_response_duplicate'
    ) {
      throw new ApiError(
        typeof response.message === 'string' && response.message.trim()
          ? response.message
          : 'La respuesta ya fue registrada.',
        409,
        response,
        typeof response.request_id === 'string' ? response.request_id : undefined,
      );
    }
    assertDurablePublicResponseAck(
      response,
      requestPayload,
      contractVersion,
      eligibilityExpectation,
    );
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
};

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

export type AdminSurveyComment = SurveyComment & {
  estado?: string | null;
  report_count?: number | null;
  updated_at?: string | null;
};

export const adminGetSurveyComments = (
  id: number,
  params?: { limit?: number; offset?: number },
  options?: ApiFetchOptions,
): Promise<AdminSurveyComment[]> =>
  callAdminSurveyEndpoint<AdminSurveyComment[]>(
    `${id}/comentarios${buildQueryString({ limit: params?.limit ?? 50, offset: params?.offset ?? 0 })}`,
    options,
  );

export const adminModerateSurveyComment = (
  commentId: number,
  accion: 'aprobar' | 'ocultar' | 'eliminar',
  options?: ApiFetchOptions,
): Promise<{ id: number; estado?: string | null; report_count?: number | null }> =>
  callAdminSurveyEndpoint<{ id: number; estado?: string | null; report_count?: number | null }>(
    `comentarios/${commentId}`,
    {
      method: 'PATCH',
      body: { accion },
      ...options,
    },
  );

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

const ADMIN_LIFECYCLE_PHASES = new Set([
  'draft',
  'scheduled',
  'collecting',
  'live_voting',
  'window_ended',
  'closed',
  'archived',
  'unknown',
]);
const ADMIN_PERSISTED_STATES = new Set(['borrador', 'publicada', 'cerrada', 'archivada', 'unknown']);
const SURVEY_LIST_CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/;
const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isIsoDateOrNull = (value: unknown) =>
  value === null || (typeof value === 'string' && Boolean(value) && Number.isFinite(Date.parse(value)));

const normalizeAdminSurveyPagination = (
  value: unknown,
  itemCount: number,
): SurveyListPagination | null => {
  if (!isRecord(value) || value.contract_version !== 'surveys.pagination.v1') return null;

  const limit = value.limit;
  const page = value.page;
  const cursor = value.cursor;
  const nextCursor = value.next_cursor;
  const nextPage = value.next_page;
  const hasMore = value.has_more;
  const returned = value.returned;
  const totalItems = value.total_items;
  const validCursor = (candidate: unknown): candidate is string | null =>
    candidate === null ||
    (typeof candidate === 'string' &&
      candidate.length > 0 &&
      candidate.length <= 128 &&
      SURVEY_LIST_CURSOR_PATTERN.test(candidate));
  const validPage = (candidate: unknown): candidate is number | null =>
    candidate === null ||
    (isNonNegativeSafeInteger(candidate) && candidate >= 1 && candidate <= 10_000);

  if (
    !isNonNegativeSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !validPage(page) ||
    !validCursor(cursor) ||
    !validCursor(nextCursor) ||
    !validPage(nextPage) ||
    typeof hasMore !== 'boolean' ||
    !isNonNegativeSafeInteger(returned) ||
    returned !== itemCount ||
    returned > limit ||
    !isNonNegativeSafeInteger(totalItems) ||
    totalItems < returned ||
    value.ordering !== 'id_desc'
  ) {
    return null;
  }

  if (
    (cursor !== null && (page !== null || nextPage !== null)) ||
    (cursor === null && page === null) ||
    hasMore !== (nextCursor !== null) ||
    (!hasMore && nextPage !== null) ||
    (page !== null && hasMore && nextPage !== page + 1)
  ) {
    return null;
  }

  return {
    contract_version: 'surveys.pagination.v1',
    limit,
    page,
    cursor,
    next_cursor: nextCursor,
    next_page: nextPage,
    has_more: hasMore,
    returned,
    total_items: totalItems,
    ordering: 'id_desc',
  };
};

const normalizeSurveyListResponse = (payload: unknown): SurveyListResponse => {
  if (isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, 'contract_version')) {
    if (payload.contract_version !== 'surveys.admin_list.v2') {
      throw new Error('survey_admin_list_contract_unsupported');
    }
    const tenant = payload.tenant;
    const freshness = payload.freshness;
    const overview = payload.resumen;
    const items = payload.encuestas;
    const pagination = normalizeAdminSurveyPagination(
      payload.pagination,
      Array.isArray(items) ? items.length : -1,
    );
    const validTenant =
      isRecord(tenant) &&
      isNonNegativeSafeInteger(tenant.id) &&
      tenant.id > 0 &&
      typeof tenant.slug === 'string' &&
      Boolean(tenant.slug.trim());
    const validFreshness =
      isRecord(freshness) &&
      typeof freshness.generated_at === 'string' &&
      Number.isFinite(Date.parse(freshness.generated_at)) &&
      typeof freshness.source === 'string' &&
      Boolean(freshness.source.trim()) &&
      freshness.synthetic === false;
    const validLifecycle = (item: Record<string, unknown>) => {
      const value = item.admin_lifecycle;
      if (!isRecord(value) || value.contract_version !== 'surveys.admin_lifecycle.v1') return false;
      if (!['survey', 'voting'].includes(String(value.instrument_kind))) return false;
      if (!ADMIN_LIFECYCLE_PHASES.has(String(value.phase))) return false;
      if (!ADMIN_PERSISTED_STATES.has(String(value.persisted_state))) return false;
      if (typeof value.accepts_responses !== 'boolean') return false;
      if (value.accepts_responses !== ['collecting', 'live_voting'].includes(String(value.phase))) return false;
      if (!isRecord(value.schedule) || !isIsoDateOrNull(value.schedule.opens_at) || !isIsoDateOrNull(value.schedule.closes_at)) return false;
      if (typeof value.schedule.evaluated_at !== 'string' || !Number.isFinite(Date.parse(value.schedule.evaluated_at))) return false;
      if (!isRecord(value.capabilities) || !isRecord(value.participation) || !isRecord(value.actions)) return false;
      const capabilityKeys = ['can_publish', 'can_close', 'can_delete', 'can_share', 'can_view_results'];
      if (!capabilityKeys.every((key) => typeof value.capabilities[key] === 'boolean')) return false;
      if (!['responses', 'unique_participants', 'responses_last_24h'].every((key) => isNonNegativeSafeInteger(value.participation[key]))) return false;
      if (!isIsoDateOrNull(value.participation.last_response_at)) return false;
      if (
        value.participation.eligible_population !== null ||
        value.participation.participation_rate !== null ||
        value.participation.abstentions !== null ||
        !isRecord(value.participation.denominator_status) ||
        value.participation.denominator_status.available !== false ||
        value.participation.denominator_status.reason_code !== 'survey_eligible_population_not_configured'
      ) return false;

      const surveyId = item.id;
      if (!isNonNegativeSafeInteger(surveyId) || surveyId <= 0) return false;
      const publish = value.actions.publish;
      const close = value.actions.close;
      if (!isRecord(publish) || !isRecord(close)) return false;
      if (
        publish.method !== 'POST' ||
        publish.endpoint !== `/api/v2/surveys/${surveyId}/publish` ||
        publish.enabled !== value.capabilities.can_publish ||
        close.method !== 'POST' ||
        close.endpoint !== `/api/v2/surveys/${surveyId}/close` ||
        close.enabled !== value.capabilities.can_close ||
        close.confirmation_required !== true ||
        close.irreversible !== true
      ) return false;
      if (publish.enabled === false && typeof publish.disabled_reason_code !== 'string') return false;
      if (close.enabled === false && typeof close.disabled_reason_code !== 'string') return false;

      const metrics = item.metricas;
      if (!isRecord(metrics)) return false;
      if (!['total_respuestas', 'respuestas_ultimas_24h', 'respuestas_con_coordenadas', 'participantes_unicos'].every((key) => isNonNegativeSafeInteger(metrics[key]))) return false;
      return (
        metrics.total_respuestas === value.participation.responses &&
        metrics.respuestas_ultimas_24h === value.participation.responses_last_24h &&
        metrics.participantes_unicos === value.participation.unique_participants
      );
    };
    const validItems =
      Array.isArray(items) &&
      items.every((item) => isRecord(item) && validLifecycle(item));
    const validOverviewShape =
      isRecord(overview) &&
      [
        overview.total,
        overview.activas,
        overview.con_respuestas,
        overview.total_respuestas,
        overview.respuestas_con_coordenadas,
        overview.respuestas_ultimas_24h,
        overview.accepting_responses,
      ].every(isNonNegativeSafeInteger) &&
      isRecord(overview.por_estado) &&
      isRecord(overview.por_tipo_instrumento) &&
      isRecord(overview.participation_denominator) &&
      overview.participation_denominator.available === false &&
      overview.participation_denominator.reason_code === 'survey_eligible_population_not_configured';

    let reconciles = false;
    if (validItems && validOverviewShape && Array.isArray(items) && isRecord(overview)) {
      const records = items as Array<Record<string, unknown>>;
      const instrumentCounts = overview.por_tipo_instrumento as Record<string, unknown>;
      const sum = (select: (item: Record<string, unknown>) => number) =>
        records.reduce((total, item) => total + select(item), 0);
      const lifecycle = (item: Record<string, unknown>) => item.admin_lifecycle as Record<string, unknown>;
      const participation = (item: Record<string, unknown>) => lifecycle(item).participation as Record<string, unknown>;
      const metrics = (item: Record<string, unknown>) => item.metricas as Record<string, unknown>;
      reconciles =
        overview.total === records.length &&
        overview.activas === records.filter((item) => item.esta_activa === true).length &&
        overview.con_respuestas === records.filter((item) => Number(participation(item).responses) > 0).length &&
        overview.accepting_responses === records.filter((item) => lifecycle(item).accepts_responses === true).length &&
        overview.total_respuestas === sum((item) => Number(participation(item).responses)) &&
        overview.respuestas_ultimas_24h === sum((item) => Number(participation(item).responses_last_24h)) &&
        overview.respuestas_con_coordenadas === sum((item) => Number(metrics(item).respuestas_con_coordenadas)) &&
        instrumentCounts.survey === records.filter((item) => lifecycle(item).instrument_kind === 'survey').length &&
        instrumentCounts.voting === records.filter((item) => lifecycle(item).instrument_kind === 'voting').length;
    }

    if (!validTenant || !validFreshness || !validOverviewShape || !validItems || !pagination || !reconciles) {
      throw new Error('survey_admin_list_contract_invalid');
    }

    return {
      contract_version: 'surveys.admin_list.v2',
      tenant: { id: tenant.id as number, slug: (tenant.slug as string).trim() },
      freshness: {
        generated_at: freshness.generated_at as string,
        source: freshness.source as string,
        synthetic: false,
      },
      overview: overview as unknown as NonNullable<SurveyListResponse['overview']>,
      pagination,
      data: items as SurveyAdmin[],
    };
  }

  const extracted = extractSurveyArray(payload);

  if (extracted) {
    return extracted;
  }

  throw new Error('survey_admin_list_payload_invalid');
};

export const adminListSurveys = async (
  params?: SurveyAdminListParams,
  options?: ApiFetchOptions,
): Promise<SurveyListResponse> => {
  const expectedTenantSlug = options?.tenantSlug?.trim();
  if (!expectedTenantSlug) {
    throw new Error('survey_admin_tenant_required');
  }
  const rawResponse = await callAdminSurveyEndpoint<unknown>(
    buildQueryString(params),
    options,
  );
  const normalized = normalizeSurveyListResponse(rawResponse);
  if (
    normalized.contract_version === 'surveys.admin_list.v2' &&
    normalized.tenant?.slug?.toLowerCase() !== expectedTenantSlug.toLowerCase()
  ) {
    throw new Error('survey_admin_tenant_mismatch');
  }
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

export const adminCloseSurvey = async (id: number, options?: ApiFetchOptions): Promise<SurveyAdmin> => {
  const tenantSlug = options?.tenantSlug?.trim();
  if (!tenantSlug) {
    throw new Error('survey_admin_tenant_required');
  }
  const survey = await apiFetch<SurveyAdmin>(`/api/v2/surveys/${id}/close`, {
    method: 'POST',
    ...options,
    tenantSlug,
  });
  return normalizeSurveyPreguntas(survey);
};

const requireSurveyGovernanceOptions = (options?: ApiFetchOptions): ApiFetchOptions => {
  const tenantSlug = options?.tenantSlug?.trim();
  if (!tenantSlug) {
    throw new Error('survey_governance_tenant_required');
  }
  return {
    ...options,
    tenantSlug,
    cache: 'no-store',
  };
};

export const adminListSurveyGovernanceReleases = (
  id: number,
  options?: ApiFetchOptions,
): Promise<SurveyGovernanceReleaseList> =>
  apiFetch<SurveyGovernanceReleaseList>(
    `/api/v2/surveys/${id}/releases`,
    requireSurveyGovernanceOptions(options),
  );

export const adminCreateSurveyGovernanceRelease = (
  id: number,
  payload: SurveyGovernanceReleaseCreatePayload,
  idempotencyKey: string,
  options?: ApiFetchOptions,
): Promise<SurveyGovernanceRelease> =>
  apiFetch<SurveyGovernanceRelease>(`/api/v2/surveys/${id}/releases`, {
    ...requireSurveyGovernanceOptions(options),
    method: 'POST',
    body: payload,
    headers: {
      ...options?.headers,
      'Idempotency-Key': idempotencyKey,
    },
  });

export const adminPublishSurveyGovernanceRelease = (
  surveyId: number,
  releaseId: number,
  snapshotSha256: string,
  idempotencyKey: string,
  options?: ApiFetchOptions,
): Promise<SurveyGovernanceRelease> =>
  apiFetch<SurveyGovernanceRelease>(
    `/api/v2/surveys/${surveyId}/releases/${releaseId}/publish`,
    {
      ...requireSurveyGovernanceOptions(options),
      method: 'POST',
      body: { expected_snapshot_sha256: snapshotSha256 },
      headers: {
        ...options?.headers,
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

export const adminCloseSurveyGovernanceRelease = (
  surveyId: number,
  releaseId: number,
  humanReviewReference: string,
  idempotencyKey: string,
  options?: ApiFetchOptions,
): Promise<SurveyGovernanceRelease> =>
  apiFetch<SurveyGovernanceRelease>(
    `/api/v2/surveys/${surveyId}/releases/${releaseId}/close`,
    {
      ...requireSurveyGovernanceOptions(options),
      method: 'POST',
      body: { human_review_reference: humanReviewReference },
      headers: {
        ...options?.headers,
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

export const adminSeedSurvey = async (
  id: number,
  payload: {
    cantidad: number;
    reset?: boolean;
    geo_profile_key?: string;
    municipality_label?: string;
    scenario?: string;
  },
  options?: ApiFetchOptions,
): Promise<{ creadas: number; reset?: { respuestas?: number; comentarios?: number } }> => {
  return callAdminSurveyEndpoint<{ creadas: number }>(`${id}/seed-demo`, {
    method: 'POST',
    body: payload,
    ...options,
  });
};

const optionalNonNegativeNumber = (
  record: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  const raw = firstDefined(record, keys);
  if (raw === undefined) return undefined;
  return Math.max(0, toFiniteNumberOrUndefined(raw) ?? 0);
};

const normalizeSummaryOption = (
  value: unknown,
  index: number,
): SurveySummary['preguntas'][number]['opciones'][number] | null => {
  if (!isRecord(value)) return null;

  const rawId = firstDefined(value, ['opcion_id', 'option_id', 'id', 'key']);
  const opcionId =
    typeof rawId === 'string' ||
    (typeof rawId === 'number' && Number.isFinite(rawId))
      ? rawId
      : index;
  const respuestas =
    optionalNonNegativeNumber(value, [
      'respuestas',
      'conteo',
      'value',
      'count',
      'total',
    ]) ?? 0;
  const porcentaje =
    optionalNonNegativeNumber(value, [
      'porcentaje',
      'percentage',
      'percent',
      'pct',
    ]) ?? 0;
  const conteo = optionalNonNegativeNumber(value, ['conteo']);
  const optionValue = optionalNonNegativeNumber(value, ['value']);
  const respuestasSeleccionaron = optionalNonNegativeNumber(value, [
    'respuestas_seleccionaron',
    'respuestasSeleccionaron',
  ]);
  const porcentajeTotalEncuesta = optionalNonNegativeNumber(value, [
    'porcentaje_total_encuesta',
    'porcentajeTotalEncuesta',
  ]);
  const porcentajeElegibles = optionalNonNegativeNumber(value, [
    'porcentaje_elegibles',
    'porcentajeElegibles',
  ]);
  const porcentajeRespuestasPregunta = optionalNonNegativeNumber(value, [
    'porcentaje_respuestas_pregunta',
    'porcentajeRespuestasPregunta',
  ]);

  return {
    ...value,
    opcion_id: opcionId,
    texto:
      toTrimmedStringOrUndefined(
        firstDefined(value, ['texto', 'label', 'opcion', 'name']),
      ) ?? `Opción ${index + 1}`,
    respuestas,
    porcentaje,
    ...(conteo !== undefined ? { conteo } : {}),
    ...(optionValue !== undefined ? { value: optionValue } : {}),
    ...(respuestasSeleccionaron !== undefined
      ? { respuestas_seleccionaron: respuestasSeleccionaron }
      : {}),
    ...(porcentajeTotalEncuesta !== undefined
      ? { porcentaje_total_encuesta: porcentajeTotalEncuesta }
      : {}),
    ...(porcentajeElegibles !== undefined
      ? { porcentaje_elegibles: porcentajeElegibles }
      : {}),
    ...(porcentajeRespuestasPregunta !== undefined
      ? { porcentaje_respuestas_pregunta: porcentajeRespuestasPregunta }
      : {}),
  };
};

const normalizeSummaryQuestion = (
  value: unknown,
  index: number,
  surveyTotal: number,
): SurveySummary['preguntas'][number] | null => {
  if (!isRecord(value)) return null;

  const rawQuestionId = firstDefined(value, [
    'pregunta_id',
    'question_id',
    'id',
  ]);
  const preguntaId = toFiniteNumberOrUndefined(rawQuestionId) ?? index;
  const respuestasElegibles = optionalNonNegativeNumber(value, [
    'respuestas_elegibles',
    'respuestasElegibles',
  ]);
  const respuestasRespondidas = optionalNonNegativeNumber(value, [
    'respuestas_respondidas',
    'respuestasRespondidas',
  ]);
  const tasaRespuestaElegible = optionalNonNegativeNumber(value, [
    'tasa_respuesta_elegible',
    'tasaRespuestaElegible',
  ]);
  const opciones = arrayFromUnknown(
    firstDefined(value, ['opciones', 'options', 'choices']),
  )
    .map(normalizeSummaryOption)
    .filter(
      (
        option,
      ): option is SurveySummary['preguntas'][number]['opciones'][number] =>
        Boolean(option),
    );

  return {
    ...value,
    pregunta_id: preguntaId,
    texto:
      toTrimmedStringOrUndefined(
        firstDefined(value, ['texto', 'pregunta', 'label', 'title', 'nombre']),
      ) ?? `Pregunta ${index + 1}`,
    tipo: toTrimmedStringOrUndefined(firstDefined(value, ['tipo', 'type'])),
    tipo_interno: toTrimmedStringOrUndefined(
      firstDefined(value, ['tipo_interno', 'tipoInterno', 'internal_type']),
    ),
    total_respuestas:
      optionalNonNegativeNumber(value, ['total_respuestas', 'totalResponses']) ??
      surveyTotal,
    opciones,
    ...(respuestasElegibles !== undefined
      ? { respuestas_elegibles: respuestasElegibles }
      : {}),
    ...(respuestasRespondidas !== undefined
      ? { respuestas_respondidas: respuestasRespondidas }
      : {}),
    ...(tasaRespuestaElegible !== undefined
      ? { tasa_respuesta_elegible: tasaRespuestaElegible }
      : {}),
  };
};

export const normalizeSurveySummary = (payload: unknown): SurveySummary => {
  if (!isRecord(payload)) {
    return {
      total_respuestas: 0,
      participantes_unicos: 0,
      tasa_completitud: 0,
      preguntas: [],
    };
  }

  const totalRespuestas =
    optionalNonNegativeNumber(payload, [
      'total_respuestas',
      'totalResponses',
      'total_responses',
      'total',
    ]) ?? 0;
  const preguntas = arrayFromUnknown(
    firstDefined(payload, ['preguntas', 'questions']),
  )
    .map((question, index) =>
      normalizeSummaryQuestion(question, index, totalRespuestas),
    )
    .filter(
      (question): question is SurveySummary['preguntas'][number] =>
        Boolean(question),
    );

  return {
    ...payload,
    total_respuestas: totalRespuestas,
    participantes_unicos:
      optionalNonNegativeNumber(payload, [
        'participantes_unicos',
        'participantesUnicos',
        'unique_participants',
      ]) ?? 0,
    tasa_completitud:
      optionalNonNegativeNumber(payload, [
        'tasa_completitud',
        'tasaCompletitud',
        'completion_rate',
      ]) ?? 0,
    preguntas,
  };
};

export const getSummary = async (
  id: number,
  filtros?: SurveyAnalyticsFilters,
  options?: ApiFetchOptions,
): Promise<SurveySummary> => {
  const payload = await callAdminSurveyEndpoint<unknown>(
    `${id}/analytics/resumen${buildQueryString(filtros)}`,
    options,
  );
  return normalizeSurveySummary(payload);
};

export const getTimeseries = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
  options?: ApiFetchOptions,
): Promise<SurveyTimeseriesPoint[]> =>
  callAdminSurveyEndpoint(`${id}/analytics/series${buildQueryString(filtros)}`, options);

const SURVEY_HEATMAP_METADATA_KEYS = [
  'headline',
  'legend',
  'empty_state',
  'recommended_action',
  'render_contract',
  'map',
  'map_experience',
  'category_layers',
  'ai_layers',
  'quality',
  'privacy',
  'privacy_mode',
  'coordinate_precision',
  'using_synthetic_points',
  'source',
  'provider',
] as const;

const buildSurveyHeatmapMetadata = (record: Record<string, unknown>): Record<string, unknown> | undefined => {
  const metadata: Record<string, unknown> = isRecord(record.metadata) ? { ...record.metadata } : {};

  SURVEY_HEATMAP_METADATA_KEYS.forEach((key) => {
    if (record[key] !== undefined && metadata[key] === undefined) {
      metadata[key] = record[key];
    }
  });

  return Object.keys(metadata).length ? metadata : undefined;
};

const normalizeSurveyAnalyticsHeatmap = (payload: unknown): SurveyAnalyticsHeatmap => {
  if (Array.isArray(payload)) {
    return {
      points: payload
        .map(normalizeHeatmapPoint)
        .filter((item): item is NonNullable<ReturnType<typeof normalizeHeatmapPoint>> =>
          Boolean(item?.lat !== undefined && item?.lng !== undefined),
        )
        .map((item) => item as SurveyHeatmapPoint),
    };
  }

  if (isRecord(payload)) {
    const rawPoints = firstDefined(payload, ['points', 'data', 'puntos', 'geo_points', 'heatmap_points']);
    const rawCells = firstDefined(payload, ['cells', 'celdas', 'heatmap_cells']);
    const points = arrayFromUnknown(rawPoints)
      .map(normalizeHeatmapPoint)
      .filter((item): item is NonNullable<ReturnType<typeof normalizeHeatmapPoint>> =>
        Boolean(item?.lat !== undefined && item?.lng !== undefined),
      )
      .map((item) => item as SurveyHeatmapPoint);
    const cells = arrayFromUnknown(rawCells)
      .map(normalizeHeatmapCell)
      .filter((item): item is NonNullable<ReturnType<typeof normalizeHeatmapCell>> => Boolean(item));

    return {
      ...payload,
      points,
      ...(cells.length || Array.isArray(rawCells) ? { cells } : {}),
      metadata: buildSurveyHeatmapMetadata(payload),
    };
  }

  return { points: [] };
};

export const getHeatmap = async (
  id: number,
  filtros?: SurveyAnalyticsFilters,
  options?: ApiFetchOptions,
): Promise<SurveyAnalyticsHeatmap> => {
  const payload = await callAdminSurveyEndpoint<unknown>(
    `${id}/analytics/heatmap${buildQueryString(filtros)}`,
    options,
  );
  return normalizeSurveyAnalyticsHeatmap(payload);
};


export const getSurveyForecast = (
  id: number,
  params?: { window_minutes?: number; horizon_minutes?: number },
  options?: ApiFetchOptions,
): Promise<SurveyForecast> =>
  callAdminSurveyEndpoint(`${id}/analytics/forecast${buildQueryString(params)}`, options);

export const getSurveyAlerts = (
  id: number,
  params?: { window_minutes?: number; min_activity?: number },
  options?: ApiFetchOptions,
): Promise<SurveyAlert[]> =>
  callAdminSurveyEndpoint(`${id}/analytics/alerts${buildQueryString(params)}`, options);

export const getSurveyBrief = (id: number, options?: ApiFetchOptions): Promise<SurveyBrief> =>
  callAdminSurveyEndpoint(`${id}/analytics/brief`, options);


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
  options?: ApiFetchOptions,
): Promise<SurveySegmentsCompare> =>
  callAdminSurveyEndpoint(`${id}/analytics/segments/compare${buildQueryString(params)}`, options);


export const getSurveySegmentsSuggestions = (
  id: number,
  params?: { limit?: number },
  options?: ApiFetchOptions,
): Promise<SurveySegmentsSuggestions> =>
  callAdminSurveyEndpoint(`${id}/analytics/segments/suggestions${buildQueryString(params)}`, options);

export const getSurveyAnomalies = (
  id: number,
  params?: { burst_window_minutes?: number; burst_threshold?: number },
  options?: ApiFetchOptions,
): Promise<SurveyAnomalies> =>
  callAdminSurveyEndpoint(`${id}/analytics/anomalies${buildQueryString(params)}`, options);

export const getSurveyDashboardBundle = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
  options?: ApiFetchOptions,
): Promise<SurveyDashboardBundle> =>
  callAdminSurveyEndpoint<SurveyDashboardBundle>(`${id}/analytics/dashboard${buildQueryString(filtros)}`, options).then((bundle) => {
    const heatmap = bundle?.modules?.heatmap;
    if (!heatmap) return bundle;
    return {
      ...bundle,
      modules: {
        ...bundle.modules,
        heatmap: normalizeSurveyAnalyticsHeatmap(heatmap),
      },
    };
  });

export const downloadExportCsv = async (
  id: number,
  filtros?: SurveyAnalyticsFilters,
  options?: ApiFetchOptions,
): Promise<Blob> => {
  const responseText = await callAdminSurveyEndpoint<string>(
    `${id}/analytics/export${buildQueryString(filtros)}`,
    {
      method: 'GET',
      headers: { Accept: 'text/csv' },
      ...options,
    },
  );
  return new Blob([responseText], { type: 'text/csv;charset=utf-8' });
};

export const createSnapshot = (
  id: number,
  payload: SnapshotCreatePayload,
  options?: ApiFetchOptions,
): Promise<SurveySnapshot> =>
  callAdminSurveyEndpoint(`${id}/snapshot`, {
    method: 'POST',
    body: payload,
    ...options,
  });

export const simulateSnapshotAnchor = (
  id: number,
  snapshotId: number,
  options?: ApiFetchOptions,
): Promise<SnapshotSimulationResponse> =>
  callAdminSurveyEndpoint(`${id}/simulate/${snapshotId}`, {
    method: 'POST',
    body: { chain: 'polygon' },
    ...options,
  });

/** @deprecated This operation creates a local simulation; it does not publish externally. */
export const publishSnapshot = simulateSnapshotAnchor;

export const verifyResponse = (
  id: number,
  snapshotId: number,
  respuestaId: number,
  options?: ApiFetchOptions,
): Promise<SnapshotVerificationResult> =>
  callAdminSurveyEndpoint(
    `${id}/${snapshotId}/verify${buildQueryString({ respuesta_id: respuestaId })}`,
    { method: 'GET', ...options },
  );

export const listSnapshots = async (id: number, options?: ApiFetchOptions): Promise<SurveySnapshot[]> => {
  const response = await callAdminSurveyEndpoint<SurveySnapshotListResponse>(`${id}/snapshots`, options);
  if (!response || !Array.isArray(response.snapshots)) {
    throw new Error('El backend devolvio un contrato de snapshots inesperado.');
  }
  return response.snapshots;
};

export const listSurveyResponses = (
  id: number,
  params?: SurveyResponseFilters,
  options?: ApiFetchOptions,
): Promise<SurveyResponseList> =>
  callAdminSurveyEndpoint(`${id}/respuestas${buildQueryString(params as QueryParams)}`, options);
