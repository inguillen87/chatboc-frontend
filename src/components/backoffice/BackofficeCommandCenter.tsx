import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  backofficeService,
  type BackofficeExportFormat,
  type BackofficeExportResource,
  type BackofficeScope,
} from '@/services/backofficeService';
import { getErrorMessage } from '@/utils/api';
import { useUser } from '@/hooks/useUser';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';

type Props = {
  tenantSlug?: string | null;
  scope?: BackofficeScope | null;
  className?: string;
};

type MetricCard = {
  id: string;
  label: string;
  value?: number | string | null;
  description?: string;
  tone?: 'default' | 'warning' | 'success';
  icon: React.ComponentType<{ className?: string }>;
};

type ExecutiveActionState = {
  scopeKey: string;
  aiSummary: Awaited<ReturnType<typeof backofficeService.requestExecutiveSummary>> | null;
  aiError: string | null;
  isLoadingAi: boolean;
  exporting: string | null;
};
const emptyExecutiveState = (scopeKey: string): ExecutiveActionState => ({
  scopeKey, aiSummary: null, aiError: null, isLoadingAi: false, exporting: null,
});

const formatValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('es-AR');
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '--';
};

const readText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

const readSlaCounts = (summary: Awaited<ReturnType<typeof backofficeService.getInboxSummary>>['summary']) => {
  const risk = readCount(summary?.sla_risk);
  const breached = readCount(summary?.sla_breached);
  const atRisk = readCount(summary?.sla_at_risk);
  const known = readCount(summary?.sla_known);
  const unknown = readCount(summary?.sla_unknown);
  const eligible = readCount(summary?.sla_eligible);
  if (risk === null || breached === null || atRisk === null || known === null || unknown === null || eligible === null
    || risk !== breached + atRisk || known < risk || eligible !== known + unknown) return null;
  return { risk, breached, atRisk, unknown };
};

const normalizeRecommendation = (value: unknown, index: number) => {
  const record = toRecord(value);
  if (!record) {
    const text = readText(value);
    return text ? { id: `text-${index}`, label: text, description: null } : null;
  }

  const label = readText(record.label, record.title, record.name, record.action, record.id);
  const description = readText(record.description, record.detail, record.reason, record.summary);
  if (!label && !description) return null;
  return {
    id: readText(record.id, record.key, label, index) ?? `recommendation-${index}`,
    label: label ?? description ?? 'Recomendacion',
    description,
  };
};

const toneClass: Record<NonNullable<MetricCard['tone']>, string> = {
  default: 'border-border/70 bg-card',
  warning: 'border-amber-500/30 bg-amber-500/10',
  success: 'border-emerald-500/30 bg-emerald-500/10',
};

