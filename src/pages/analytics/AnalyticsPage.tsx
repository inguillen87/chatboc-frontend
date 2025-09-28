import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsFiltersProvider, useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';
import { analyticsService, type FilterCatalogResponse } from '@/services/analyticsService';
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar';
import { MunicipioDashboard } from './MunicipioDashboard';
import { PymeDashboard } from './PymeDashboard';
import { OperationsDashboard } from './OperationsDashboard';
import { getAnalyticsSettings } from '@/utils/config';
import type { AnalyticsContext } from '@/services/analyticsService';

interface AnalyticsPageContentProps {
  initialTenants?: string[];
  defaultTenantId?: string;
}

function AnalyticsPageContent({ initialTenants = [], defaultTenantId }: AnalyticsPageContentProps) {
  const { filters, setFilters } = useAnalyticsFilters();
  const [filterCatalog, setFilterCatalog] = useState<FilterCatalogResponse | undefined>();
  const [loadingFilters, setLoadingFilters] = useState(false);

  const tenantOptions = useMemo(() => {
    const fromCatalog = filterCatalog?.tenants ?? [];
    return Array.from(new Set([...initialTenants, ...fromCatalog]));
  }, [filterCatalog?.tenants, initialTenants]);

  useEffect(() => {
    const preferredTenant = filterCatalog?.defaultTenantId || defaultTenantId || tenantOptions[0];
    if (!preferredTenant) return;
    if (!filters.tenantId) {
      setFilters({ tenantId: preferredTenant });
      return;
    }
    if (!tenantOptions.length) return;
    if (!tenantOptions.includes(filters.tenantId)) {
      setFilters({ tenantId: preferredTenant });
    }
  }, [tenantOptions, filters.tenantId, setFilters, filterCatalog?.defaultTenantId, defaultTenantId]);

  useEffect(() => {
    let active = true;
    async function loadFilters() {
      setLoadingFilters(true);
      if (!filters.tenantId) {
        setFilterCatalog(undefined);
        setLoadingFilters(false);
        return;
      }
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
      <AnalyticsFilterBar
        filters={filterCatalog}
        loading={loadingFilters}
        tenantOptions={tenantOptions}
      />
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
  const settings = getAnalyticsSettings();
  const allowedContexts: AnalyticsContext[] = ['municipio', 'pyme', 'operaciones'];
  const defaultContext = useMemo(() => {
    if (!settings.defaultContext) return 'municipio' as AnalyticsContext;
    return allowedContexts.includes(settings.defaultContext as AnalyticsContext)
      ? (settings.defaultContext as AnalyticsContext)
      : ('municipio' as AnalyticsContext);
  }, [settings.defaultContext]);

  return (
    <AnalyticsFiltersProvider defaultTenantId={settings.defaultTenantId} defaultContext={defaultContext}>
      <AnalyticsPageContent
        initialTenants={settings.tenants}
        defaultTenantId={settings.defaultTenantId}
      />
    </AnalyticsFiltersProvider>
  );
}
