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
import { downloadPrivateBackofficeExport } from '@/services/backofficeExportDownload';

type Props = {
  tenantSlug?: string | null;
  tenantId?: number | null;
  tenantRevision?: string | number | null;
  scope?: BackofficeScope | null;
  ordersEnabled?: boolean;
  onOpenCases?: () => void;
  onOpenOrders?: () => void;
  onOpenContacts?: () => void;
  onOpenTeam?: () => void;
  className?: string;
};

type MetricCard = {
  id: string;
  label: string;
  detailLabel?: string;
  value?: number | string | null;
  description?: string;
  emptyState?: {
    message: string;
    actionLabel: string;
    action?: () => void;
  };
  zeroDescription?: string;
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
  return 'Sin datos';
};

const clearPanelText = (value: string): string => value
  .replace(/\bmatriz técnica de ruteo\b/gi, 'quién atiende cada tema')
  .replace(/\btemas? de ruteo\b/gi, 'temas sin responsable definido')
  .replace(/\bruteo\b/gi, 'asignación de responsables')
  .replace(/\btickets\b/gi, 'casos')
  .replace(/\bticket\b/gi, 'caso')
  .replace(/\bSLA\b/g, 'plazo')
  .replace(/\bsentimiento neutral\b/gi, 'el mensaje no muestra una emoción marcada')
  .replace(/\bmonitoreo operativo\b/gi, 'seguimiento de la actividad')
  .replace(/\bfoco del momento\b/gi, 'qué requiere atención ahora')
  .replace(/\bcentro operativo\b/gi, 'actividad y pendientes')
  .replace(/\btablero operativo\b/gi, 'actividad y resultados')
  .replace(/\bcentro de mando\b/gi, 'resumen de casos y equipo')
  .replace(/^requiere revisión$/i, 'Revisá los datos de esta recomendación')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

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
    return text ? { id: `text-${index}`, label: clearPanelText(text), description: null } : null;
  }

  const label = readText(record.label, record.title, record.name, record.action);
  const description = readText(record.description, record.detail, record.reason, record.summary);
  if (!label && !description) return null;
  return {
    id: readText(record.id, record.key, label, index) ?? `recommendation-${index}`,
    label: clearPanelText(label ?? description ?? 'Recomendación'),
    description: description ? clearPanelText(description) : null,
  };
};

const toneClass: Record<NonNullable<MetricCard['tone']>, string> = {
  default: 'border-border/70 bg-card',
  warning: 'border-amber-500/30 bg-amber-500/10',
  success: 'border-emerald-500/30 bg-emerald-500/10',
};

