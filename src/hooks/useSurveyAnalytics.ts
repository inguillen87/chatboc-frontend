import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  downloadExportCsv,
  getHeatmap,
  getSummary,
  getTimeseries,
} from '@/api/encuestas';
import type {
  SurveyAnalyticsFilters,
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
  isLoading: boolean;
  error: string | null;
  filters: SurveyAnalyticsFilters;
  setFilters: (next: SurveyAnalyticsFilters) => void;
  exportCsv: () => Promise<Blob>;
  isExporting: boolean;
}

const normalizeFilters = (filters: SurveyAnalyticsFilters): SurveyAnalyticsFilters => ({
  ...filters,
});

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
  const fallbackSurvey = options.fallbackSurvey ?? null;
  const fallbackCount = options.fallbackCount;
  const fallbackScenario = options.fallbackScenario ?? null;

  const [summaryQuery, timeseriesQuery, heatmapQuery] = useQueries({
    queries: [
      {
        queryKey: ['survey-analytics-summary', normalizedId, normalizedFilters],
        enabled: normalizedId !== null,
        queryFn: () =>
          normalizedId !== null ? getSummary(normalizedId, normalizedFilters) : Promise.reject('No id provided'),
      },
      {
        queryKey: ['survey-analytics-timeseries', normalizedId, normalizedFilters],
        enabled: normalizedId !== null,
        queryFn: () =>
          normalizedId !== null ? getTimeseries(normalizedId, normalizedFilters) : Promise.reject('No id provided'),
      },
      {
        queryKey: ['survey-analytics-heatmap', normalizedId, normalizedFilters],
        enabled: normalizedId !== null,
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
    () => mergeSurveyAnalytics(summaryQuery.data, fallbackAnalytics?.summary),
    [summaryQuery.data, fallbackAnalytics?.summary],
  );

  const timeseriesData = useMemo(
    () => pickTimeseries(timeseriesQuery.data, fallbackAnalytics?.timeseries),
    [timeseriesQuery.data, fallbackAnalytics?.timeseries],
  );

  const heatmapData = useMemo(
    () => pickHeatmap(heatmapQuery.data, fallbackAnalytics?.heatmap),
    [heatmapQuery.data, fallbackAnalytics?.heatmap],
  );

  const baseError = summaryQuery.error
    ? getErrorMessage(summaryQuery.error)
    : timeseriesQuery.error
      ? getErrorMessage(timeseriesQuery.error)
      : heatmapQuery.error
        ? getErrorMessage(heatmapQuery.error)
        : null;

  const effectiveError = useMemo(() => {
    if (!baseError) return null;
    if (summaryData && summaryData.total_respuestas > 0) return null;
    if (timeseriesData && timeseriesData.length > 0) return null;
    if (heatmapData && heatmapData.length > 0) return null;
    return baseError;
  }, [baseError, summaryData, timeseriesData, heatmapData]);

  return {
    summary: summaryData ?? undefined,
    timeseries: timeseriesData,
    heatmap: heatmapData,
    isLoading: summaryQuery.isLoading || timeseriesQuery.isLoading || heatmapQuery.isLoading,
    error: effectiveError,
    filters: normalizedFilters,
    setFilters: (next: SurveyAnalyticsFilters) => setFiltersState(normalizeFilters(next)),
    exportCsv: async () => exportMutation.mutateAsync(),
    isExporting: exportMutation.isPending,
  };
}
