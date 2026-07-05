import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  downloadExportCsv,
  getSurveyDashboardBundle,
  getHeatmap,
  getSummary,
  getTimeseries,
} from '@/api/encuestas';
import { ENABLE_SURVEY_ANALYTICS_FALLBACK } from '@/config';
import type {
  SurveyAnalyticsFilters,
  SurveyAnalyticsHeatmap,
  SurveyDashboardBundle,
  SurveyExecutiveSummary,
  SurveyHeatmapPoint,
  SurveyPublic,
  SurveyAdmin,
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import {
  buildSurveyDemoAnalyticsFromDataset,
  generateSurveyDemoDataset,
  mergeSurveyAnalytics,
  pickHeatmap,
  pickTimeseries,
  type SurveyDemoDataset,
} from '@/utils/surveyAnalyticsFallback';

interface UseSurveyAnalyticsResult {
  summary?: SurveySummary;
  timeseries?: SurveyTimeseriesPoint[];
  heatmap?: SurveyHeatmapPoint[];
  heatmapPayload?: SurveyAnalyticsHeatmap;
  heatmapMeta?: SurveyAnalyticsHeatmap['metadata'];
  dashboardBundle?: SurveyDashboardBundle;
  executiveSummary?: SurveyExecutiveSummary;
  isLoading: boolean;
  error: string | null;
  filters: SurveyAnalyticsFilters;
  setFilters: (next: SurveyAnalyticsFilters) => void;
  exportCsv: () => Promise<Blob>;
  isExporting: boolean;
}

const sanitizeBoundingBox = (value: SurveyAnalyticsFilters['bbox']): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    const segments = value.split(',').map((segment) => Number(segment.trim()));
    if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment))) {
      return undefined;
    }
    return segments.map((segment) => segment.toFixed(6)).join(',');
  }

  if (Array.isArray(value) && value.length === 4) {
    const segments = value.map((segment) => Number(segment));
    if (segments.some((segment) => !Number.isFinite(segment))) {
      return undefined;
    }
    return segments.map((segment) => segment.toFixed(6)).join(',');
  }

  return undefined;
};

const normalizeFilters = (filters: SurveyAnalyticsFilters): SurveyAnalyticsFilters => {
  const normalized: Partial<SurveyAnalyticsFilters> = {};

  (Object.entries(filters) as Array<[keyof SurveyAnalyticsFilters, unknown]>).forEach(([key, rawValue]) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return;
    }

    if (key === 'bbox') {
      const bboxValue = sanitizeBoundingBox(rawValue as SurveyAnalyticsFilters['bbox']);
      if (bboxValue) {
        normalized.bbox = bboxValue;
      }
      return;
    }

    normalized[key] = rawValue as never;
  });

  return normalized as SurveyAnalyticsFilters;
};

interface UseSurveyAnalyticsOptions {
  fallbackSurvey?: SurveyPublic | SurveyAdmin | null;
  fallbackCount?: number;
  fallbackScenario?: string | null;
}

