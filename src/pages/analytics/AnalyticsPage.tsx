import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

import { analyticsService, AnalyticsSummary } from '@/services/analyticsService';
import { enterpriseService, type LeadInteractionItem } from '@/services/enterpriseService';
import OverviewDashboard from '@/components/analytics/OverviewDashboard';
import HeatmapDashboard from '@/components/analytics/HeatmapDashboard';
import InsightsDashboard from '@/components/analytics/InsightsDashboard';
import MunicipioDashboard from '@/components/analytics/MunicipioDashboard';
import PymeDashboard from '@/components/analytics/PymeDashboard';
import EnterpriseAIPanel from '@/components/analytics/EnterpriseAIPanel';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { openExportAndTrack } from '@/utils/enterpriseExperience';
import { ApiError } from '@/utils/api';
import { getEnterpriseErrorMessage } from '@/utils/enterpriseErrors';

const AnalyticsPage = () => {
  const [searchParams] = useSearchParams();
  const { currentSlug, tenant } = useTenant();

  const tenantId = tenant?.id ? Number(tenant.id) : (parseInt(searchParams.get('tenant_id') || '0', 10));

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState('7d');
  const [scope, setScope] = useState('municipio');
  const [context, setContext] = useState<'overview' | 'municipio' | 'pyme'>('overview');
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [leadInteractions, setLeadInteractions] = useState<LeadInteractionItem[]>([]);
  const [loadingLeadInteractions, setLoadingLeadInteractions] = useState(false);

  const fireAndForgetTrackEvent = (payload: { tenant_id: number; event_name: string; payload?: Record<string, unknown>; channel?: string; session_id?: string }) => {
    enterpriseService
      .trackEvent(payload, currentSlug || undefined)
      .catch((trackError) => console.warn('[AnalyticsPage] tracking failed', trackError));
  };

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
        context: context,
        scope
      });
      setData(result);
      if (tenantId) {
        fireAndForgetTrackEvent({
          tenant_id: tenantId,
          event_name: 'dashboard_view',
          payload: { path: '/panel/analytics', source: 'web' },
          channel: 'web_widget',
          session_id: `sess_${Date.now()}`
        });
      }
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
  }, [tenantId, currentSlug, dateRange, context, scope]);

  useEffect(() => {
    let cancelled = false;
    const fetchLeadInteractions = async () => {
      if (!tenantId) return;
      setLoadingLeadInteractions(true);
      try {
        const response = await enterpriseService.getLeadInteractions(
          { tenant_id: tenantId, limit: 20, from: dateRange.from, to: dateRange.to, scope },
          currentSlug || undefined,
        );
        if (cancelled) return;
        const items = Array.isArray(response?.items)
          ? response.items
          : (Array.isArray(response?.interactions) ? response.interactions : []);
        setLeadInteractions(items);
      } catch (leadError) {
        if (!cancelled) {
          console.warn('[AnalyticsPage] lead interactions unavailable', leadError);
          setLeadInteractions([]);
        }
      } finally {
        if (!cancelled) setLoadingLeadInteractions(false);
      }
    };

    fetchLeadInteractions();
    return () => {
      cancelled = true;
    };
  }, [tenantId, currentSlug, dateRange.from, dateRange.to, scope]);



  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!tenantId) return;
    const filters = { tenant_id: tenantId, scope, from: dateRange.from, to: dateRange.to };
    const url = format === 'csv' ? analyticsService.exportCsvUrl(filters) : analyticsService.exportPdfUrl(filters);
    openExportAndTrack(url, async () => {
      fireAndForgetTrackEvent({
        tenant_id: tenantId,
        event_name: 'export_click',
        payload: { format, scope },
        channel: 'web_widget',
        session_id: `sess_${Date.now()}`
      });
    });
  };


  const handleGenerateExecutiveSummary = async () => {
    if (!tenantId) return;
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const response = await enterpriseService.getExecutiveSummary(
        {
          tenant_id: tenantId,
          scope,
          from: dateRange.from,
          to: dateRange.to,
          strict_no_data_message: true,
        },
        currentSlug || undefined,
      );
      const summaryText = response?.summary || response?.text || '';
      setExecutiveSummary(summaryText);
      if (!summaryText) {
        setSummaryError('No hay datos suficientes para generar el resumen en este período.');
      }
    } catch (err) {
      console.error(err);
      setExecutiveSummary('');
      const status = err instanceof ApiError ? err.status : undefined;
      setSummaryError(getEnterpriseErrorMessage(status, 'executive_summary'));
    } finally {
      setLoadingSummary(false);
    }
  };

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
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-muted-foreground">Métricas clave y comportamiento de tu audiencia en tiempo real.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="municipio">Municipio</SelectItem>
              <SelectItem value="pyme">Pyme</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport('csv')}>Export CSV</Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>Export PDF</Button>
          <Button variant="default" onClick={handleGenerateExecutiveSummary} disabled={loadingSummary}>
            {loadingSummary ? 'Generando...' : 'Resumen ejecutivo IA'}
          </Button>
        </div>
      </div>


      {summaryError ? <p className="text-sm text-destructive">{summaryError}</p> : null}

      {executiveSummary ? (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold mb-2">Resumen ejecutivo</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{executiveSummary}</p>
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="w-full" onValueChange={(val) => { setContext(val as any); if (tenantId) { fireAndForgetTrackEvent({ tenant_id: tenantId, event_name: 'tab_click', payload: { tab: val }, channel: 'web_widget', session_id: `sess_${Date.now()}` }); } }}>
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
            {data && <MunicipioDashboard data={data} />}
          </TabsContent>

          <TabsContent value="pyme">
            {data && <PymeDashboard data={data} />}
          </TabsContent>

          <TabsContent value="geo">
            <HeatmapDashboard tenantId={tenantId} dateRange={dateRange} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Insights Section always visible at bottom or side */}
      <div className="mt-8">
        <SectionErrorBoundary title="No pudimos cargar insights">
          <InsightsDashboard tenantId={tenantId} />
        </SectionErrorBoundary>
      </div>


      {leadInteractions.length > 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Timeline de interacciones de leads</h2>
            {loadingLeadInteractions ? <span className="text-xs text-muted-foreground">Actualizando…</span> : null}
          </div>
          <div className="space-y-2">
            {leadInteractions.map((item, index) => {
              const leadIdentifier = item.lead_name || item.lead_email || item.lead_phone;
              const scoreLabel = typeof item.score === 'number' ? String(item.score) : null;
              return (
                <div key={String(item.id || `${item.lead_email || item.lead_phone || index}`)} className="rounded-md border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {leadIdentifier ? <p className="text-sm font-medium">{leadIdentifier}</p> : null}
                    {scoreLabel ? <span className="text-xs text-muted-foreground">Score {scoreLabel}</span> : null}
                  </div>
                  {item.intent ? <p className="text-xs text-muted-foreground">{item.intent}</p> : null}
                  {item.last_message ? <p className="text-sm mt-1">{item.last_message}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <SectionErrorBoundary title="No pudimos cargar herramientas IA">
          <EnterpriseAIPanel tenantId={tenantId} tenantSlug={currentSlug || undefined} scope={scope} />
        </SectionErrorBoundary>
      </div>
    </div>
  );
};

export default AnalyticsPage;
