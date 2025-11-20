import { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';

export interface PointsBalance {
  points: number;
  isLoading: boolean;
  error: string | null;
}

export const usePointsBalance = (): PointsBalance => {
  const [points, setPoints] = useState<number>(getDemoLoyaltySummary().points);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    apiFetch<{ saldo?: number; points?: number; balance?: number }>('/api/puntos/saldo', {
      method: 'GET',
      sendAnonId: true,
      suppressPanel401Redirect: true,
      isWidgetRequest: true,
    })
      .then((response) => {
        if (!isMounted) return;
        const saldo =
          typeof response?.saldo === 'number'
            ? response.saldo
            : typeof response?.points === 'number'
              ? response.points
              : typeof response?.balance === 'number'
                ? response.balance
                : null;
        if (saldo !== null) {
          setPoints(saldo);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(getErrorMessage(err, 'No se pudo actualizar tu saldo de puntos. Mostramos un valor estimado.'));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { points, isLoading, error };
};

export default usePointsBalance;