export function useSurveyAnalytics(
  id?: number | null,
  initialFilters: SurveyAnalyticsFilters = {},
  options: UseSurveyAnalyticsOptions = {},
): UseSurveyAnalyticsResult {
  const [filters, setFiltersState] = useState<SurveyAnalyticsFilters>(normalizeFilters(initialFilters));
  const queryClient = useQueryClient();
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const allowFallback = ENABLE_SURVEY_ANALYTICS_FALLBACK;
  const fallbackSurvey = allowFallback ? options.fallbackSurvey ?? null : null;
  const fallbackCount = allowFallback ? options.fallbackCount : undefined;
  const fallbackScenario = allowFallback ? options.fallbackScenario ?? null : null;

  const dashboardQuery = useQuery({
    queryKey: ['survey-analytics-dashboard', normalizedId, normalizedFilters],
    enabled: normalizedId !== null,
    retry: false,
    queryFn: () =>
      normalizedId !== null ? getSurveyDashboardBundle(normalizedId, normalizedFilters) : Promise.reject('No id provided'),
  });

  const [summaryQuery, timeseriesQuery, heatmapQuery] = useQueries({
    queries: [
      {
        queryKey: ['survey-analytics-summary', normalizedId, normalizedFilters],
        enabled:
          normalizedId !== null &&
          (dashboardQuery.isError || !dashboardQuery.data?.modules?.summary || !dashboardQuery.isFetched),
        queryFn: () =>
          normalizedId !== null ? getSummary(normalizedId, normalizedFilters) : Promise.reject('No id provided'),
      },
      {
        queryKey: ['survey-analytics-timeseries', normalizedId, normalizedFilters],
        enabled:
          normalizedId !== null &&
          (dashboardQuery.isError || !dashboardQuery.data?.modules?.timeseries || !dashboardQuery.isFetched),
        queryFn: () =>
          normalizedId !== null ? getTimeseries(normalizedId, normalizedFilters) : Promise.reject('No id provided'),
      },
      {
        queryKey: ['survey-analytics-heatmap', normalizedId, normalizedFilters],
        enabled:
          normalizedId !== null &&
          (dashboardQuery.isError || !dashboardQuery.data?.modules?.heatmap?.points || !dashboardQuery.isFetched),
        queryFn: () =>
          normalizedId !== null ? getHeatmap(normalizedId, normalizedFilters) : Promise.reject('No id provided'),
      },
    ],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (normalizedId === null) throw new Error('No survey id provided');
      return downloadExportCsv(normalizedId, normalizedFilters);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-analytics-summary', normalizedId] });
    },
  });

  const fallbackDataset = useMemo<SurveyDemoDataset | null>(() => {
    if (!fallbackSurvey) return null;
    try {
      return generateSurveyDemoDataset(fallbackSurvey, {
        count: fallbackCount,
        scenario: fallbackScenario,
      });
    } catch (error) {
      console.error('[surveyAnalytics] No se pudo generar el dataset demo', error);
      return null;
    }
  }, [fallbackSurvey, fallbackCount, fallbackScenario]);

  const fallbackAnalytics = useMemo(() => {
    if (!fallbackSurvey || !fallbackDataset) return null;
    try {
      return buildSurveyDemoAnalyticsFromDataset(fallbackSurvey, fallbackDataset, normalizedFilters);
    } catch (error) {
      console.error('[surveyAnalytics] No se pudo construir la analítica demo', error);
      return null;
    }
  }, [fallbackSurvey, fallbackDataset, normalizedFilters]);

  const summaryData = useMemo(
    () => mergeSurveyAnalytics(dashboardQuery.data?.modules?.summary ?? summaryQuery.data, fallbackAnalytics?.summary),
    [dashboardQuery.data?.modules?.summary, summaryQuery.data, fallbackAnalytics?.summary],
  );

  const timeseriesDataRaw = useMemo(
    () => pickTimeseries(dashboardQuery.data?.modules?.timeseries ?? timeseriesQuery.data, fallbackAnalytics?.timeseries),
    [dashboardQuery.data?.modules?.timeseries, timeseriesQuery.data, fallbackAnalytics?.timeseries],
  );

  const fallbackHeatmapPayload = useMemo<SurveyAnalyticsHeatmap | undefined>(() => {
    if (!fallbackAnalytics?.heatmap) return undefined;
    return {
      points: fallbackAnalytics.heatmap,
      metadata: {
        source: 'frontend_demo_fallback',
        using_synthetic_points: true,
        map: {
          render_ready: false,
          provider_hint: 'maplibre',
          fallback_provider: 'maplibre',
          available_providers: ['maplibre'],
        },
        render_contract: {
          state: 'demo_fallback',
          preferred_visualization: 'summary_only',
          reason: 'backend_heatmap_unavailable',
        },
      },
      render_contract: {
        state: 'demo_fallback',
        preferred_visualization: 'summary_only',
        reason: 'backend_heatmap_unavailable',
      },
      using_synthetic_points: true,
    };
  }, [fallbackAnalytics?.heatmap]);

  const heatmapDataRaw = useMemo(
    () => pickHeatmap(dashboardQuery.data?.modules?.heatmap?.points ?? heatmapQuery.data?.points, fallbackHeatmapPayload?.points),
    [dashboardQuery.data?.modules?.heatmap?.points, heatmapQuery.data?.points, fallbackHeatmapPayload?.points],
  );

  const timeseriesData = useMemo(
    () => (Array.isArray(timeseriesDataRaw) ? timeseriesDataRaw : []),
    [timeseriesDataRaw],
  );

  const heatmapData = useMemo(
    () => (Array.isArray(heatmapDataRaw) ? heatmapDataRaw : []),
    [heatmapDataRaw],
  );

  const heatmapMeta = useMemo(
    () => dashboardQuery.data?.modules?.heatmap?.metadata ?? heatmapQuery.data?.metadata ?? fallbackHeatmapPayload?.metadata,
    [dashboardQuery.data?.modules?.heatmap?.metadata, heatmapQuery.data?.metadata, fallbackHeatmapPayload?.metadata],
  );

  const heatmapPayload = useMemo<SurveyAnalyticsHeatmap | undefined>(() => {
    const backendHeatmap = dashboardQuery.data?.modules?.heatmap ?? heatmapQuery.data;
    if (backendHeatmap) return backendHeatmap;
    return fallbackHeatmapPayload;
  }, [dashboardQuery.data?.modules?.heatmap, heatmapQuery.data, fallbackHeatmapPayload]);

  const dashboardBundle = useMemo(
    () => dashboardQuery.data,
    [dashboardQuery.data],
  );

  const executiveSummary = useMemo(
    () => dashboardQuery.data?.executive_summary,
    [dashboardQuery.data?.executive_summary],
  );

  const effectiveError = useMemo(() => {
    const fallbackRecovered = summaryQuery.isSuccess || timeseriesQuery.isSuccess || heatmapQuery.isSuccess;
    if (dashboardQuery.isError && fallbackRecovered) {
      return null;
    }

    const safeTimeseries = Array.isArray(timeseriesData) ? timeseriesData : [];
    const safeHeatmap = Array.isArray(heatmapData) ? heatmapData : [];
    const hasMeaningfulResult = Boolean(summaryData) || safeTimeseries.length > 0 || safeHeatmap.length > 0;
    if (hasMeaningfulResult) {
      return null;
    }

    const errorCandidate =
      summaryQuery.error ??
      timeseriesQuery.error ??
      heatmapQuery.error ??
      dashboardQuery.error ??
      null;

    return errorCandidate ? getErrorMessage(errorCandidate) : null;
  }, [
    dashboardQuery.isError,
    dashboardQuery.error,
    summaryQuery.isSuccess,
    summaryQuery.error,
    timeseriesQuery.isSuccess,
    timeseriesQuery.error,
    heatmapQuery.isSuccess,
    heatmapQuery.error,
    summaryData,
    timeseriesData,
    heatmapData,
  ]);

  return {
    summary: summaryData ?? undefined,
    timeseries: timeseriesData,
    heatmap: heatmapData,
    heatmapPayload,
    heatmapMeta,
    dashboardBundle,
    executiveSummary,
    isLoading: dashboardQuery.isLoading || summaryQuery.isLoading || timeseriesQuery.isLoading || heatmapQuery.isLoading,
    error: effectiveError,
    filters: normalizedFilters,
    setFilters: (next: SurveyAnalyticsFilters) => setFiltersState(normalizeFilters(next)),
    exportCsv: async () => exportMutation.mutateAsync(),
    isExporting: exportMutation.isPending,
  };
}
