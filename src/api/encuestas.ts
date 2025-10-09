import { apiFetch } from '@/utils/api';
import {
  PublicResponsePayload,
  SurveyAdmin,
  SurveyAnalyticsFilters,
  SurveyDraftPayload,
  SurveyHeatmapPoint,
  SurveyListResponse,
  SurveyPublic,
  SurveySnapshot,
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';

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

const ensureSurveyPublic = (payload: unknown): SurveyPublic => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Formato inválido: la encuesta no tiene el formato esperado.');
  }
  const survey = payload as Record<string, unknown>;
  if (typeof survey.slug !== 'string' || !survey.slug.trim()) {
    throw new Error('Formato inválido: falta el identificador de la encuesta.');
  }
  if (typeof survey.titulo !== 'string' || !survey.titulo.trim()) {
    throw new Error('Formato inválido: falta el título de la encuesta.');
  }
  return payload as SurveyPublic;
};

const ensureSurveyPublicList = (payload: unknown): SurveyPublic[] => {
  if (!Array.isArray(payload)) {
    throw new Error('Formato inválido: esperábamos una lista de encuestas.');
  }
  return payload.map(ensureSurveyPublic);
};

export const listPublicSurveys = async (): Promise<SurveyPublic[]> => {
  const payload = await apiFetch<unknown>('/api/public/encuestas');
  return ensureSurveyPublicList(payload);
};

export const getPublicSurvey = async (slug: string): Promise<SurveyPublic> => {
  const payload = await apiFetch<unknown>(`/api/public/encuestas/${slug}`);
  return ensureSurveyPublic(payload);
};

export const postPublicResponse = (
  slug: string,
  payload: PublicResponsePayload,
): Promise<{ ok: boolean; id?: number }> =>
  apiFetch(`/api/public/encuestas/${slug}/respuestas`, {
    method: 'POST',
    body: payload,
    omitCredentials: true,
    isWidgetRequest: true,
  });

export const adminListSurveys = (params?: QueryParams): Promise<SurveyListResponse> =>
  apiFetch(`/admin/encuestas${buildQueryString(params)}`);

export const adminCreateSurvey = (payload: SurveyDraftPayload): Promise<SurveyAdmin> =>
  apiFetch('/admin/encuestas', {
    method: 'POST',
    body: payload,
  });

export const adminUpdateSurvey = (id: number, payload: SurveyDraftPayload): Promise<SurveyAdmin> =>
  apiFetch(`/admin/encuestas/${id}`, {
    method: 'PUT',
    body: payload,
  });

export const adminGetSurvey = (id: number): Promise<SurveyAdmin> =>
  apiFetch(`/admin/encuestas/${id}`);

export const adminPublishSurvey = (id: number): Promise<SurveyAdmin> =>
  apiFetch(`/admin/encuestas/${id}/publicar`, {
    method: 'POST',
  });

export const getSummary = (id: number, filtros?: SurveyAnalyticsFilters): Promise<SurveySummary> =>
  apiFetch(`/admin/encuestas/${id}/analytics/resumen${buildQueryString(filtros)}`);

export const getTimeseries = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<SurveyTimeseriesPoint[]> =>
  apiFetch(`/admin/encuestas/${id}/analytics/series${buildQueryString(filtros)}`);

export const getHeatmap = (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<SurveyHeatmapPoint[]> =>
  apiFetch(`/admin/encuestas/${id}/analytics/heatmap${buildQueryString(filtros)}`);

export const downloadExportCsv = async (
  id: number,
  filtros?: SurveyAnalyticsFilters,
): Promise<Blob> => {
  const responseText = await apiFetch<string>(
    `/admin/encuestas/${id}/analytics/export${buildQueryString(filtros)}`,
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
  apiFetch(`/admin/encuestas/${id}/snapshots`, {
    method: 'POST',
    body: payload ?? {},
  });

export const publishSnapshot = (
  id: number,
  snapshotId: number,
): Promise<SurveySnapshot> =>
  apiFetch(`/admin/encuestas/${id}/snapshots/${snapshotId}/publicar`, {
    method: 'POST',
  });

export const verifyResponse = (
  id: number,
  snapshotId: number,
  respuestaId: number,
): Promise<{ ok: boolean; valido: boolean }> =>
  apiFetch(`/admin/encuestas/${id}/snapshots/${snapshotId}/verificar`, {
    method: 'POST',
    body: { respuesta_id: respuestaId },
  });

export const listSnapshots = (id: number): Promise<SurveySnapshot[]> =>
  apiFetch(`/admin/encuestas/${id}/snapshots`);
