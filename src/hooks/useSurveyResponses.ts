import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listSurveyResponses } from '@/api/encuestas';
import type {
  SurveyResponseFilters,
  SurveyResponseList,
  SurveyResponseRecord,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';

interface UseSurveyResponsesResult {
  responses: SurveyResponseRecord[];
  meta: SurveyResponseList['meta'];
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  refetch: () => Promise<SurveyResponseList | undefined>;
}

const normalizeFilters = (filters?: SurveyResponseFilters): SurveyResponseFilters => ({
  limit: 10,
  ...(filters ?? {}),
});

export function useSurveyResponses(
  id?: number | null,
  filters?: SurveyResponseFilters,
): UseSurveyResponsesResult {
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const query = useQuery({
    queryKey: ['survey-responses', normalizedId, normalizedFilters],
    enabled: normalizedId !== null,
    queryFn: () =>
      normalizedId !== null
        ? listSurveyResponses(normalizedId, normalizedFilters)
        : Promise.reject(new Error('No survey id provided')),
    refetchInterval: 30_000,
  });

  return {
    responses: query.data?.data ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: async () => {
      const result = await query.refetch();
      return result.data;
    },
  };
}