export default function BackofficeCommandCenter({
  tenantSlug,
  tenantId,
  tenantRevision,
  scope,
  ordersEnabled = true,
  onOpenCases,
  onOpenOrders,
  onOpenContacts,
  onOpenTeam,
  className,
}: Props) {
  const { user, organizationProfileVerified } = useUser();
  const sessionRevision = captureChatbocSessionRevision();
  const actorId = user?.id == null ? null : String(user.id);
  const authorityKey = JSON.stringify([
    actorId, user?.rol ?? user?.role,
    user?.capabilities?.slice().sort(), user?.permissions?.slice().sort(), user?.scopes?.slice().sort(),
    user?.categoria_id, user?.categoria_ids, user?.categorias,
  ]);
  const enabled = Boolean(tenantSlug && actorId && organizationProfileVerified);
  const canExport = enabled && typeof tenantId === 'number' && Number.isSafeInteger(tenantId) && tenantId > 0;
  const readScopeKey = JSON.stringify([
    tenantSlug,
    tenantId,
    tenantRevision,
    scope,
    ordersEnabled,
    authorityKey,
    sessionRevision,
    organizationProfileVerified,
  ]);
  const readAuthorityRef = useRef({ key: readScopeKey, epoch: 0 });
  if (readAuthorityRef.current.key !== readScopeKey) {
    readAuthorityRef.current = { key: readScopeKey, epoch: readAuthorityRef.current.epoch + 1 };
  }
  const readEpoch = readAuthorityRef.current.epoch;
  const activeReadScopeRef = useRef<string | null>(null);
  activeReadScopeRef.current = enabled ? readScopeKey : null;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const readLifecycle = (signal: AbortSignal) => ({
    isCurrent: () => !signal.aborted && mountedRef.current
      && activeReadScopeRef.current === readScopeKey && readAuthorityRef.current.epoch === readEpoch
      && isChatbocSessionRevisionCurrent(sessionRevision),
  });
  const readCacheScope = [
    tenantSlug,
    tenantId,
    tenantRevision,
    scope,
    ordersEnabled,
    authorityKey,
    sessionRevision,
    organizationProfileVerified,
  ];
  const executiveGenerationRef = useRef(0);
  const exportInFlightRef = useRef<{ isCurrent: () => boolean } | null>(null);
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
        && readAuthorityRef.current.epoch === readEpoch
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
    enabled: enabled && ordersEnabled,
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
    const unassignedOrders = ordersEnabled ? readCount(orders?.summary?.unassigned) : null;
    const unassigned = ordersEnabled
      ? unassignedCases !== null && unassignedOrders !== null
        ? unassignedCases + unassignedOrders
        : null
      : unassignedCases;

    const visibleMetrics: MetricCard[] = [
      {
        id: 'open',
        label: 'Casos abiertos',
        value: inbox?.open,
        icon: Ticket,
        tone: inbox?.open ? 'warning' : 'default',
        emptyState: {
          message: 'No hay casos abiertos en este momento.',
          actionLabel: 'Revisar casos',
          action: onOpenCases,
        },
      },
      {
        id: 'sla',
        label: 'Fuera de plazo o por vencer',
        detailLabel: 'Plazo vencido o por vencer',
        value: sla?.risk,
        description: sla ? `${sla.breached} vencidos y ${sla.atRisk} en riesgo.` : 'Todavía no hay datos suficientes para evaluar los plazos.',
        zeroDescription: 'No hay casos confirmados fuera de plazo ni por vencer.',
        icon: AlertTriangle,
        tone: sla && sla.risk > 0 ? 'warning' : 'default',
      },
      {
        id: 'sla-unknown',
        label: 'Plazos por revisar',
        detailLabel: 'Plazo sin verificar',
        value: sla?.unknown,
        description: 'Casos abiertos sin un plazo de atención que se pueda comprobar.',
        zeroDescription: 'Todos los casos abiertos tienen un plazo que se puede comprobar.',
        icon: AlertTriangle,
      },
      {
        id: 'contacts',
        label: 'Contactos',
        value: readCount(contacts?.summary?.total),
        icon: Users,
        emptyState: {
          message: 'Todavía no hay contactos registrados.',
          actionLabel: 'Abrir contactos',
          action: onOpenContacts,
        },
      },
      {
        id: 'team',
        label: 'Personas en el equipo',
        value: readCount(team?.summary?.active_employees),
        icon: ShieldCheck,
        emptyState: {
          message: 'Todavía no hay personas activas en el equipo.',
          actionLabel: 'Sumar a la primera persona del equipo',
          action: onOpenTeam,
        },
      },
      {
        id: 'unassigned',
        label: 'Sin responsable',
        value: unassigned,
        description: unassigned === null
          ? ordersEnabled
            ? 'Falta información para saber cuántos casos y pedidos no tienen responsable.'
            : 'Falta información para saber cuántos casos no tienen responsable.'
          : undefined,
        zeroDescription: ordersEnabled
          ? 'Todos los casos y pedidos informados tienen responsable.'
          : 'Todos los casos informados tienen responsable.',
        icon: Users,
        tone: unassigned === null ? 'default' : unassigned > 0 ? 'warning' : 'success',
      },
    ];
    if (ordersEnabled) {
      visibleMetrics.splice(3, 0, {
        id: 'orders',
        label: 'Pedidos activos',
        value: readCount(orders?.summary?.active),
        icon: CheckCircle2,
        emptyState: {
          message: 'No hay pedidos activos en este momento.',
          actionLabel: 'Revisar pedidos',
          action: onOpenOrders,
        },
      });
    }
    return visibleMetrics;
  }, [
    contactsQuery.data,
    inboxQuery.data,
    onOpenCases,
    onOpenContacts,
    onOpenOrders,
    onOpenTeam,
    ordersEnabled,
    ordersQuery.data,
    teamQuery.data,
  ]);

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
  const isLoading = inboxQuery.isLoading || contactsQuery.isLoading || teamQuery.isLoading
    || (ordersEnabled && ordersQuery.isLoading);
  const hasError = inboxQuery.isError || contactsQuery.isError || teamQuery.isError
    || (ordersEnabled && ordersQuery.isError);

  const refresh = () => {
    if (!enabled || activeReadScopeRef.current !== readScopeKey) return;
    void inboxQuery.refetch();
    if (ordersEnabled) void ordersQuery.refetch();
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
          ...(ordersEnabled ? ['/api/v2/backoffice/orders/summary'] : []),
          '/api/v2/backoffice/contacts/summary',
          '/api/v2/backoffice/team/coverage-summary',
        ],
      }, { isCurrent: action.isCurrent });
      if (action.isCurrent()) action.update({ aiSummary: summary });
    } catch (error) {
      if (action.isCurrent()) action.update({ aiError: getErrorMessage(error, 'No pudimos preparar el resumen automático.') });
    } finally {
      if (action.isCurrent()) action.update({ isLoadingAi: false });
    }
  };

  const requestExport = async (resource: BackofficeExportResource, format: BackofficeExportFormat) => {
    const action = actionLifecycle();
    if (!canExport || !action.isCurrent() || exportInFlightRef.current?.isCurrent()) return;
    const attempt = { isCurrent: action.isCurrent };
    exportInFlightRef.current = attempt;
    const key = `${resource}-${format}`;
    action.update({ exporting: key, aiError: null });
    try {
      if (!action.isCurrent()) return;
      const result = await backofficeService.requestExport({
        tenant_slug: tenantSlug!,
        tenant_id: tenantId!,
        resource,
        format,
        filters: { scope },
      }, { isCurrent: action.isCurrent });
      if (action.isCurrent()) downloadPrivateBackofficeExport(result, action.isCurrent);
    } catch (error) {
      if (action.isCurrent()) action.update({ aiError: getErrorMessage(error, 'No pudimos preparar el archivo. Intentá nuevamente.') });
    } finally {
      if (exportInFlightRef.current === attempt) exportInFlightRef.current = null;
      if (action.isCurrent()) action.update({ exporting: null });
    }
  };

  if (!enabled) return null;

  return (
    <section className={cn('space-y-4', className)} aria-label="Resumen de casos y equipo">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Qué requiere atención</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisá los casos, los plazos y el equipo. Actualizá los datos para ver los cambios más recientes.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={refresh} disabled={isLoading || !enabled}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Actualizar datos
        </Button>
      </div>

      {hasError && !hasAnyData ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="space-y-3 p-4 text-sm text-amber-950 dark:text-amber-50">
            <div>
              <p className="font-semibold">No pudimos cargar este resumen</p>
              <p className="mt-1">Volvé a intentarlo para consultar los datos más recientes.</p>
            </div>
            <Button type="button" variant="outline" className="min-h-11" onClick={refresh} disabled={isLoading}>
              Volver a intentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className={cn('grid sm:grid-cols-2 lg:grid-cols-3', ordersEnabled ? 'xl:grid-cols-7' : 'xl:grid-cols-6')}>
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const value = formatValue(metric.value);
            const isEmpty = metric.value === 0 && Boolean(metric.emptyState);
            return (
              <article
                key={metric.id}
                className={cn(
                  'min-w-0 space-y-2 border-b border-border/60 p-4 sm:border-r',
                  toneClass[metric.tone ?? 'default'],
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h3 className="min-w-0 break-words text-sm font-medium leading-snug text-muted-foreground">
                    {metric.label}
                  </h3>
                </div>
                <p className={cn('break-words font-semibold tabular-nums', value === 'Sin datos' ? 'text-base' : 'text-2xl')}>
                  {value}
                </p>
                {isEmpty ? (
                  <div className="space-y-2">
                    <p className="text-xs leading-5 text-muted-foreground">{metric.emptyState?.message}</p>
                    {metric.emptyState?.action ? (
                      <Button type="button" variant="link" className="min-h-11 h-auto justify-start whitespace-normal p-0 text-left" onClick={metric.emptyState.action}>
                        {metric.emptyState.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                ) : metric.value === 0 && metric.zeroDescription ? (
                  <p className="text-xs leading-5 text-muted-foreground">{metric.zeroDescription}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <details key={readScopeKey} className="rounded-lg border border-border/70 bg-muted/20 px-3 text-sm text-muted-foreground">
        <summary tabIndex={0} className="min-h-11 cursor-pointer select-none py-3 font-medium text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Datos para soporte
        </summary>
        <div className="space-y-3 pb-3">
          <p>
            Estos valores provienen de información confirmada. Si falta un dato, no lo completamos con una estimación.
          </p>
          <p>“Sin datos” significa que la fuente no informó un valor; 0 es un valor confirmado.</p>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.filter((metric) => metric.description).map((metric) => (
              <div key={metric.id}>
                <dt className="font-medium text-foreground">{metric.detailLabel ?? metric.label}</dt>
                <dd className="mt-1 text-xs leading-relaxed">{metric.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Qué conviene revisar</CardTitle>
            <CardDescription>Estas sugerencias se basan en la información disponible para tu perfil y el período elegido.</CardDescription>
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
              <div className="space-y-3 rounded-lg border bg-muted/20 px-3 py-3">
                <p className="text-sm text-muted-foreground">
                  Todavía no hay sugerencias para este período. Actualizá los datos para volver a comprobarlo.
                </p>
                <Button type="button" variant="outline" className="min-h-11" onClick={refresh} disabled={isLoading}>
                  Actualizar sugerencias
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" aria-hidden="true" />
              Preparar un resumen o descargar datos
            </CardTitle>
            <CardDescription>Creá un resumen automático o descargá la información que estás viendo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" onClick={requestAiSummary} disabled={isLoadingAi}>
                {isLoadingAi ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Brain className="h-4 w-4" aria-hidden="true" />}
                Crear resumen
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void requestExport('tickets', 'pdf')} disabled={exporting !== null || !canExport}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Descargar casos en PDF
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void requestExport('contacts', 'csv')} disabled={exporting !== null || !canExport}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Descargar contactos en CSV
              </Button>
            </div>
            {!canExport ? <p role="status" className="text-xs text-muted-foreground">
              Verificamos la organización seleccionada antes de habilitar la descarga de reportes.
            </p> : null}

            {exporting ? <p role="status" className="text-sm text-muted-foreground">Preparando el archivo…</p> : null}
            {aiError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{aiError}</p> : null}
            {aiSummary ? (
              <div className="space-y-3 rounded-lg border bg-background px-3 py-3">
                {aiSummary.headline ? <p className="font-semibold text-foreground">{clearPanelText(aiSummary.headline)}</p> : null}
                {aiSummary.confidence !== undefined || (Array.isArray(aiSummary.data_quality_notes) && aiSummary.data_quality_notes.length > 0) ? (
                  <details className="text-sm text-muted-foreground">
                    <summary className="min-h-11 cursor-pointer py-3 font-medium text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Datos para soporte
                    </summary>
                    <div className="space-y-1 pb-2">
                      {aiSummary.confidence !== undefined ? <p>Nivel informado por el análisis: {String(aiSummary.confidence)}</p> : null}
                      {Array.isArray(aiSummary.data_quality_notes) ? aiSummary.data_quality_notes.map((note, index) => (
                        <p key={`${String(note)}-${index}`}>{String(note)}</p>
                      )) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