export default function BackofficeCommandCenter({ tenantSlug, scope, className }: Props) {
  const { user, organizationProfileVerified } = useUser();
  const sessionRevision = captureChatbocSessionRevision();
  const actorId = user?.id == null ? null : String(user.id);
  const authorityKey = JSON.stringify([
    actorId, user?.rol ?? user?.role,
    user?.capabilities?.slice().sort(), user?.permissions?.slice().sort(), user?.scopes?.slice().sort(),
  ]);
  const enabled = Boolean(tenantSlug && actorId && organizationProfileVerified);
  const readScopeKey = JSON.stringify([tenantSlug, scope, authorityKey, sessionRevision]);
  const activeReadScopeRef = useRef<string | null>(null);
  activeReadScopeRef.current = enabled ? readScopeKey : null;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const readLifecycle = (signal: AbortSignal) => ({
    isCurrent: () => !signal.aborted && mountedRef.current
      && activeReadScopeRef.current === readScopeKey && isChatbocSessionRevisionCurrent(sessionRevision),
  });
  const readCacheScope = [tenantSlug, scope, authorityKey, sessionRevision];
  const executiveGenerationRef = useRef(0);
  const [executiveState, setExecutiveState] = useState(() => emptyExecutiveState(readScopeKey));
  const { aiSummary, aiError, isLoadingAi, exporting } = executiveState.scopeKey === readScopeKey && enabled
    ? executiveState : emptyExecutiveState(readScopeKey);
  useEffect(() => {
    executiveGenerationRef.current += 1;
    setExecutiveState(emptyExecutiveState(readScopeKey));
    return () => { executiveGenerationRef.current += 1; };
  }, [readScopeKey, enabled]);
  const actionLifecycle = () => {
    const actionScope = readScopeKey;
    const actionRevision = sessionRevision;
    const actionGeneration = executiveGenerationRef.current;
    return {
      isCurrent: () => mountedRef.current && activeReadScopeRef.current === actionScope
        && isChatbocSessionRevisionCurrent(actionRevision) && executiveGenerationRef.current === actionGeneration,
      update: (patch: Partial<Omit<ExecutiveActionState, 'scopeKey'>>) => {
        setExecutiveState(current => current.scopeKey === actionScope ? { ...current, ...patch } : current);
      },
    };
  };

  const inboxQuery = useQuery({
    queryKey: ['backoffice-inbox-summary', ...readCacheScope],
    queryFn: ({ signal }) => backofficeService.getInboxSummary({ tenantSlug, scope }, readLifecycle(signal)),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['backoffice-orders-summary', ...readCacheScope],
    queryFn: ({ signal }) => backofficeService.getOrdersSummary(tenantSlug, readLifecycle(signal)),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const contactsQuery = useQuery({
    queryKey: ['backoffice-contacts-summary', ...readCacheScope],
    queryFn: ({ signal }) => backofficeService.getContactsSummary(tenantSlug, readLifecycle(signal)),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const teamQuery = useQuery({
    queryKey: ['backoffice-team-summary', ...readCacheScope],
    queryFn: ({ signal }) => backofficeService.getTeamCoverageSummary(tenantSlug, readLifecycle(signal)),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const metrics = useMemo<MetricCard[]>(() => {
    const inbox = inboxQuery.data?.summary;
    const orders = ordersQuery.data;
    const contacts = contactsQuery.data;
    const team = teamQuery.data;
    const sla = readSlaCounts(inbox);
    const unassignedCases = readCount(inbox?.unassigned);
    const unassignedOrders = readCount(orders?.summary?.unassigned);
    const unassigned = unassignedCases !== null && unassignedOrders !== null
      ? unassignedCases + unassignedOrders : null;

    return [
      { id: 'open', label: 'Casos abiertos', value: inbox?.open, icon: Ticket, tone: inbox?.open ? 'warning' : 'default' },
      {
        id: 'sla',
        label: 'Riesgo SLA confirmado',
        value: sla?.risk,
        description: sla ? `${sla.breached} vencidos y ${sla.atRisk} en riesgo.` : 'Falta evidencia suficiente para evaluar el SLA.',
        icon: AlertTriangle,
        tone: sla && sla.risk > 0 ? 'warning' : 'default',
      },
      {
        id: 'sla-unknown',
        label: 'SLA sin verificar',
        value: sla?.unknown,
        description: 'Casos abiertos sin evidencia verificable del plazo de atención.',
        icon: AlertTriangle,
      },
      { id: 'orders', label: 'Pedidos activos', value: readCount(orders?.summary?.active), icon: CheckCircle2 },
      { id: 'contacts', label: 'Contactos', value: readCount(contacts?.summary?.total), icon: Users },
      { id: 'team', label: 'Equipo activo', value: readCount(team?.summary?.active_employees), icon: ShieldCheck },
      {
        id: 'unassigned',
        label: 'Sin responsable',
        value: unassigned,
        description: unassigned === null ? 'Falta información verificable de responsables para el total de casos y pedidos.' : undefined,
        icon: Users,
        tone: unassigned === null ? 'default' : unassigned > 0 ? 'warning' : 'success',
      },
    ];
  }, [contactsQuery.data, inboxQuery.data, ordersQuery.data, teamQuery.data]);

  const recommendations = useMemo(() => {
    const inboxViews = inboxQuery.data?.recommended_views ?? [];
    const teamRecommendations = Array.isArray(teamQuery.data?.assignment_recommendations)
      ? teamQuery.data.assignment_recommendations
      : [];
    return [...inboxViews, ...teamRecommendations]
      .map(normalizeRecommendation)
      .filter((item): item is { id: string; label: string; description: string | null } => Boolean(item))
      .slice(0, 5);
  }, [inboxQuery.data?.recommended_views, teamQuery.data?.assignment_recommendations]);

  const hasAnyData = metrics.some((metric) => metric.value !== undefined && metric.value !== null);
  const isLoading = inboxQuery.isLoading || ordersQuery.isLoading || contactsQuery.isLoading || teamQuery.isLoading;
  const hasError = inboxQuery.isError || ordersQuery.isError || contactsQuery.isError || teamQuery.isError;

  const refresh = () => {
    if (!enabled || activeReadScopeRef.current !== readScopeKey) return;
    void inboxQuery.refetch();
    void ordersQuery.refetch();
    void contactsQuery.refetch();
    void teamQuery.refetch();
  };

  const requestAiSummary = async () => {
    const action = actionLifecycle();
    if (!action.isCurrent()) return;
    action.update({ isLoadingAi: true, aiError: null });
    try {
      if (!action.isCurrent()) return;
      const summary = await backofficeService.requestExecutiveSummary({
        tenant_slug: tenantSlug,
        resource: 'overview',
        filters: { scope },
        source_endpoints: [
          '/api/v2/backoffice/operations/inbox-summary',
          '/api/v2/backoffice/orders/summary',
          '/api/v2/backoffice/contacts/summary',
          '/api/v2/backoffice/team/coverage-summary',
        ],
      }, { isCurrent: action.isCurrent });
      if (action.isCurrent()) action.update({ aiSummary: summary });
    } catch (error) {
      if (action.isCurrent()) action.update({ aiError: getErrorMessage(error, 'No se pudo generar el resumen IA.') });
    } finally {
      if (action.isCurrent()) action.update({ isLoadingAi: false });
    }
  };

  const requestExport = async (resource: BackofficeExportResource, format: BackofficeExportFormat) => {
    const action = actionLifecycle();
    if (!action.isCurrent()) return;
    const key = `${resource}-${format}`;
    action.update({ exporting: key });
    try {
      if (!action.isCurrent()) return;
      const result = await backofficeService.requestExport({
        tenant_slug: tenantSlug,
        resource,
        format,
        filters: { scope },
        include_ai_summary: format === 'pdf',
      }, { isCurrent: action.isCurrent });
      if (action.isCurrent()) window.open(result.download_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      if (action.isCurrent()) action.update({ aiError: getErrorMessage(error, 'No se pudo preparar la exportacion.') });
    } finally {
      if (action.isCurrent()) action.update({ exporting: null });
    }
  };

  if (!enabled) return null;

  return (
    <section className={cn('space-y-4', className)} aria-label="Centro de mando administrativo">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mando operativo</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Prioridades, equipo y exportaciones</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Información operativa confirmada. Los indicadores sin datos permanecen vacíos, sin completar valores por estimación.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={isLoading || !enabled}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {hasError && !hasAnyData ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-100">
            Los endpoints backoffice no estan disponibles todavia para este tenant. La pantalla queda preparada para consumirlos sin datos locales.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className={cn('shadow-sm', toneClass[metric.tone ?? 'default'])}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {metric.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatValue(metric.value)}</p>
                {metric.description ? <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Acciones recomendadas</CardTitle>
            <CardDescription>Solo se muestran acciones disponibles para este perfil y período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background px-3 py-3">
                  <p className="font-medium text-foreground">{item.label}</p>
                  {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
                </div>
              ))
            ) : (
              <p className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                No hay acciones recomendadas para este período.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              IA ejecutiva y exportaciones
            </CardTitle>
            <CardDescription>Resumen y archivos generados desde filtros reales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={requestAiSummary} disabled={isLoadingAi}>
                {isLoadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Resumen IA
              </Button>
              <Button type="button" variant="outline" onClick={() => void requestExport('tickets', 'pdf')} disabled={exporting !== null}>
                <Download className="h-4 w-4" />
                PDF casos
              </Button>
              <Button type="button" variant="outline" onClick={() => void requestExport('contacts', 'csv')} disabled={exporting !== null}>
                <Download className="h-4 w-4" />
                CSV contactos
              </Button>
            </div>

            {exporting ? <Badge variant="secondary">Preparando {exporting}</Badge> : null}
            {aiError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{aiError}</p> : null}
            {aiSummary ? (
              <div className="space-y-3 rounded-lg border bg-background px-3 py-3">
                {aiSummary.headline ? <p className="font-semibold text-foreground">{aiSummary.headline}</p> : null}
                {aiSummary.confidence !== undefined ? (
                  <Badge variant="outline">Confianza: {String(aiSummary.confidence)}</Badge>
                ) : null}
                {Array.isArray(aiSummary.data_quality_notes) && aiSummary.data_quality_notes.length > 0 ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {aiSummary.data_quality_notes.map((note, index) => (
                      <p key={`${String(note)}-${index}`}>{String(note)}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
