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
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import type {
  SurveyAnalyticsFilters,
  SurveyAnalyticsHeatmap,
  SurveyAnalyticsProvenance,
  SurveyDashboardBundle,
  SurveyExecutiveSummary,
  SurveyHeatmapPoint,
  SurveyPublic,
  SurveyAdmin,
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
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
  provenance: SurveyAnalyticsProvenance;
  isLoading: boolean;
  error: string | null;
  filters: SurveyAnalyticsFilters;
  setFilters: (next: SurveyAnalyticsFilters) => void;
  exportCsv: () => Promise<Blob>;
  isExporting: boolean;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
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

const summaryUsesFallback = (primary?: SurveySummary, fallback?: SurveySummary) => {
  if (!fallback) return false;
  if (!primary) return true;
  const primaryRecord = primary as unknown as Record<string, unknown>;
  return (
    primaryRecord.total_respuestas == null ||
    primaryRecord.participantes_unicos == null ||
    typeof primaryRecord.tasa_completitud !== 'number' ||
    (!Array.isArray(primary.preguntas) && fallback.preguntas.length > 0) ||
    (Array.isArray(primary.preguntas) && primary.preguntas.length === 0 && fallback.preguntas.length > 0) ||
    (!Array.isArray(primary.canales) && Boolean(fallback.canales?.length)) ||
    (Array.isArray(primary.canales) && primary.canales.length === 0 && Boolean(fallback.canales?.length)) ||
    (!Array.isArray(primary.utms) && Boolean(fallback.utms?.length)) ||
    (Array.isArray(primary.utms) && primary.utms.length === 0 && Boolean(fallback.utms?.length)) ||
    (!primary.demografia && Boolean(fallback.demografia))
  );
};

interface UseSurveyAnalyticsOptions {
  fallbackSurvey?: SurveyPublic | SurveyAdmin | null;
  fallbackCount?: number;
  fallbackScenario?: string | null;
  tenantSlug?: string | null;
}

export function useSurveyAnalytics(
  id?: number | null,
  initialFilters: SurveyAnalyticsFilters = {},
  options: UseSurveyAnalyticsOptions = {},
): UseSurveyAnalyticsResult {
  const [filters, setFiltersState] = useState<SurveyAnalyticsFilters>(normalizeFilters(initialFilters));
  const queryClient = useQueryClient();
  const { currentSlug } = useTenant();
  const tenantSlug = useMemo(
    () => options.tenantSlug ?? currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, options.tenantSlug],
  );
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const requestOptions = useMemo(
    () => ({ tenantSlug: tenantSlug ?? undefined, sendAnonId: true }),
    [tenantSlug],
  );
  const allowFallback = ENABLE_SURVEY_ANALYTICS_FALLBACK;
  const fallbackSurvey = allowFallback ? options.fallbackSurvey ?? null : null;
  const fallbackCount = allowFallback ? options.fallbackCount : undefined;
  const fallbackScenario = allowFallback ? options.fallbackScenario ?? null : null;

  const dashboardQuery = useQuery({
    queryKey: queryKeys.surveys.analytics('dashboard', normalizedId ?? 'missing', tenantSlug, normalizedFilters),
    enabled: normalizedId !== null,
    retry: false,
    queryFn: () =>
      normalizedId !== null
        ? getSurveyDashboardBundle(normalizedId, normalizedFilters, requestOptions)
        : Promise.reject('No id provided'),
  });

  const [summaryQuery, timeseriesQuery, heatmapQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.surveys.analytics('summary', normalizedId ?? 'missing', tenantSlug, normalizedFilters),
        enabled:
          normalizedId !== null &&
          (dashboardQuery.isError || !dashboardQuery.data?.modules?.summary || !dashboardQuery.isFetched),
        queryFn: () =>
          normalizedId !== null
            ? getSummary(normalizedId, normalizedFilters, requestOptions)
            : Promise.reject('No id provided'),
      },
      {
        queryKey: queryKeys.surveys.analytics('timeseries', normalizedId ?? 'missing', tenantSlug, normalizedFilters),
        enabled:
          normalizedId !== null &&
          (dashboardQuery.isError || !dashboardQuery.data?.modules?.timeseries || !dashboardQuery.isFetched),
        queryFn: () =>
          normalizedId !== null
            ? getTimeseries(normalizedId, normalizedFilters, requestOptions)
            : Promise.reject('No id provided'),
      },
      {
        queryKey: queryKeys.surveys.analytics('heatmap', normalizedId ?? 'missing', tenantSlug, normalizedFilters),
        enabled:
          normalizedId !== null &&
          (dashboardQuery.isError || !dashboardQuery.data?.modules?.heatmap?.points || !dashboardQuery.isFetched),
        queryFn: () =>
          normalizedId !== null
            ? getHeatmap(normalizedId, normalizedFilters, requestOptions)
            : Promise.reject('No id provided'),
      },
    ],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (normalizedId === null) throw new Error('No survey id provided');
      return downloadExportCsv(normalizedId, normalizedFilters, requestOptions);
    },
    onSuccess: () => {
      if (normalizedId !== null) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.surveys.analyticsModule('summary', normalizedId, tenantSlug),
        });
      }
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

  const primarySummary = dashboardQuery.data?.modules?.summary ?? summaryQuery.data;
  const primaryTimeseries = dashboardQuery.data?.modules?.timeseries ?? timeseriesQuery.data;
  const primaryHeatmap = dashboardQuery.data?.modules?.heatmap?.points ?? heatmapQuery.data?.points;
  const summaryData = useMemo(
    () => mergeSurveyAnalytics(primarySummary, fallbackAnalytics?.summary),
    [primarySummary, fallbackAnalytics?.summary],
  );

  const timeseriesDataRaw = useMemo(
    () => pickTimeseries(primaryTimeseries, fallbackAnalytics?.timeseries),
    [primaryTimeseries, fallbackAnalytics?.timeseries],
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
    () => pickHeatmap(primaryHeatmap, fallbackHeatmapPayload?.points),
    [primaryHeatmap, fallbackHeatmapPayload?.points],
  );
  const summaryFallbackUsed = summaryUsesFallback(primarySummary, fallbackAnalytics?.summary);
  const timeseriesFallbackUsed = !Array.isArray(primaryTimeseries) && Array.isArray(fallbackAnalytics?.timeseries);
  const heatmapFallbackUsed = !Array.isArray(primaryHeatmap) && Array.isArray(fallbackHeatmapPayload?.points);

  const provenance = useMemo<SurveyAnalyticsProvenance>(() => {
    const affectedModules: SurveyAnalyticsProvenance['affected_modules'] = [];
    if (summaryFallbackUsed) affectedModules.push('summary');
    if (timeseriesFallbackUsed) affectedModules.push('timeseries');
    if (heatmapFallbackUsed) affectedModules.push('heatmap');
    const synthetic = affectedModules.length > 0;
    const backendModules = [primarySummary, primaryTimeseries, primaryHeatmap].filter((value) => value !== undefined).length;
    return {
      source: synthetic ? (backendModules > 0 ? 'mixed' : 'frontend_demo_fallback') : 'backend',
      synthetic,
      affected_modules: affectedModules,
      ...(synthetic
        ? { disclaimer: 'Datos sinteticos de demostracion; no representan respuestas reales.' }
        : {}),
    };
  }, [heatmapFallbackUsed, primaryHeatmap, primarySummary, primaryTimeseries, summaryFallbackUsed, timeseriesFallbackUsed]);

  const timeseriesData = useMemo(
    () => (Array.isArray(timeseriesDataRaw) ? timeseriesDataRaw : []),
    [timeseriesDataRaw],
  );

  const heatmapData = useMemo(
    () => (Array.isArray(heatmapDataRaw) ? heatmapDataRaw : []),
    [heatmapDataRaw],
  );

  const heatmapMeta = useMemo(
    () => heatmapFallbackUsed
      ? fallbackHeatmapPayload?.metadata
      : dashboardQuery.data?.modules?.heatmap?.metadata ?? heatmapQuery.data?.metadata,
    [dashboardQuery.data?.modules?.heatmap?.metadata, heatmapFallbackUsed, heatmapQuery.data?.metadata, fallbackHeatmapPayload?.metadata],
  );

  const heatmapPayload = useMemo<SurveyAnalyticsHeatmap | undefined>(() => {
    if (heatmapFallbackUsed) return fallbackHeatmapPayload;
    const backendHeatmap = dashboardQuery.data?.modules?.heatmap ?? heatmapQuery.data;
    if (backendHeatmap) return backendHeatmap;
    return fallbackHeatmapPayload;
  }, [dashboardQuery.data?.modules?.heatmap, heatmapFallbackUsed, heatmapQuery.data, fallbackHeatmapPayload]);

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
    provenance,
    isLoading: dashboardQuery.isLoading || summaryQuery.isLoading || timeseriesQuery.isLoading || heatmapQuery.isLoading,
    error: effectiveError,
    filters: normalizedFilters,
    setFilters: (next: SurveyAnalyticsFilters) => setFiltersState(normalizeFilters(next)),
    exportCsv: async () => exportMutation.mutateAsync(),
    isExporting: exportMutation.isPending,
    refresh: async () => {
      const dashboardResult = await dashboardQuery.refetch();
      const modules = dashboardResult.data?.modules;
      const fallbackRefreshes: Array<Promise<unknown>> = [];
      if (!modules?.summary) fallbackRefreshes.push(summaryQuery.refetch());
      if (!modules?.timeseries) fallbackRefreshes.push(timeseriesQuery.refetch());
      if (!modules?.heatmap) fallbackRefreshes.push(heatmapQuery.refetch());
      await Promise.allSettled(fallbackRefreshes);
    },
    isRefreshing:
      dashboardQuery.isFetching ||
      summaryQuery.isFetching ||
      timeseriesQuery.isFetching ||
      heatmapQuery.isFetching,
  };
}
