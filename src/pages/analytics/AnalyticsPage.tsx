import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, BarChart3, Brain, Gauge, Loader2, MapPinned, Vote } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

import { analyticsService, AnalyticsSummary, RealtimeHubResponse } from '@/services/analyticsService';
import { enterpriseService, type LeadInteractionItem, type LeadInteractionsResponse } from '@/services/enterpriseService';
import OverviewDashboard from '@/components/analytics/OverviewDashboard';
import IdentityCoverageBanner from '@/components/analytics/IdentityCoverageBanner';
import HeatmapDashboard from '@/components/analytics/HeatmapDashboard';
import InsightsDashboard from '@/components/analytics/InsightsDashboard';
import MunicipioDashboard from '@/components/analytics/MunicipioDashboard';
import PymeDashboard from '@/components/analytics/PymeDashboard';
import RealtimeHubDashboard from '@/components/analytics/RealtimeHubDashboard';
import EnterpriseAIPanel from '@/components/analytics/EnterpriseAIPanel';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { OperationsDashboardPanel } from '@/features/analytics/OperationsDashboardPanel';
import { openExportAndTrack } from '@/utils/enterpriseExperience';
import { ApiError } from '@/utils/api';
import { getEnterpriseErrorMessage } from '@/utils/enterpriseErrors';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { buildTenantPath } from '@/utils/tenantPaths';


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

type AnalyticsTab = 'overview' | 'municipio' | 'pyme' | 'geo' | 'realtime' | 'operations';


const KPI_DICTIONARY: Array<{ key: string; label: string; definition: string }> = [
  { key: 'frt', label: 'FRT', definition: 'Tiempo promedio hasta la primera respuesta del equipo.' },
  { key: 'art', label: 'ART', definition: 'Tiempo promedio entre respuestas durante la conversación.' },
  { key: 'resolucion', label: 'Resolución', definition: 'Porcentaje de casos cerrados/resueltos en el período.' },
  { key: 'backlog', label: 'Backlog', definition: 'Cantidad de conversaciones/tickets pendientes de resolución.' },
  { key: 'sla_breach', label: 'SLA breach', definition: 'Casos que superaron el umbral objetivo de SLA.' },
  { key: 'deflection', label: 'Deflection', definition: 'Interacciones resueltas sin intervención humana.' },
  { key: 'csat', label: 'CSAT', definition: 'Satisfacción del usuario sobre conversaciones cerradas.' },
  { key: 'nps', label: 'NPS', definition: 'Lealtad percibida medida por recomendación del servicio.' },
];


const AnalyticsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSlug, tenant } = useTenant();
  const isEmbeddedInProfile = location.pathname === '/perfil';

  const tenantId = tenant?.id ? Number(tenant.id) : (parseInt(searchParams.get('tenant_id') || '0', 10));

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState(searchParams.get('range') || '7d');
  const [channelFilter, setChannelFilter] = useState(searchParams.get('canal') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('categoria') || '');
  const [zoneFilter, setZoneFilter] = useState(searchParams.get('distrito') || '');
  const [scope, setScope] = useState(() => resolveDefaultScope(tenant?.tipo));
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [leadInteractions, setLeadInteractions] = useState<LeadInteractionItem[]>([]);
  const [loadingLeadInteractions, setLoadingLeadInteractions] = useState(false);
  const [loadingMoreLeadInteractions, setLoadingMoreLeadInteractions] = useState(false);
  const [leadCursor, setLeadCursor] = useState<string | null>(null);
  const [leadPriorityFilter, setLeadPriorityFilter] = useState<string>('all');
  const [leadTenantFilter, setLeadTenantFilter] = useState<string>('all');
  const [hubNavigation, setHubNavigation] = useState<Array<{ key?: string; path?: string; active?: boolean }>>([]);
  const [hubSections, setHubSections] = useState<Record<string, unknown>>({});
  const [realtimeHub, setRealtimeHub] = useState<RealtimeHubResponse | null>(null);
  const [loadingRealtimeHub, setLoadingRealtimeHub] = useState(false);
  const [autoRefreshRealtimeHub, setAutoRefreshRealtimeHub] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  const hubEncuestasPath = useMemo(() => {
    const encuestasEntry = hubNavigation.find((item) => item?.key === 'encuestas' && typeof item?.path === 'string' && item.path);
    return encuestasEntry?.path || buildTenantPath('/admin/encuestas', currentSlug || undefined);
  }, [hubNavigation, currentSlug]);


  const realtimeUILabels = realtimeHub?.ui?.labels || {};

  const visibleTabs = useMemo(() => {
    const sectionMap: Record<string, 'overview' | 'municipio' | 'pyme' | 'geo' | 'realtime' | 'operations'> = {
      general: 'overview',
      municipio: 'municipio',
      ventas: 'pyme',
      mapas: 'geo',
      realtime_hub: 'realtime',
      operations: 'operations',
      operaciones: 'operations',
    };

    const tabsFromHub = Object.keys(hubSections)
      .map((key) => sectionMap[key])
      .filter(Boolean) as AnalyticsTab[];

    if (!tabsFromHub.length) {
      return ['overview', 'operations', 'municipio', 'pyme', 'geo', 'realtime'] as AnalyticsTab[];
    }

    return tabsFromHub.includes('operations')
      ? tabsFromHub
      : [...tabsFromHub.slice(0, 1), 'operations', ...tabsFromHub.slice(1)];
  }, [hubSections]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || 'overview');
    }
  }, [activeTab, visibleTabs]);

  const fireAndForgetTrackEvent = (payload: { tenant_id: number; event_name: string; payload?: Record<string, unknown>; channel?: string; session_id?: string }) => {
    enterpriseService
      .trackEvent(payload, currentSlug || undefined)
      .catch((trackError) => console.warn('[AnalyticsPage] tracking failed', trackError));
  };



  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('range', timeRange);
    if (channelFilter.trim()) next.set('canal', channelFilter.trim()); else next.delete('canal');
    if (categoryFilter.trim()) next.set('categoria', categoryFilter.trim()); else next.delete('categoria');
    if (zoneFilter.trim()) next.set('distrito', zoneFilter.trim()); else next.delete('distrito');
    next.set('scope', scope);
    const serializedCurrent = searchParams.toString();
    const serializedNext = next.toString();
    if (serializedCurrent !== serializedNext) {
      navigate({ search: `?${serializedNext}` }, { replace: true });
    }
  }, [timeRange, channelFilter, categoryFilter, zoneFilter, scope, searchParams, navigate]);

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
        context: activeTab === 'municipio' || activeTab === 'pyme' ? activeTab : 'overview',
        scope,
        canal: channelFilter || undefined,
        categoria: categoryFilter || undefined,
        distrito: zoneFilter || undefined,
      };
      let result: AnalyticsSummary;

      const hub = await analyticsService.getHub(requestPayload).catch(() => null);
      const primaryNavigation = Array.isArray(hub?.navigation?.primary) ? hub.navigation.primary : [];
      setHubNavigation(primaryNavigation);
      setHubSections((hub?.sections && typeof hub.sections === 'object') ? hub.sections as Record<string, unknown> : {});

      try {
        result = await analyticsService.getSummary(requestPayload, hub);
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
  }, [tenantId, currentSlug, dateRange, activeTab, scope, channelFilter, categoryFilter, zoneFilter]);

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

  const fetchRealtimeHub = useMemo(
    () => async () => {
      if (!tenantId) return;

      const windowMinutes = timeRange === '24h' ? 60 : timeRange === '7d' ? 30 : 15;
      setLoadingRealtimeHub(true);
      analyticsService
        .getRealtimeHub({
          tenant_id: tenantId,
          scope,
          window_minutes: windowMinutes,
          tenantSlug: currentSlug || undefined,
        })
        .then((response) => setRealtimeHub(response || null))
        .catch((error) => {
          console.warn('[AnalyticsPage] realtime hub unavailable', error);
          setRealtimeHub(null);
        })
        .finally(() => setLoadingRealtimeHub(false));
    },
    [tenantId, timeRange, scope, currentSlug],
  );

  useEffect(() => {
    fetchRealtimeHub();
  }, [fetchRealtimeHub]);

  useEffect(() => {
    if (!autoRefreshRealtimeHub || !tenantId) return;
    const timer = window.setInterval(() => {
      fetchRealtimeHub();
    }, 45000);
    return () => window.clearInterval(timer);
  }, [autoRefreshRealtimeHub, fetchRealtimeHub, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    setAutoRefreshRealtimeHub(true);
  }, [tenantId]);



  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!tenantId) return;
    const filters = { tenant_id: tenantId, scope, from: dateRange.from, to: dateRange.to, canal: channelFilter || undefined, categoria: categoryFilter || undefined, distrito: zoneFilter || undefined };
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
    <div className={`space-y-6 ${isEmbeddedInProfile ? 'p-0 bg-transparent min-h-0' : 'p-3 sm:p-6 bg-gray-50 dark:bg-slate-950 min-h-screen'}`}>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Brain className="h-3.5 w-3.5" />
              Inteligencia operativa
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reportes entendibles para decidir</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                Primero estado, prioridades y mapas. La analitica avanzada queda para investigar segmentos, generar
                resumen IA y exportar PDF/CSV.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => setActiveTab('overview')}>
                <Gauge className="h-4 w-4" />
                Estado general
              </Button>
              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => setActiveTab('operations')}>
                <BarChart3 className="h-4 w-4" />
                Operaciones
              </Button>
              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => setActiveTab('geo')}>
                <MapPinned className="h-4 w-4" />
                Mapas de calor
              </Button>
              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => navigate(hubEncuestasPath)}>
                <Vote className="h-4 w-4" />
                Encuestas
              </Button>
            </div>
          </div>
          <div className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground xl:max-w-sm">
            <p className="font-semibold text-foreground">Como leer esta seccion</p>
            <p><strong className="text-foreground">Estadisticas:</strong> tablero simple para administracion diaria.</p>
            <p><strong className="text-foreground">Analitica IA:</strong> investigacion, segmentos, mapas, resumen ejecutivo y exportaciones.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Filtros, IA y exportaciones</h2>
            <p className="text-muted-foreground">Métricas clave y comportamiento de tu audiencia en tiempo real.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isEmbeddedInProfile ? (
              <Button variant="outline" size="sm" onClick={() => navigate('/perfil')}>Perfil</Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => navigate(hubEncuestasPath)}>Encuestas</Button>
          </div>
        </div>

        <div className="sticky top-3 z-20 grid w-full gap-2 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
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

          <Input
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            placeholder="Canal"
            className="w-full sm:w-[150px]"
          />
          <Input
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Categoría"
            className="w-full sm:w-[150px]"
          />
          <Input
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            placeholder="Zona"
            className="w-full sm:w-[150px]"
          />
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


      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Diccionario de KPIs</summary>
        <p className="mt-1 text-sm text-muted-foreground">
          Ayuda para equipos avanzados. El tablero principal debe poder leerse sin abrir este bloque.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {KPI_DICTIONARY.map((item) => (
            <div key={item.key} className="rounded-md border border-border/60 p-2">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.definition}</p>
            </div>
          ))}
        </div>
      </details>

      <Tabs value={activeTab} className="w-full" onValueChange={(val) => { const tab = val as AnalyticsTab; setActiveTab(tab); if (tenantId) { fireAndForgetTrackEvent({ tenant_id: tenantId, event_name: 'tab_click', payload: { tab }, channel: 'web_widget', session_id: `sess_${Date.now()}` }); } }}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex min-w-max">
          {visibleTabs.includes('overview') ? <TabsTrigger value="overview">General</TabsTrigger> : null}
          {visibleTabs.includes('municipio') ? <TabsTrigger value="municipio">Municipio</TabsTrigger> : null}
          {visibleTabs.includes('pyme') ? <TabsTrigger value="pyme">Ventas</TabsTrigger> : null}
          {visibleTabs.includes('operations') ? <TabsTrigger value="operations">Operaciones</TabsTrigger> : null}
          {visibleTabs.includes('geo') ? <TabsTrigger value="geo">Mapas</TabsTrigger> : null}
          {visibleTabs.includes('realtime') ? <TabsTrigger value="realtime">{realtimeUILabels.tabs_realtime_hub || 'Realtime Hub'}</TabsTrigger> : null}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="overview">
            {activeTab === 'overview' && data ? <OverviewDashboard data={data} /> : null}
          </TabsContent>

          <TabsContent value="municipio">
            {activeTab === 'municipio' && data ? <MunicipioDashboard data={data} /> : null}
          </TabsContent>

          <TabsContent value="pyme">
            {activeTab === 'pyme' && data ? <PymeDashboard data={data} /> : null}
          </TabsContent>

          <TabsContent value="geo">
            {activeTab === 'geo' ? <HeatmapDashboard tenantId={tenantId} dateRange={dateRange} /> : null}
          </TabsContent>

          <TabsContent value="operations">
            {activeTab === 'operations' ? (
              <SectionErrorBoundary title="No pudimos cargar operaciones">
                <OperationsDashboardPanel />
              </SectionErrorBoundary>
            ) : null}
          </TabsContent>

          <TabsContent value="realtime">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchRealtimeHub()} disabled={loadingRealtimeHub}>
                {loadingRealtimeHub ? (realtimeUILabels.loading || 'Actualizando…') : (realtimeUILabels.actions_refresh || 'Actualizar')}
              </Button>
              <Button
                variant={autoRefreshRealtimeHub ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefreshRealtimeHub((prev) => !prev)}
              >
                {autoRefreshRealtimeHub ? (realtimeUILabels.actions_auto_refresh_on || 'Auto refresh ON') : (realtimeUILabels.actions_auto_refresh_off || 'Auto refresh OFF')}
              </Button>
            </div>
            <RealtimeHubDashboard data={realtimeHub} loading={loadingRealtimeHub} />
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
