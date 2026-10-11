import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getPublicSurveyLiveResults } from '@/api/encuestas';
import type { SurveyLivePublicResultsPayload } from '@/types/encuestas';
import { ApiError, getErrorMessage } from '@/utils/api';
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
const isAccessWithdrawn = (error: unknown): error is ApiError =>
  error instanceof ApiError && [401, 403, 404].includes(error.status);

interface PublicResultsAccessState {
  requestGeneration: number;
  lastSuccessGeneration: number;
  rejectionBarrier: number;
  rejection: ApiError | null;
  acceptedGenerations: Record<string, number>;
  observedMarker: string | null;
}

interface WithdrawalMarker { value: string; status: number }
const parseWithdrawalMarker = (value: string | null): WithdrawalMarker | null => {
  if (value === null) return null;
  // Retain compatibility with notices written by an older open tab.
  if (['401', '403', '404'].includes(value)) return { value, status: Number(value) };
  try {
    const marker = JSON.parse(value);
    if (marker?.v === 1 && [401, 403, 404].includes(marker.status) &&
        typeof marker.id === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(marker.id)) {
      return { value, status: marker.status };
    }
  } catch { /* Ignore unrelated or corrupt storage values. */ }
  return null;
};
const createWithdrawalMarker = (status: number): WithdrawalMarker => {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return { status, value: JSON.stringify({ v: 1, status, id }) };
};

