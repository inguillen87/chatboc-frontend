import { useEffect, useMemo, useState } from 'react';
import { analyticsService, type AnalyticsContext } from '@/services/analyticsService';
import { useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';

type DashboardData = {
  summary: Awaited<ReturnType<typeof analyticsService.summary>> | null;
  timeseries: Awaited<ReturnType<typeof analyticsService.timeseries>> | null;
  breakdownCategoria: Awaited<ReturnType<typeof analyticsService.breakdown>> | null;
  breakdownCanal: Awaited<ReturnType<typeof analyticsService.breakdown>> | null;
  breakdownEstado: Awaited<ReturnType<typeof analyticsService.breakdown>> | null;
  heatmap: Awaited<ReturnType<typeof analyticsService.heatmap>> | null;
  points: Awaited<ReturnType<typeof analyticsService.points>> | null;
  topZonas: Awaited<ReturnType<typeof analyticsService.top>> | null;
  operations: Awaited<ReturnType<typeof analyticsService.operations>> | null;
  cohorts: Awaited<ReturnType<typeof analyticsService.cohorts>> | null;
  templates: Awaited<ReturnType<typeof analyticsService.templates>> | null;
};

export function useAnalyticsDashboard(view: AnalyticsContext) {
  const { filters } = useAnalyticsFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    summary: null,
    timeseries: null,
    breakdownCategoria: null,
    breakdownCanal: null,
    breakdownEstado: null,
    heatmap: null,
    points: null,
    topZonas: null,
    operations: null,
    cohorts: null,
    templates: null,
  });

  const payload = useMemo(() => ({
    tenantId: filters.tenantId,
    from: filters.from,
    to: filters.to,
    canal: filters.canal,
    categoria: filters.categoria,
    estado: filters.estado,
    agente: filters.agente,
    zona: filters.zona,
    etiquetas: filters.etiquetas,
    context: view,
    bbox: filters.bbox ?? undefined,
    search: filters.search ?? undefined,
  }), [filters, view]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function run() {
      try {
        const basePayload = { ...payload };
        const [summary, timeseries, categoria, canal, estado, heatmap, points, topZonas] = await Promise.all([
          analyticsService.summary(basePayload),
          analyticsService.timeseries({ ...basePayload, metric: 'tickets_total', group: 'categoria' }),
          analyticsService.breakdown({ ...basePayload, dimension: 'categoria' }),
          analyticsService.breakdown({ ...basePayload, dimension: 'canal' }),
          analyticsService.breakdown({ ...basePayload, dimension: 'estado' }),
          analyticsService.heatmap(basePayload),
          analyticsService.points(basePayload),
          analyticsService.top({ ...basePayload, subject: 'zonas' }),
        ]);

        let operations = null;
        let cohorts = null;
        let templates = null;

        if (view === 'operaciones' || view === 'municipio') {
          operations = await analyticsService.operations(basePayload);
        }
        if (view === 'pyme') {
          cohorts = await analyticsService.cohorts(basePayload);
          templates = await analyticsService.templates(basePayload);
        }

        setData({
          summary,
          timeseries,
          breakdownCategoria: categoria,
          breakdownCanal: canal,
          breakdownEstado: estado,
          heatmap,
          points,
          topZonas,
          operations,
          cohorts,
          templates,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Error cargando datos');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    run();
    return () => controller.abort();
  }, [payload, view]);

  return { data, loading, error };
}
