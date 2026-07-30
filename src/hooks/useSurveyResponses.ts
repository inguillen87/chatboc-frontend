import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listSurveyResponses } from '@/api/encuestas';
import type {
  SurveyResponseFilters,
  SurveyResponseList,
  SurveyResponseRecord,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

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
  tenantSlugOverride?: string | null,
): UseSurveyResponsesResult {
  const { currentSlug } = useTenant();
  const tenantSlug = useMemo(
    () => tenantSlugOverride ?? currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, tenantSlugOverride],
  );
  const normalizedId = useMemo(() => (typeof id === 'number' ? id : null), [id]);
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const requestOptions = useMemo(
    () => ({ tenantSlug: tenantSlug ?? undefined, sendAnonId: true }),
    [tenantSlug],
  );

  const query = useQuery({
    queryKey: queryKeys.surveys.responses(
      normalizedId ?? 'missing',
      JSON.stringify(normalizedFilters),
      tenantSlug,
    ),
    enabled: normalizedId !== null,
    queryFn: () =>
      normalizedId !== null
        ? listSurveyResponses(normalizedId, normalizedFilters, requestOptions)
        : Promise.reject(new Error('No survey id provided')),
    refetchInterval: 30_000,
    retry: false,
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
