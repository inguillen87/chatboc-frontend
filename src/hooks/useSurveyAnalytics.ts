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
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';

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

export function useSurveyAnalytics(
  id?: number | null,
  initialFilters: SurveyAnalyticsFilters = {},
): UseSurveyAnalyticsResult {
  const [filters, setFiltersState] = useState<SurveyAnalyticsFilters>(normalizeFilters(initialFilters));
  const queryClient = useQueryClient();
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

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

  return {
    summary: summaryQuery.data,
    timeseries: timeseriesQuery.data,
    heatmap: heatmapQuery.data,
    isLoading: summaryQuery.isLoading || timeseriesQuery.isLoading || heatmapQuery.isLoading,
    error:
      summaryQuery.error
        ? getErrorMessage(summaryQuery.error)
        : timeseriesQuery.error
          ? getErrorMessage(timeseriesQuery.error)
          : heatmapQuery.error
            ? getErrorMessage(heatmapQuery.error)
            : null,
    filters: normalizedFilters,
    setFilters: (next: SurveyAnalyticsFilters) => setFiltersState(normalizeFilters(next)),
    exportCsv: async () => exportMutation.mutateAsync(),
    isExporting: exportMutation.isPending,
  };
}
