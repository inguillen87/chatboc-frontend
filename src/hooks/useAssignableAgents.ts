import { useCallback, useEffect, useState } from 'react';
import { AssignableAgent, getAssignableAgents } from '@/services/ticketService';
import { ApiError } from '@/utils/api';
import { useTenant } from '@/context/TenantContext';

const ASSIGNABLE_AGENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const agentsCache = new Map<string, { agents: AssignableAgent[]; fetchedAt: number }>();
const agentsInflight = new Map<string, Promise<AssignableAgent[]>>();

export const __resetAssignableAgentsCacheForTests = () => {
  agentsCache.clear();
  agentsInflight.clear();
};

const loadAssignableAgents = (
  key: string,
  tipo: 'municipio' | 'pyme',
  force = false,
): Promise<AssignableAgent[]> => {
  const cached = agentsCache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < ASSIGNABLE_AGENTS_CACHE_TTL_MS) {
    return Promise.resolve(cached.agents);
  }
  const activeRequest = agentsInflight.get(key);
  if (!force && activeRequest) return activeRequest;

  const request = getAssignableAgents(tipo).then((agents) => {
    agentsCache.set(key, { agents, fetchedAt: Date.now() });
    return agents;
  }).finally(() => {
    if (agentsInflight.get(key) === request) agentsInflight.delete(key);
  });
  agentsInflight.set(key, request);
  return request;
};

export const useAssignableAgents = (tipo?: 'municipio' | 'pyme') => {
  const { currentSlug } = useTenant();
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = tipo ? `${String(currentSlug || 'default').trim().toLowerCase()}:${tipo}` : null;

  const refresh = useCallback(async (force = true) => {
    if (!tipo || !cacheKey) {
      setAgents([]);
      return;
    }

    const cached = agentsCache.get(cacheKey);
    if (cached) setAgents(cached.agents);
    setLoading(force || !cached);
    setError(null);
    try {
      const response = await loadAssignableAgents(cacheKey, tipo, force);
      setAgents(response);
    } catch (err: any) {
      const apiError = err as ApiError;
      const message = apiError?.message || 'No se pudieron cargar los agentes disponibles.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, tipo]);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return { agents, loading, error, refresh: () => refresh(true) };
};

export default useAssignableAgents;
