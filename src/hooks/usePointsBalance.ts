import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';

export interface PointsBalance {
  points: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<number | null>;
  adjustOptimistic: (delta: number) => void;
}

export const usePointsBalance = (): PointsBalance => {
  const [points, setPoints] = useState<number>(getDemoLoyaltySummary().points);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

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
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ saldo?: number; points?: number; balance?: number }>('/api/puntos/saldo', {
        method: 'GET',
        sendAnonId: true,
        suppressPanel401Redirect: true,
        isWidgetRequest: true,
        omitCredentials: true,
      });
      const saldo = normalizeSaldo(response);
      if (saldo !== null && isMountedRef.current) {
        setPoints(saldo);
      }
      return saldo;
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err, 'No se pudo actualizar tu saldo de puntos. Mostramos un valor estimado.'));
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const adjustOptimistic = useCallback((delta: number) => {
    setPoints((prev) => {
      const next = Math.max(0, Math.round(prev + delta));
      return Number.isFinite(next) ? next : prev;
    });
  }, []);

  return { points, isLoading, error, refresh: fetchBalance, adjustOptimistic };
};

export default usePointsBalance;
