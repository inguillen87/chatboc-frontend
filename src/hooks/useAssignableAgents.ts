import { useCallback, useEffect, useState } from 'react';
import { AssignableAgent, getAssignableAgents } from '@/services/ticketService';
import { ApiError } from '@/utils/api';

export const useAssignableAgents = (tipo?: 'municipio' | 'pyme') => {
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tipo) {
      setAgents([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getAssignableAgents(tipo);
      setAgents(response);
    } catch (err: any) {
      const apiError = err as ApiError;
      const message = apiError?.message || 'No se pudieron cargar los agentes disponibles.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agents, loading, error, refresh };
};

export default useAssignableAgents;
