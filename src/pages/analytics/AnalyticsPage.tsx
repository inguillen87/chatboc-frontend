import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTenant } from '@/context/TenantContext'; // Added to get tenant context

import { analyticsService, AnalyticsSummary } from '../../services/analyticsService';
import OverviewDashboard from '../../components/analytics/OverviewDashboard';
import HeatmapDashboard from '../../components/analytics/HeatmapDashboard';
import InsightsDashboard from '../../components/analytics/InsightsDashboard';

const AnalyticsPage = () => {
  const [searchParams] = useSearchParams();
  const { currentSlug, tenant } = useTenant(); // Get current tenant context

  // Use tenant ID from context if available, otherwise fallback or 0
  const tenantId = tenant?.id ? Number(tenant.id) : (parseInt(searchParams.get('tenant_id') || '0', 10));

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState('7d');
  const [context, setContext] = useState<'overview' | 'municipio' | 'pyme'>('overview');

  // Compute dates based on timeRange
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    if (timeRange === '24h') from.setHours(from.getHours() - 24);
    if (timeRange === '7d') from.setDate(from.getDate() - 7);
    if (timeRange === '30d') from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyticsService.getSummary({
        tenant_id: tenantId,
        tenantSlug: currentSlug || undefined,
        from: dateRange.from,
        to: dateRange.to,
        context: context
      });
      setData(result);
    } catch (err: any) {
      console.error(err);
      setError("No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId || currentSlug) {
        fetchData();
    }
  }, [tenantId, currentSlug, dateRange, context]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
        <p>{error}</p>
        <Button onClick={fetchData} variant="outline" className="mt-4">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Analytics</h1>
          <p className="text-gray-500">Metricas en tiempo real</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24 horas</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full" onValueChange={(val) => setContext(val as any)}>
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="overview">General</TabsTrigger>
          <TabsTrigger value="municipio">Municipio</TabsTrigger>
          <TabsTrigger value="pyme">Ventas</TabsTrigger>
          <TabsTrigger value="geo">Mapas</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            {data && <OverviewDashboard data={data} />}
          </TabsContent>

          <TabsContent value="municipio">
            {data && <OverviewDashboard data={data} showSla={true} />}
          </TabsContent>

          <TabsContent value="pyme">
            {data && <OverviewDashboard data={data} showConversion={true} />}
          </TabsContent>

          <TabsContent value="geo">
            <HeatmapDashboard tenantId={tenantId} dateRange={dateRange} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Insights Section always visible at bottom or side */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Insights IA</h2>
        <InsightsDashboard tenantId={tenantId} />
      </div>
    </div>
  );
};

export default AnalyticsPage;
