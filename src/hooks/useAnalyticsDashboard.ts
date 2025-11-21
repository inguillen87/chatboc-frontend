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

const EMPTY_DATA: DashboardData = {
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
};

export function useAnalyticsDashboard(view: AnalyticsContext) {
  const { filters } = useAnalyticsFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>(() => ({ ...EMPTY_DATA }));

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
    setWarning(null);

    if (!payload.tenantId) {
      setData({ ...EMPTY_DATA });
      setError('Seleccioná una entidad para ver métricas');
      setLoading(false);
      return () => controller.abort();
    }

    async function run() {
      try {
        const basePayload = { ...payload };
        const requests = [
          analyticsService.summary(basePayload),
          analyticsService.timeseries({ ...basePayload, metric: 'tickets_total', group: 'categoria' }),
          analyticsService.breakdown({ ...basePayload, dimension: 'categoria' }),
          analyticsService.breakdown({ ...basePayload, dimension: 'canal' }),
          analyticsService.breakdown({ ...basePayload, dimension: 'estado' }),
          analyticsService.heatmap(basePayload),
          analyticsService.points(basePayload),
          analyticsService.top({ ...basePayload, subject: 'zonas' }),
        ];

        const results = await Promise.allSettled(requests);
        if (controller.signal.aborted) return;

        const nextData: DashboardData = { ...EMPTY_DATA };
        const failedSections: string[] = [];

        const assignResult = <K extends keyof DashboardData>(
          key: K,
          resultIndex: number,
          label: string,
        ) => {
          const result = results[resultIndex];
          if (result.status === 'fulfilled') {
            nextData[key] = result.value as DashboardData[K];
          } else {
            failedSections.push(label);
          }
        };

        assignResult('summary', 0, 'resumen');
        assignResult('timeseries', 1, 'series');
        assignResult('breakdownCategoria', 2, 'categorías');
        assignResult('breakdownCanal', 3, 'canales');
        assignResult('breakdownEstado', 4, 'estados');
        assignResult('heatmap', 5, 'mapa de calor');
        assignResult('points', 6, 'puntos georreferenciados');
        assignResult('topZonas', 7, 'zonas');

        if (view === 'operaciones' || view === 'municipio') {
          const operationsResult = await Promise.allSettled([
            analyticsService.operations(basePayload),
          ]);
          if (controller.signal.aborted) return;
          const [ops] = operationsResult;
          if (ops.status === 'fulfilled') {
            nextData.operations = ops.value;
          } else {
            failedSections.push('operaciones');
          }
        }

        if (view === 'pyme') {
          const [cohortsResult, templatesResult] = await Promise.allSettled([
            analyticsService.cohorts(basePayload),
            analyticsService.templates(basePayload),
          ]);
          if (controller.signal.aborted) return;
          if (cohortsResult.status === 'fulfilled') {
            nextData.cohorts = cohortsResult.value;
          } else {
            failedSections.push('cohortes');
          }
          if (templatesResult.status === 'fulfilled') {
            nextData.templates = templatesResult.value;
          } else {
            failedSections.push('plantillas');
          }
        }

        const hasAnyData = Object.values(nextData).some(Boolean);
        if (!hasAnyData) {
          setError('Las métricas no están disponibles por ahora. Verificá la conexión y reintentá.');
          setData({ ...EMPTY_DATA });
          return;
        }

        setData(nextData);
        setError(null);
        setWarning(
          failedSections.length
            ? `Algunos widgets no se pudieron cargar (${failedSections.join(', ')}). Verificá la conexión del backend o reintentá más tarde.`
            : null,
        );
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

  return { data, loading, error, warning };
}
