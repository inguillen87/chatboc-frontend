import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';

interface UsePointsBalanceOptions {
  enabled?: boolean;
  tenantSlug?: string | null;
}

export interface PointsBalance {
  points: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<number | null>;
  adjustOptimistic: (delta: number) => void;
  requiresAuth: boolean;
}

export const usePointsBalance = (options: UsePointsBalanceOptions = {}): PointsBalance => {
  const { enabled = true, tenantSlug = null } = options;
  const [points, setPoints] = useState<number>(getDemoLoyaltySummary().points);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const isMountedRef = useRef(true);

  const balanceEndpointCandidates = useRef<string[]>([
    '/api/puntos/saldo',
    '/puntos/saldo',
    '/api/loyalty/saldo',
    '/api/loyalty/summary',
    '/loyalty/saldo',
    '/loyalty/summary',
  ]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const normalizeSaldo = (response?: { saldo?: number; points?: number; balance?: number }): number | null => {
    if (!response) return null;

    if (typeof response.saldo === 'number') return response.saldo;
    if (typeof response.points === 'number') return response.points;
    if (typeof response.balance === 'number') return response.balance;

    return null;
  };

  const fetchBalance = useCallback(async (): Promise<number | null> => {
    if (!enabled) {
      setRequiresAuth(false);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setError(null);
    setRequiresAuth(false);

    let lastError: unknown = null;

    try {
      for (const path of balanceEndpointCandidates.current) {
        try {
          const response = await apiFetch<{ saldo?: number; points?: number; balance?: number }>(path, {
            method: 'GET',
            sendAnonId: true,
            suppressPanel401Redirect: true,
            isWidgetRequest: true,
            omitCredentials: true,
            tenantSlug: tenantSlug ?? undefined,
          });

          const saldo = normalizeSaldo(response);
          if (saldo !== null && isMountedRef.current) {
            setPoints(saldo);
          }
          return saldo;
        } catch (err) {
          lastError = err;

          if (err instanceof ApiError) {
            if (err.status === 401) {
              const code = err.body?.code || err.body?.error_code || err.body?.errorCode;
              if (code === 'REQUIERE_LOGIN_PUNTOS') {
                setRequiresAuth(true);
                return null;
              }
            }

            if (err.status === 404) {
              continue;
            }
          }

          throw err;
        }
      }
    } catch (err) {
      lastError = err;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }

    if (isMountedRef.current && lastError) {
      setError(getErrorMessage(lastError, 'No se pudo actualizar tu saldo de puntos. Mostramos un valor estimado.'));
    }

    return null;
  }, [enabled, tenantSlug]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const adjustOptimistic = useCallback((delta: number) => {
    setPoints((prev) => {
      const next = Math.max(0, Math.round(prev + delta));
      return Number.isFinite(next) ? next : prev;
    });
  }, []);

  return { points, isLoading, error, refresh: fetchBalance, adjustOptimistic, requiresAuth };
};

export default usePointsBalance;
