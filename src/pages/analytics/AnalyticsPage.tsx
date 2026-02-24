import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

import { analyticsService, AnalyticsSummary } from '@/services/analyticsService';
import { enterpriseService, type LeadInteractionItem, type LeadInteractionsResponse } from '@/services/enterpriseService';
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
import { safeLocalStorage } from '@/utils/safeLocalStorage';


const resolveDefaultScope = (tenantType?: string | null) => {
  if (tenantType === 'pyme') return 'pyme';
  if (tenantType === 'municipio' || tenantType === 'municipal') return 'municipio';

  try {
    const rawUser = safeLocalStorage.getItem('user');
    if (!rawUser) return 'municipio';
    const user = JSON.parse(rawUser);
    if (user?.tipo_chat === 'pyme') return 'pyme';
    if (user?.tipo_chat === 'municipio') return 'municipio';
  } catch {
    return 'municipio';
  }

  return 'municipio';
};

const AnalyticsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentSlug, tenant } = useTenant();

  const tenantId = tenant?.id ? Number(tenant.id) : (parseInt(searchParams.get('tenant_id') || '0', 10));

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState('7d');
  const [scope, setScope] = useState(() => resolveDefaultScope(tenant?.tipo));
  const [context, setContext] = useState<'overview' | 'municipio' | 'pyme'>('overview');
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [leadInteractions, setLeadInteractions] = useState<LeadInteractionItem[]>([]);
  const [loadingLeadInteractions, setLoadingLeadInteractions] = useState(false);
  const [loadingMoreLeadInteractions, setLoadingMoreLeadInteractions] = useState(false);
  const [leadCursor, setLeadCursor] = useState<string | null>(null);
  const [leadPriorityFilter, setLeadPriorityFilter] = useState<string>('all');
  const [leadTenantFilter, setLeadTenantFilter] = useState<string>('all');

  const fireAndForgetTrackEvent = (payload: { tenant_id: number; event_name: string; payload?: Record<string, unknown>; channel?: string; session_id?: string }) => {
    enterpriseService
      .trackEvent(payload, currentSlug || undefined)
      .catch((trackError) => console.warn('[AnalyticsPage] tracking failed', trackError));
  };


  useEffect(() => {
    setScope((prevScope) => {
      const defaultScope = resolveDefaultScope(tenant?.tipo ?? null);
      return prevScope === defaultScope ? prevScope : defaultScope;
    });
  }, [tenant?.tipo]);

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
      const requestPayload = {
        tenant_id: tenantId,
        tenantSlug: currentSlug || undefined,
        from: dateRange.from,
        to: dateRange.to,
        context: context,
        scope,
      };
      let result: AnalyticsSummary;

      try {
        result = await analyticsService.getSummary(requestPayload);
      } catch (err: any) {
        const shouldTryAlternateScope =
          err instanceof ApiError &&
          err.status === 400 &&
          (scope === 'municipio' || scope === 'pyme');

        if (!shouldTryAlternateScope) {
          throw err;
        }

        const alternateScope = scope === 'municipio' ? 'pyme' : 'municipio';
        result = await analyticsService.getSummary({ ...requestPayload, scope: alternateScope });
        setScope(alternateScope);
      }

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
      const friendlyMessage = err instanceof ApiError ? getEnterpriseErrorMessage(err) : 'No se pudo cargar el dashboard.';
      setError(friendlyMessage || 'No se pudo cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId || currentSlug) {
        fetchData();
    }
  }, [tenantId, currentSlug, dateRange, context, scope]);

  const normalizeLeadInteractions = (response: LeadInteractionsResponse | null | undefined) => {
    if (!response) return [] as LeadInteractionItem[];
    if (Array.isArray(response.items)) return response.items;
    if (Array.isArray(response.interactions)) return response.interactions;
    return [] as LeadInteractionItem[];
  };

  const fetchLeadInteractions = async (options?: { cursor?: string; append?: boolean }) => {
    if (!tenantId) return;
    const isAppend = Boolean(options?.append);
    if (isAppend) {
      setLoadingMoreLeadInteractions(true);
    } else {
      setLoadingLeadInteractions(true);
    }

    try {
      const response = await enterpriseService.getLeadInteractions(
        {
          tenant_id: tenantId,
          limit: 20,
          cursor: options?.cursor,
          from: dateRange.from,
          to: dateRange.to,
          scope,
        },
        currentSlug || undefined,
      );
      const items = normalizeLeadInteractions(response);
      setLeadInteractions((prev) => (isAppend ? [...prev, ...items] : items));
      setLeadCursor(response?.next_cursor || response?.cursor || null);
    } catch (leadError) {
      console.warn('[AnalyticsPage] lead interactions unavailable', leadError);
      if (!isAppend) {
        setLeadInteractions([]);
        setLeadCursor(null);
      }
    } finally {
      if (isAppend) {
        setLoadingMoreLeadInteractions(false);
      } else {
        setLoadingLeadInteractions(false);
      }
    }
  };

  useEffect(() => {
    fetchLeadInteractions();
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
    <div className="p-3 sm:p-6 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics & Insights</h1>
            <p className="text-muted-foreground">Métricas clave y comportamiento de tu audiencia en tiempo real.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/perfil')}>Perfil</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/encuestas')}>Encuestas</Button>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24 horas</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-full sm:w-[180px]">
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Timeline de interacciones de leads</h2>
            {loadingLeadInteractions ? <span className="text-xs text-muted-foreground">Actualizando…</span> : null}
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <Select value={leadPriorityFilter} onValueChange={setLeadPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={leadTenantFilter} onValueChange={setLeadTenantFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tenants</SelectItem>
                {Array.from(new Set(leadInteractions.map((item) => item.tenant_slug).filter(Boolean) as string[])).map((slug) => (
                  <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => fetchLeadInteractions()}
              disabled={loadingLeadInteractions}
            >
              Refrescar
            </Button>
          </div>
          <div className="space-y-2">
            {leadInteractions
              .filter((item) => leadPriorityFilter === 'all' || (item.priority || '').toLowerCase() === leadPriorityFilter)
              .filter((item) => leadTenantFilter === 'all' || item.tenant_slug === leadTenantFilter)
              .map((item, index) => {
                const leadIdentifier = item.lead_name || item.lead_email || item.lead_phone;
                const scoreLabel = typeof item.score === 'number' ? String(item.score) : null;
                const priorityLabel = typeof item.priority === 'string' ? item.priority : null;
                return (
                  <div key={String(item.id || `${item.lead_email || item.lead_phone || index}`)} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {leadIdentifier ? <p className="text-sm font-medium">{leadIdentifier}</p> : null}
                      <div className="flex items-center gap-2">
                        {priorityLabel ? <span className="text-xs text-muted-foreground">{priorityLabel}</span> : null}
                        {scoreLabel ? <span className="text-xs text-muted-foreground">Score {scoreLabel}</span> : null}
                      </div>
                    </div>
                    {item.tenant_slug ? <p className="text-xs text-muted-foreground">{item.tenant_slug}</p> : null}
                    {item.intent ? <p className="text-xs text-muted-foreground">{item.intent}</p> : null}
                    {item.last_message ? <p className="text-sm mt-1">{item.last_message}</p> : null}
                  </div>
                );
              })}
          </div>
          {leadCursor ? (
            <div className="mt-3">
              <Button
                variant="outline"
                onClick={() => fetchLeadInteractions({ cursor: leadCursor, append: true })}
                disabled={loadingMoreLeadInteractions}
              >
                {loadingMoreLeadInteractions ? 'Cargando...' : 'Cargar más'}
              </Button>
            </div>
          ) : null}
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
