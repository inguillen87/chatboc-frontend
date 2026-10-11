import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/queryKeys';
import type { SurveyDashboardBundle, SurveyPublic, SurveySummary } from '@/types/encuestas';
import { ApiError } from '@/utils/api';

vi.mock('@/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config')>()),
  ENABLE_SURVEY_ANALYTICS_FALLBACK: true,
}));
vi.mock('@/api/encuestas', () => ({
  downloadExportCsv: vi.fn(),
  getSurveyDashboardBundle: vi.fn(),
  getHeatmap: vi.fn(),
  getSummary: vi.fn(),
  getTimeseries: vi.fn(),
}));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: null }) }));

import { downloadExportCsv, getSurveyDashboardBundle, getHeatmap, getSummary, getTimeseries } from '@/api/encuestas';
import { useSurveyAnalytics } from './useSurveyAnalytics';

const summary: SurveySummary = {
  total_respuestas: 8,
  participantes_unicos: 8,
  tasa_completitud: 100,
  preguntas: [],
};
const bundle: SurveyDashboardBundle = {
  modules: { summary, timeseries: [], heatmap: { points: [] } },
  kpis: { total: 8 },
};
const survey: SurveyPublic = {
  id: 45, slug: 'consulta', titulo: 'Consulta', tipo: 'sondeo',
  inicio_at: '2026-07-01T00:00:00Z', fin_at: '2026-07-31T00:00:00Z',
  politica_unicidad: 'libre',
  preguntas: [{ id: 1, orden: 1, tipo: 'opcion_unica', texto: 'Prioridad', obligatoria: true,
    opciones: [{ id: 1, orden: 1, texto: 'Opción' }] }],
};
const setup = (cached = false) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (cached) {
    client.setQueryData(queryKeys.surveys.analytics('dashboard', 45, 'tenant-a', {}), bundle);
    client.setQueryData(queryKeys.surveys.analytics('summary', 45, 'tenant-a', {}), summary);
    client.setQueryData(queryKeys.surveys.analytics('timeseries', 45, 'tenant-a', {}), []);
    client.setQueryData(queryKeys.surveys.analytics('heatmap', 45, 'tenant-a', {}), { points: [] });
  }
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSummary).mockResolvedValue(summary);
  vi.mocked(getTimeseries).mockResolvedValue([]);
  vi.mocked(getHeatmap).mockResolvedValue({ points: [] });
  vi.mocked(downloadExportCsv).mockResolvedValue(new Blob(['csv']));
});

