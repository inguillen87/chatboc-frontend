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

export type SurveyLiveStatus = 'idle' | 'loading' | 'syncing' | 'live' | 'empty' | 'stale' | 'reconnecting' | 'error';

export interface SurveyLiveStatusView {
  status: SurveyLiveStatus;
  label: string;
  description: string;
}

export type SurveyAnalyticsRangePreset = 'last_60m' | 'today' | 'last_24h';

export interface SurveyLiveRequestParams {
  include_heatmap?: 0 | 1;
  range_preset?: SurveyAnalyticsRangePreset;
  range_timezone?: string;
  desde?: string;
  hasta?: string;
  momentum_window_minutes?: number;
  /** @deprecated Use momentum_window_minutes. This never defines the analytics range. */
  window_minutes?: number;
  max_points?: number;
  max_cells?: number;
  canal?: string;
  barrio?: string;
  ciudad?: string;
  provincia?: string;
}

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

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getBackendPollingInterval = (payload?: SurveyLivePublicResultsPayload) => {
  const realtimeInterval = Number(payload?.realtime?.polling?.interval_ms);
  const interval = Number.isFinite(realtimeInterval) && realtimeInterval > 0
    ? realtimeInterval
    : Number(payload?.render_contract?.polling_interval_ms);
  if (!Number.isFinite(interval) || interval <= 0) return null;
  return Math.max(2500, Math.min(interval, 30000));
};

export const getSurveyLivePollingInterval = (
  payload?: SurveyLivePublicResultsPayload,
  isDocumentHidden = false,
  consecutiveErrors = 0,
) => {
  if (isDocumentHidden) return HIDDEN_INTERVAL;

  if (consecutiveErrors > 2) {
    const index = Math.min(consecutiveErrors - 3, BACKOFF_INTERVALS.length - 1);
    return BACKOFF_INTERVALS[index];
  }

  const backendInterval = getBackendPollingInterval(payload);
  if (backendInterval) return backendInterval;

  return getTrend(payload) === 'subiendo' ? FAST_INTERVAL : BASE_INTERVAL;
};

export const hasSurveyLiveActivity = (payload?: SurveyLivePublicResultsPayload) => {
  if (!payload) return false;
  if (toFiniteNumber(payload.total_respuestas) > 0) return true;

  if (
    payload.preguntas?.some((question) => {
      if (toFiniteNumber(question.total_votos) > 0) return true;
      return question.opciones?.some((option) => toFiniteNumber(option.votos) > 0) ?? false;
    })
  ) {
    return true;
  }

  if (payload.timeline_minute?.some((point) => toFiniteNumber(point.respuestas ?? point.value ?? point.total) > 0)) {
    return true;
  }

  return Boolean(payload.heatmap?.points?.length || payload.heatmap?.cells?.length);
};

export const resolveSurveyLiveStatus = ({
  enabled,
  isLoading,
  isFetching,
  hasData,
  hasActivity,
  hasError,
  consecutiveErrors,
  isDocumentHidden,
}: {
  enabled: boolean;
  isLoading: boolean;
  isFetching: boolean;
  hasData: boolean;
  hasActivity: boolean;
  hasError: boolean;
  consecutiveErrors: number;
  isDocumentHidden: boolean;
}): SurveyLiveStatusView => {
  if (!enabled) {
    return {
      status: 'idle',
      label: 'En espera',
      description: 'Los resultados en vivo todavia no estan activos.',
    };
  }

  if (isLoading && !hasData) {
    return {
      status: 'loading',
      label: 'Cargando',
      description: 'Estamos preparando los resultados en vivo.',
    };
  }

  if (hasError && !hasData) {
    return {
      status: 'error',
      label: 'Sin conexion live',
      description: 'No pudimos cargar los resultados en vivo.',
    };
  }

  if (consecutiveErrors > 2 && hasData) {
    return {
      status: 'reconnecting',
      label: 'Reintentando',
      description: 'Se muestran datos previos mientras vuelve la conexion.',
    };
  }

  if (isDocumentHidden && hasData) {
    return {
      status: 'stale',
      label: 'Pausado',
      description: 'La actualizacion baja frecuencia mientras la pestana no esta activa.',
    };
  }

  if (isFetching && hasData) {
    return {
      status: 'syncing',
      label: 'Actualizando',
      description: 'Estamos buscando nuevas respuestas.',
    };
  }

  if (hasData && !hasActivity) {
    return {
      status: 'empty',
      label: 'Sin respuestas todavia',
      description: 'La sala esta lista y va a mostrar actividad cuando entren respuestas.',
    };
  }

  if (hasData) {
    return {
      status: 'live',
      label: 'En vivo',
      description: 'Resultados actualizados automaticamente.',
    };
  }

  return {
    status: 'loading',
    label: 'Cargando',
    description: 'Estamos preparando los resultados en vivo.',
  };
};

export const useSurveyLiveResults = (
  slug?: string | null,
  tenantSlug?: string | null,
  params?: SurveyLiveRequestParams,
) => {
  const normalizedSlug = slug?.trim() ?? '';
  const normalizedTenant = tenantSlug?.trim() ?? '';
  const serializedParams = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const cacheKey = useMemo(
    () => `survey-live-results:${normalizedTenant || 'default'}:${normalizedSlug}:${serializedParams}`,
    [normalizedSlug, normalizedTenant, serializedParams],
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
    queryKey: ['survey-public-live-results', normalizedSlug, normalizedTenant, serializedParams],
    enabled: Boolean(normalizedSlug),
    queryFn: async () => {
      const data = await getPublicSurveyLiveResults(normalizedSlug, normalizedTenant || undefined, params);
      safeLocalStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
      return data;
    },
    initialData: () => parseCachedPayload(cacheKey),
    retry: false,
    refetchInterval: (context) => {
      return getSurveyLivePollingInterval(
        context.state.data as SurveyLivePublicResultsPayload | undefined,
        isDocumentHidden,
        consecutiveErrors,
      );
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

  const pollingIntervalMs = useMemo(
    () => getSurveyLivePollingInterval(query.data, isDocumentHidden, consecutiveErrors),
    [consecutiveErrors, isDocumentHidden, query.data],
  );

  const liveStatus = useMemo(
    () =>
      resolveSurveyLiveStatus({
        enabled: Boolean(normalizedSlug),
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        hasData: Boolean(query.data),
        hasActivity: hasSurveyLiveActivity(query.data),
        hasError: query.isError,
        consecutiveErrors,
        isDocumentHidden,
      }),
    [
      consecutiveErrors,
      isDocumentHidden,
      normalizedSlug,
      query.data,
      query.isError,
      query.isFetching,
      query.isLoading,
    ],
  );

  return {
    liveResults: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? getErrorMessage(query.error) : null,
    consecutiveErrors,
    liveStatus,
    pollingIntervalMs,
    refetch: query.refetch,
  };
};
