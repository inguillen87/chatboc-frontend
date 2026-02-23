import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getPublicSurveyLiveResults } from '@/api/encuestas';
import type { SurveyLivePublicResultsPayload } from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const BASE_INTERVAL = 5000;
const FAST_INTERVAL = 3000;
const HIDDEN_INTERVAL = 15000;
const BACKOFF_INTERVALS = [5000, 10000, 20000] as const;
const CACHE_TTL = 5 * 60 * 1000;

const parseCachedPayload = (key: string): SurveyLivePublicResultsPayload | undefined => {
  const raw = safeLocalStorage.getItem(key);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as { timestamp?: number; data?: SurveyLivePublicResultsPayload };
    if (!parsed?.timestamp || !parsed?.data) return undefined;
    if (Date.now() - parsed.timestamp > CACHE_TTL) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
};

const getTrend = (payload?: SurveyLivePublicResultsPayload) => payload?.momentum?.trend;

export const useSurveyLiveResults = (slug?: string | null, tenantSlug?: string | null) => {
  const normalizedSlug = slug?.trim() ?? '';
  const normalizedTenant = tenantSlug?.trim() ?? '';
  const cacheKey = useMemo(
    () => `survey-live-results:${normalizedTenant || 'default'}:${normalizedSlug}`,
    [normalizedSlug, normalizedTenant],
  );
  const [isDocumentHidden, setIsDocumentHidden] = useState<boolean>(() =>
    typeof document === 'undefined' ? false : document.hidden,
  );
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

  useEffect(() => {
    const onVisibilityChange = () => setIsDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const query = useQuery({
    queryKey: ['survey-public-live-results', normalizedSlug, normalizedTenant],
    enabled: Boolean(normalizedSlug),
    queryFn: async () => {
      const data = await getPublicSurveyLiveResults(normalizedSlug, normalizedTenant || undefined);
      safeLocalStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
      return data;
    },
    initialData: () => parseCachedPayload(cacheKey),
    retry: false,
    refetchInterval: (context) => {
      if (isDocumentHidden) return HIDDEN_INTERVAL;

      if (consecutiveErrors > 2) {
        const index = Math.min(consecutiveErrors - 3, BACKOFF_INTERVALS.length - 1);
        return BACKOFF_INTERVALS[index];
      }

      const trend = getTrend(context.state.data as SurveyLivePublicResultsPayload | undefined);
      return trend === 'subiendo' ? FAST_INTERVAL : BASE_INTERVAL;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (query.isError) {
      setConsecutiveErrors((prev) => prev + 1);
      return;
    }

    if (query.data) {
      setConsecutiveErrors(0);
    }
  }, [query.isError, query.dataUpdatedAt]);

  return {
    liveResults: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? getErrorMessage(query.error) : null,
    consecutiveErrors,
    refetch: query.refetch,
  };
};