const initialAccessState = (storageKey: string): PublicResultsAccessState => {
  const marker = parseWithdrawalMarker(safeLocalStorage.getItem(storageKey));
  const withdrawn = Boolean(marker);
  return {
    // A persisted withdrawal also invalidates every older filter cache after
    // recovery. Start beyond zero so each filter needs its own fresh success.
    requestGeneration: withdrawn ? 1 : 0, lastSuccessGeneration: 0,
    rejectionBarrier: withdrawn ? 1 : 0,
    rejection: marker ? new ApiError('Resultados no disponibles', marker.status) : null,
    acceptedGenerations: {},
    observedMarker: marker?.value ?? null,
  };
};

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

  if (hasError && hasData) {
    return {
      status: consecutiveErrors > 2 ? 'reconnecting' : 'stale',
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
  const queryClient = useQueryClient();
  const accessStorageKey = `survey-live-results-access:${JSON.stringify([normalizedTenant, normalizedSlug])}`;
  const accessQueryKey = useMemo(
    () => ['survey-public-live-results-access', normalizedSlug, normalizedTenant],
    [normalizedSlug, normalizedTenant],
  );
  // Visibility belongs to the survey and organization, not the selected filter.
  // Retain a rejection through remounts and across persistent cache hydration.
  const accessQuery = useQuery({
    queryKey: accessQueryKey,
    enabled: false,
    queryFn: () => initialAccessState(accessStorageKey),
    initialData: () => initialAccessState(accessStorageKey),
    gcTime: Infinity,
  });
  const observeWithdrawal = useCallback((marker: WithdrawalMarker) => {
    queryClient.setQueryData<PublicResultsAccessState>(accessQueryKey, (previous) => {
      const state = previous ?? initialAccessState(accessStorageKey);
      if (state.observedMarker === marker.value) return state;
      const barrier = Math.max(1, state.requestGeneration);
      return {
        ...state, observedMarker: marker.value,
        requestGeneration: barrier, rejectionBarrier: barrier,
        rejection: new ApiError('Resultados no disponibles', marker.status),
      };
    });
  }, [queryClient, accessQueryKey, accessStorageKey]);
  useEffect(() => {
    const current = parseWithdrawalMarker(safeLocalStorage.getItem(accessStorageKey));
    if (current) observeWithdrawal(current);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== accessStorageKey || !event.newValue) return;
      try { if (event.storageArea !== window.localStorage) return; } catch { return; }
      // A delayed notice that has already been superseded cannot retire newer
      // results. Removing a notice never verifies access in this tab.
      if (safeLocalStorage.getItem(accessStorageKey) !== event.newValue) return;
      const marker = parseWithdrawalMarker(event.newValue);
      if (marker) observeWithdrawal(marker);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [accessStorageKey, observeWithdrawal]);
  const serializedParams = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const cacheKey = useMemo(
    () => `survey-live-results:${JSON.stringify([normalizedTenant, normalizedSlug, serializedParams])}`,
    [normalizedSlug, normalizedTenant, serializedParams],
  );
  const [isDocumentHidden, setIsDocumentHidden] = useState<boolean>(() =>
    typeof document === 'undefined' ? false : document.hidden,
  );
  const [errorState, setErrorState] = useState({ scope: cacheKey, count: 0 });
  const consecutiveErrors = errorState.scope === cacheKey ? errorState.count : 0;

  useEffect(() => {
    const onVisibilityChange = () => setIsDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const query = useQuery({
    queryKey: ['survey-public-live-results', normalizedSlug, normalizedTenant, serializedParams],
    enabled: Boolean(normalizedSlug),
    queryFn: async () => {
      const requestMarker = parseWithdrawalMarker(safeLocalStorage.getItem(accessStorageKey));
      if (requestMarker) observeWithdrawal(requestMarker);
      let generation = 0;
      queryClient.setQueryData<PublicResultsAccessState>(accessQueryKey, (previous) => {
        const state = previous ?? initialAccessState(accessStorageKey);
        generation = state.requestGeneration + 1;
        return { ...state, requestGeneration: generation };
      });
      try {
        const data = await getPublicSurveyLiveResults(normalizedSlug, normalizedTenant || undefined, params);
        // Another tab can write its denial before the browser delivers the
        // storage event. Check at settlement as well as in the event listener.
        const currentMarker = parseWithdrawalMarker(safeLocalStorage.getItem(accessStorageKey));
        if (currentMarker && currentMarker.value !== requestMarker?.value) observeWithdrawal(currentMarker);
        let accepted = false;
        queryClient.setQueryData<PublicResultsAccessState>(accessQueryKey, (previous) => {
          const state = previous ?? initialAccessState(accessStorageKey);
          if (generation < (state.acceptedGenerations[serializedParams] ?? 0) || generation <= state.rejectionBarrier) return state;
          accepted = true;
          return {
            ...state, lastSuccessGeneration: Math.max(state.lastSuccessGeneration, generation), rejection: null,
            acceptedGenerations: { ...state.acceptedGenerations, [serializedParams]: generation },
          };
        });
        if (accepted) {
          const latestMarker = parseWithdrawalMarker(safeLocalStorage.getItem(accessStorageKey));
          if (latestMarker && latestMarker.value !== requestMarker?.value) observeWithdrawal(latestMarker);
          else safeLocalStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
          // Keep the last opaque notice. Clearing shared storage here could
          // erase a simultaneous denial or revive another tab's older cache.
        }
        return data;
      } catch (error) {
        if (isAccessWithdrawn(error)) {
          queryClient.setQueryData<PublicResultsAccessState>(accessQueryKey, (previous) => {
            const state = previous ?? initialAccessState(accessStorageKey);
            if (generation < state.lastSuccessGeneration) return state;
            const marker = createWithdrawalMarker(error.status);
            safeLocalStorage.setItem(accessStorageKey, marker.value);
            safeLocalStorage.removeItem(cacheKey);
            return { ...state, rejection: error, rejectionBarrier: state.requestGeneration, observedMarker: marker.value };
          });
        }
        throw error;
      }
    },
    initialData: () => accessQuery.data.rejection ? undefined : parseCachedPayload(cacheKey),
    retry: false,
    refetchInterval: (context) => {
      if (queryClient.getQueryData<PublicResultsAccessState>(accessQueryKey)?.rejection) return false;
      return getSurveyLivePollingInterval(
        context.state.data as SurveyLivePublicResultsPayload | undefined,
        isDocumentHidden,
        consecutiveErrors,
      );
    },
    retryOnMount: false,
    refetchOnWindowFocus: () => !queryClient.getQueryData<PublicResultsAccessState>(accessQueryKey)?.rejection,
    refetchOnReconnect: () => !queryClient.getQueryData<PublicResultsAccessState>(accessQueryKey)?.rejection,
  });
  const accessError = accessQuery.data.rejection;
  const accessWithdrawn = Boolean(accessError);
  // A recovery in another filter cannot publish this filter's older response.
  const filterVerified = accessQuery.data.rejectionBarrier === 0 ||
    (accessQuery.data.acceptedGenerations[serializedParams] ?? 0) > accessQuery.data.rejectionBarrier;
  const visibleResults = accessWithdrawn || !filterVerified ? undefined : query.data;

  useEffect(() => {
    if (accessWithdrawn) safeLocalStorage.removeItem(cacheKey);
  }, [accessWithdrawn, cacheKey]);

  useEffect(() => {
    setErrorState((previous) => ({
      scope: cacheKey,
      count: query.isError ? (previous.scope === cacheKey ? previous.count : 0) + 1 : 0,
    }));
  }, [cacheKey, query.isError, query.errorUpdatedAt, query.dataUpdatedAt]);

  const pollingIntervalMs = useMemo(
    () => accessWithdrawn ? null : getSurveyLivePollingInterval(visibleResults, isDocumentHidden, consecutiveErrors),
    [accessWithdrawn, consecutiveErrors, isDocumentHidden, visibleResults],
  );

  const liveStatus = useMemo(
    () => accessWithdrawn ? {
      status: 'error' as const,
      label: 'Resultados no disponibles',
      description: 'La organización no tiene habilitados los resultados públicos de esta encuesta.',
    } : resolveSurveyLiveStatus({
        enabled: Boolean(normalizedSlug),
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        hasData: Boolean(visibleResults),
        hasActivity: hasSurveyLiveActivity(visibleResults),
        hasError: query.isError,
        consecutiveErrors,
        isDocumentHidden,
      }),
    [
      consecutiveErrors,
      accessWithdrawn,
      isDocumentHidden,
      normalizedSlug,
      visibleResults,
      query.isError,
      query.isFetching,
      query.isLoading,
    ],
  );

  return {
    liveResults: visibleResults,
    accessWithdrawn,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: accessError ? getErrorMessage(accessError) : query.error ? getErrorMessage(query.error) : null,
    consecutiveErrors,
    liveStatus,
    pollingIntervalMs,
    refetch: query.refetch,
  };
};
