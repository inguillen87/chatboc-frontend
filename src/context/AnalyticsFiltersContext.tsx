import { createContext, useCallback, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AnalyticsContext, AnalyticsFilters } from '@/services/analyticsService';

type FiltersState = AnalyticsFilters;

type FiltersContextValue = {
  filters: FiltersState;
  setFilters: (updates: Partial<FiltersState>) => void;
  setDateRange: (from: Date, to: Date) => void;
  setBoundingBox: (bbox: [number, number, number, number] | null) => void;
  context: AnalyticsContext;
};

const AnalyticsFiltersContext = createContext<FiltersContextValue | null>(null);

const DEFAULT_RANGE_DAYS = 30;

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseArray(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBbox(value: string | null): [number, number, number, number] | null {
  if (!value) return null;
  const parts = value.split(',').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return [parts[0], parts[1], parts[2], parts[3]];
}

function buildFilters(params: URLSearchParams, defaults: { tenantId: string; context: AnalyticsContext }) {
  const now = new Date();
  const fromParam = params.get('from');
  const toParam = params.get('to');
  const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : now;
  return {
    tenantId: params.get('tenant_id') || defaults.tenantId,
    from: formatDate(from),
    to: formatDate(to),
    canal: parseArray(params.get('canal')),
    categoria: parseArray(params.get('categoria')),
    estado: parseArray(params.get('estado')),
    agente: parseArray(params.get('agente')),
    zona: parseArray(params.get('zona')),
    etiquetas: parseArray(params.get('etiquetas')),
    metric: params.get('metric') || 'tickets_total',
    group: params.get('group'),
    dimension: params.get('dimension') || 'categoria',
    subject: params.get('subject') || 'zonas',
    bbox: parseBbox(params.get('bbox')),
    context: (params.get('context') as AnalyticsContext) || defaults.context,
    search: params.get('search'),
  } satisfies FiltersState;
}

export function AnalyticsFiltersProvider({
  children,
  defaultTenantId,
  defaultContext,
}: {
  children: React.ReactNode;
  defaultTenantId: string;
  defaultContext: AnalyticsContext;
}) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(
    () => buildFilters(params, { tenantId: defaultTenantId, context: defaultContext }),
    [params, defaultTenantId, defaultContext],
  );

  const updateParams = useCallback(
    (updates: Partial<FiltersState>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          next.delete(key);
          return;
        }
        if (Array.isArray(value)) {
          if (value.length === 0) {
            next.delete(key);
          } else {
            next.set(key, value.join(','));
          }
          return;
        }
        if (key === 'bbox' && Array.isArray(value)) {
          next.set(key, value.join(','));
          return;
        }
        next.set(key, String(value));
      });
      next.set('tenant_id', updates.tenantId ?? filters.tenantId);
      next.set('from', updates.from ?? filters.from);
      next.set('to', updates.to ?? filters.to);
      next.set('context', updates.context ?? filters.context);
      setParams(next, { replace: true });
    },
    [params, setParams, filters],
  );

  const setFilters = useCallback(
    (updates: Partial<FiltersState>) => {
      updateParams(updates);
    },
    [updateParams],
  );

  const setDateRange = useCallback(
    (from: Date, to: Date) => {
      updateParams({ from: formatDate(from), to: formatDate(to) });
    },
    [updateParams],
  );

  const setBoundingBox = useCallback(
    (bbox: [number, number, number, number] | null) => {
      if (!bbox) {
        updateParams({ bbox: null });
        return;
      }
      updateParams({ bbox });
    },
    [updateParams],
  );

  const value = useMemo<FiltersContextValue>(
    () => ({ filters, setFilters, setDateRange, setBoundingBox, context: filters.context }),
    [filters, setFilters, setDateRange, setBoundingBox],
  );

  return <AnalyticsFiltersContext.Provider value={value}>{children}</AnalyticsFiltersContext.Provider>;
}

export function useAnalyticsFilters() {
  const ctx = useContext(AnalyticsFiltersContext);
  if (!ctx) {
    throw new Error('useAnalyticsFilters must be used within AnalyticsFiltersProvider');
  }
  return ctx;
}