describe('survey analytics authoritative access rejection', () => {
  it.each([401, 403])('withdraws cached modules after a dashboard %s instead of masking the error', async (status) => {
    const denied = new ApiError('Acceso no disponible', status, { reason_code: 'survey_access_denied' });
    vi.mocked(getSurveyDashboardBundle).mockRejectedValue(denied);
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), {
      wrapper: setup(true).wrapper,
    });
    await waitFor(() => expect(result.current.error).toBe('Acceso no disponible'));
    expect(result.current.summary).toBeUndefined();
    expect(result.current.timeseries).toEqual([]);
    expect(result.current.heatmap).toEqual([]);
    expect(result.current.heatmapPayload).toBeUndefined();
    expect(result.current.heatmapMeta).toBeUndefined();
    expect(result.current.dashboardBundle).toBeUndefined();
    expect(result.current.executiveSummary).toBeUndefined();
    expect(getSummary).not.toHaveBeenCalled();
    expect(getTimeseries).not.toHaveBeenCalled();
    expect(getHeatmap).not.toHaveBeenCalled();
  });

  it('does not replace a denial with legacy endpoints or a synthetic demonstration', async () => {
    vi.mocked(getSurveyDashboardBundle).mockRejectedValue(new ApiError('Sin permiso', 403));
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, {
      tenantSlug: 'tenant-a', fallbackSurvey: survey, fallbackCount: 8,
    }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    expect(result.current.summary).toBeUndefined();
    expect(result.current.provenance.synthetic).toBe(false);
    expect(result.current.provenance.affected_modules).toEqual([]);
    expect(getSummary).not.toHaveBeenCalled();
    expect(getTimeseries).not.toHaveBeenCalled();
    expect(getHeatmap).not.toHaveBeenCalled();
    await act(async () => { await expect(result.current.exportCsv()).rejects.toMatchObject({ status: 403 }); });
    expect(downloadExportCsv).not.toHaveBeenCalled();
  });

  it.each([404, 503])('preserves compatible individual modules after a dashboard %s', async (status) => {
    vi.mocked(getSurveyDashboardBundle).mockRejectedValue(new ApiError('Dashboard unavailable', status));
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), {
      wrapper: setup().wrapper,
    });
    await waitFor(() => expect(result.current.summary?.total_respuestas).toBe(8));
    expect(result.current.error).toBeNull();
    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getTimeseries).toHaveBeenCalledTimes(1);
    expect(getHeatmap).toHaveBeenCalledTimes(1);
  });

  it('recovers only after a successful fresh dashboard request', async () => {
    vi.mocked(getSurveyDashboardBundle).mockRejectedValue(new ApiError('Sin permiso', 403));
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), {
      wrapper: setup(true).wrapper,
    });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    vi.mocked(getSurveyDashboardBundle).mockResolvedValue(bundle);
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.summary?.total_respuestas).toBe(8);
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('does not carry one organization denial into the next organization', async () => {
    vi.mocked(getSurveyDashboardBundle).mockImplementation(async (_id, _filters, options) => {
      if (options?.tenantSlug === 'tenant-a') throw new ApiError('Sin permiso', 403);
      return bundle;
    });
    const { result, rerender } = renderHook(({ tenant }) => useSurveyAnalytics(45, {}, { tenantSlug: tenant }), {
      wrapper: setup().wrapper, initialProps: { tenant: 'tenant-a' },
    });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    rerender({ tenant: 'tenant-b' });
    await waitFor(() => expect(result.current.summary?.total_respuestas).toBe(8));
    expect(result.current.error).toBeNull();
  });

  it('keeps a legacy result hidden when its in-flight response finishes after access is rejected', async () => {
    let resolveSummary!: (value: SurveySummary) => void;
    const pendingSummary = new Promise<SurveySummary>((resolve) => { resolveSummary = resolve; });
    vi.mocked(getSummary).mockReturnValue(pendingSummary);
    vi.mocked(getSurveyDashboardBundle).mockRejectedValueOnce(new ApiError('Unavailable', 503))
      .mockRejectedValue(new ApiError('Sin permiso', 403));
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), {
      wrapper: setup().wrapper,
    });
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    await act(async () => { resolveSummary(summary); await pendingSummary; });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    expect(result.current.summary).toBeUndefined();
    expect(result.current.dashboardBundle).toBeUndefined();
  });

  it.each([404, 503, null])('keeps a rejection after a subsequent non-authoritative failure: %s', async (status) => {
    vi.mocked(getSurveyDashboardBundle).mockRejectedValueOnce(new ApiError('Sin permiso', 403))
      .mockRejectedValue(status === null ? new Error('Network unavailable') : new ApiError('Unavailable', status));
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), {
      wrapper: setup(true).wrapper,
    });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    await act(async () => { await result.current.refresh(); });
    expect(getSurveyDashboardBundle).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBe('Sin permiso');
    expect(result.current.summary).toBeUndefined();
    expect(getSummary).not.toHaveBeenCalled();
    await act(async () => { await expect(result.current.exportCsv()).rejects.toMatchObject({ status: 403 }); });
    expect(downloadExportCsv).not.toHaveBeenCalled();
  });

  it('keeps denial across a filter change even when that filter has older cached data', async () => {
    const { client, wrapper } = setup(true);
    client.setQueryData(queryKeys.surveys.analytics('dashboard', 45, 'tenant-a', { canal: 'web' }), bundle);
    let finish!: (value: SurveyDashboardBundle) => void;
    const pending = new Promise<SurveyDashboardBundle>((resolve) => { finish = resolve; });
    vi.mocked(getSurveyDashboardBundle).mockRejectedValueOnce(new ApiError('Sin permiso', 403)).mockReturnValue(pending);
    const { result } = renderHook(() => useSurveyAnalytics(45, {}, {
      tenantSlug: 'tenant-a', fallbackSurvey: survey, fallbackCount: 3,
    }), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('Sin permiso'));
    act(() => result.current.setFilters({ canal: 'web' }));
    await waitFor(() => expect(getSurveyDashboardBundle).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBe('Sin permiso');
    expect(result.current.summary).toBeUndefined();
    expect(result.current.provenance.synthetic).toBe(false);
    await act(async () => { finish(bundle); await pending; });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.summary?.total_respuestas).toBe(8);
  });

  it('retains rejection after remounting with the same client and older cached metrics', async () => {
    const { wrapper } = setup(true);
    vi.mocked(getSurveyDashboardBundle).mockRejectedValueOnce(new ApiError('Sin permiso', 403))
      .mockRejectedValue(new ApiError('Unavailable', 503));
    const first = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), { wrapper });
    await waitFor(() => expect(first.result.current.error).toBe('Sin permiso'));
    first.unmount();
    const second = renderHook(() => useSurveyAnalytics(45, {}, { tenantSlug: 'tenant-a' }), { wrapper });
    await waitFor(() => expect(getSurveyDashboardBundle).toHaveBeenCalledTimes(2));
    expect(second.result.current.error).toBe('Sin permiso');
    expect(second.result.current.summary).toBeUndefined();
  });

  it('does not recover from another observer request already in flight when access was rejected', async () => {
    const { wrapper } = setup();
    let finish!: (value: SurveyDashboardBundle) => void;
    const pending = new Promise<SurveyDashboardBundle>((resolve) => { finish = resolve; });
    vi.mocked(getSurveyDashboardBundle).mockImplementation((_id, filters) =>
      filters?.canal === 'web' ? pending : Promise.reject(new ApiError('Sin permiso', 403)));
    const first = renderHook(() => useSurveyAnalytics(45, { canal: 'web' }, { tenantSlug: 'tenant-a' }), { wrapper });
    await waitFor(() => expect(getSurveyDashboardBundle).toHaveBeenCalledTimes(1));
    const second = renderHook(() => useSurveyAnalytics(45, { canal: 'whatsapp' }, { tenantSlug: 'tenant-a' }), { wrapper });
    await waitFor(() => expect(second.result.current.error).toBe('Sin permiso'));
    await act(async () => { finish(bundle); await pending; });
    await waitFor(() => expect(first.result.current.error).toBe('Sin permiso'));
    expect(first.result.current.summary).toBeUndefined();
    expect(second.result.current.summary).toBeUndefined();
    vi.mocked(getSurveyDashboardBundle).mockResolvedValue(bundle);
    await act(async () => { await first.result.current.refresh(); });
    await waitFor(() => expect(first.result.current.summary?.total_respuestas).toBe(8));
  });

  it('ignores an older authorization rejection after a newer request has verified access', async () => {
    const { wrapper } = setup();
    let rejectOld!: (error: ApiError) => void;
    const pending = new Promise<SurveyDashboardBundle>((_resolve, reject) => { rejectOld = reject; });
    vi.mocked(getSurveyDashboardBundle).mockImplementation((_id, filters) =>
      filters?.canal === 'web' ? pending : Promise.resolve(bundle));
    renderHook(() => useSurveyAnalytics(45, { canal: 'web' }, { tenantSlug: 'tenant-a' }), { wrapper });
    await waitFor(() => expect(getSurveyDashboardBundle).toHaveBeenCalledTimes(1));
    const second = renderHook(() => useSurveyAnalytics(45, { canal: 'whatsapp' }, { tenantSlug: 'tenant-a' }), { wrapper });
    await waitFor(() => expect(second.result.current.summary?.total_respuestas).toBe(8));
    await act(async () => { rejectOld(new ApiError('Rechazo anterior', 403)); await pending.catch(() => {}); });
    expect(second.result.current.error).toBeNull();
    expect(second.result.current.summary?.total_respuestas).toBe(8);
  });
});
