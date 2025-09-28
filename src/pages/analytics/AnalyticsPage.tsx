import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsFiltersProvider, useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';
import { analyticsService, type FilterCatalogResponse } from '@/services/analyticsService';
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar';
import { MunicipioDashboard } from './MunicipioDashboard';
import { PymeDashboard } from './PymeDashboard';
import { OperationsDashboard } from './OperationsDashboard';

function AnalyticsPageContent() {
  const { filters, setFilters } = useAnalyticsFilters();
  const [filterCatalog, setFilterCatalog] = useState<FilterCatalogResponse | undefined>();
  const [loadingFilters, setLoadingFilters] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFilters() {
      setLoadingFilters(true);
      try {
        const result = await analyticsService.filters({
          tenantId: filters.tenantId,
          from: filters.from,
          to: filters.to,
          context: filters.context,
        });
        if (active) {
          setFilterCatalog(result);
        }
      } catch (error) {
        console.error('No se pudieron cargar los filtros', error);
      } finally {
        if (active) {
          setLoadingFilters(false);
        }
      }
    }
    loadFilters();
    return () => {
      active = false;
    };
  }, [filters.tenantId, filters.from, filters.to, filters.context]);

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar filters={filterCatalog} loading={loadingFilters} />
      <Tabs
        value={filters.context ?? 'municipio'}
        onValueChange={(value) => setFilters({ context: value })}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="municipio">Municipio</TabsTrigger>
          <TabsTrigger value="pyme">PyME</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="municipio">
          <MunicipioDashboard />
        </TabsContent>
        <TabsContent value="pyme">
          <PymeDashboard />
        </TabsContent>
        <TabsContent value="operaciones">
          <OperationsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AnalyticsFiltersProvider defaultTenantId="tenant-municipio-1" defaultContext="municipio">
      <AnalyticsPageContent />
    </AnalyticsFiltersProvider>
  );
}
