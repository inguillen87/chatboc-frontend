import { panelApi, publicApi } from '@/api/v2/client';
import type { SurveyQuestionDraft, SurveyQuestionType, SurveyV2 } from './surveyTypes';

export const saveSurveyDraftV2 = (payload: { title: string; description?: string; questions: SurveyQuestionDraft[] }) =>
  panelApi.post('/api/v2/surveys/draft', payload, { legacyFallbackPath: '/municipal/surveys' });

type PrimitiveParam = string | number | boolean | undefined | null;
type QueryParams = Record<string, PrimitiveParam | PrimitiveParam[]>;

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

const buildQueryString = (params?: QueryParams) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => (item === undefined || item === null || item === '' ? null : String(item)))
        .filter((item): item is string => Boolean(item));
      if (normalized.length) search.set(key, normalized.join(','));
      return;
    }
    search.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const normalizeQuestionType = (value: unknown): SurveyQuestionType => {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  if (normalized === 'multi' || normalized === 'multiple' || normalized === 'multiple_choice') return 'multi';
  if (normalized === 'rating') return 'rating';
  if (normalized === 'text' || normalized === 'open' || normalized === 'abierta') return 'text';
  if (normalized === 'nps') return 'nps';
  if (normalized === 'ranking') return 'ranking';
  if (normalized === 'location' || normalized === 'ubicacion') return 'location';
  return 'single';
};

const normalizeQuestion = (value: unknown, index = 0): SurveyQuestionDraft | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'question_id', 'key'])) ?? `question_${index + 1}`;
  const optionsSource = Array.isArray(value.options)
    ? value.options
    : Array.isArray(value.opciones)
      ? value.opciones
      : [];
  return {
    id,
    title: asString(getFirst(value, ['title', 'label', 'text', 'pregunta'])) ?? '',
    type: normalizeQuestionType(getFirst(value, ['type', 'tipo'])),
    options: optionsSource.length
      ? optionsSource
          .map((option) => {
            if (!isRecord(option)) return null;
            return {
              id: asString(getFirst(option, ['id', 'key'])) ?? undefined,
              label: asString(getFirst(option, ['label', 'title', 'text', 'opcion'])) ?? undefined,
              value: (option.value as string | number | undefined) ?? asString(getFirst(option, ['id', 'key', 'label'])),
            };
          })
          .filter((option): option is { id?: string; label?: string; value?: string | number } => Boolean(option))
      : undefined,
  };
};

const normalizeSurvey = (value: unknown, index = 0): SurveyV2 | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'survey_id', 'slug', 'public_token'])) ?? `survey_${index + 1}`;
  const questionsSource =
    getFirst(value, ['questions', 'preguntas']) ??
    (isRecord(value.schema) ? getFirst(value.schema, ['questions', 'preguntas']) : undefined);
  return {
    id,
    title: asString(getFirst(value, ['title', 'titulo', 'name'])) ?? id,
    description: asString(getFirst(value, ['description', 'descripcion'])) ?? null,
    status: asString(getFirst(value, ['status', 'estado'])) ?? null,
    public_token: asString(getFirst(value, ['public_token', 'token_publico', 'slug'])) ?? null,
    opens_at: asString(getFirst(value, ['opens_at', 'inicio_at'])) ?? null,
    closes_at: asString(getFirst(value, ['closes_at', 'fin_at'])) ?? null,
    questions: Array.isArray(questionsSource)
      ? questionsSource.map(normalizeQuestion).filter((item): item is SurveyQuestionDraft => Boolean(item))
      : [],
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

export const normalizeSurveyListV2 = (response: unknown) => ({
  contract_version: isRecord(response) ? asString(response.contract_version) : undefined,
  request_id: isRecord(response) ? asString(response.request_id) : undefined,
  items: firstArray(response, ['items', 'surveys', 'data'])
    .map(normalizeSurvey)
    .filter((item): item is SurveyV2 => Boolean(item)),
  pagination: isRecord(response) && isRecord(response.pagination) ? response.pagination : undefined,
  raw: response,
});

export const listSurveysV2 = async (tenantSlug?: string | null, params?: QueryParams) => {
  const response = await panelApi.get<unknown>(`/api/v2/surveys${buildQueryString(params)}`, { tenantSlug });
  return normalizeSurveyListV2(response);
};

export const createSurveyV2 = async (
  payload: { title: string; description?: string; questions: SurveyQuestionDraft[]; [key: string]: unknown },
  tenantSlug?: string | null,
) => {
  const response = await panelApi.post<unknown>('/api/v2/surveys', payload, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const getSurveyV2 = async (surveyId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}`, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const updateSurveyV2 = async (
  surveyId: string | number,
  payload: Partial<{ title: string; description: string; questions: SurveyQuestionDraft[]; opens_at: string; closes_at: string }>,
  tenantSlug?: string | null,
) => {
  const response = await panelApi.patch<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}`, payload, {
    tenantSlug,
  });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const publishSurveyV2 = async (surveyId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}/publish`, {}, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const closeSurveyV2 = async (surveyId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}/close`, {}, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const getSurveyAnalyticsV2 = (surveyId: string | number, tenantSlug?: string | null) =>
  panelApi.get<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}/analytics`, { tenantSlug });

export const getPublicSurveyV2 = async (publicToken: string, tenantSlug?: string | null) => {
  const response = await publicApi.get<unknown>(`/api/v2/public/surveys/${encodeURIComponent(publicToken)}`, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const respondPublicSurveyV2 = (
  publicToken: string,
  payload: { answers?: unknown[]; respuestas?: unknown[]; anon_id?: string; source?: string; channel?: string; canal?: string; [key: string]: unknown },
  tenantSlug?: string | null,
) =>
  publicApi.post<{
    ok?: boolean;
    response_id?: string | number;
    request_id?: string;
    contract_version?: string;
  }>(`/api/v2/public/surveys/${encodeURIComponent(publicToken)}/respond`, payload, { tenantSlug });
