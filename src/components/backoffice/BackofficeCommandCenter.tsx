import React, { useMemo, useState } from 'react';
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

type Props = {
  tenantSlug?: string | null;
  scope?: BackofficeScope | null;
  className?: string;
};

type MetricCard = {
  id: string;
  label: string;
  value?: number | string | null;
  tone?: 'default' | 'warning' | 'success';
  icon: React.ComponentType<{ className?: string }>;
};

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
  const [aiSummary, setAiSummary] = useState<Awaited<ReturnType<typeof backofficeService.requestExecutiveSummary>> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const enabled = Boolean(tenantSlug);

  const inboxQuery = useQuery({
    queryKey: ['backoffice-inbox-summary', tenantSlug, scope],
    queryFn: () => backofficeService.getInboxSummary({ tenantSlug, scope }),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['backoffice-orders-summary', tenantSlug],
    queryFn: () => backofficeService.getOrdersSummary(tenantSlug),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const contactsQuery = useQuery({
    queryKey: ['backoffice-contacts-summary', tenantSlug],
    queryFn: () => backofficeService.getContactsSummary(tenantSlug),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const teamQuery = useQuery({
    queryKey: ['backoffice-team-summary', tenantSlug],
    queryFn: () => backofficeService.getTeamCoverageSummary(tenantSlug),
    enabled,
    retry: 0,
    staleTime: 30_000,
  });

  const metrics = useMemo<MetricCard[]>(() => {
    const inbox = inboxQuery.data?.summary;
    const orders = ordersQuery.data;
    const contacts = contactsQuery.data;
    const team = teamQuery.data;

    return [
      { id: 'open', label: 'Casos abiertos', value: inbox?.open, icon: Ticket, tone: inbox?.open ? 'warning' : 'default' },
      { id: 'sla', label: 'Riesgo SLA', value: inbox?.sla_risk, icon: AlertTriangle, tone: inbox?.sla_risk ? 'warning' : 'success' },
      { id: 'orders', label: 'Pedidos activos', value: orders?.active_orders, icon: CheckCircle2 },
      { id: 'contacts', label: 'Contactos', value: contacts?.total_contacts, icon: Users },
      { id: 'team', label: 'Equipo activo', value: team?.active_employees, icon: ShieldCheck },
      {
        id: 'unassigned',
        label: 'Sin responsable',
        value: (inbox?.unassigned ?? 0) + (orders?.unassigned_orders ?? 0),
        icon: Users,
        tone: (inbox?.unassigned ?? 0) + (orders?.unassigned_orders ?? 0) > 0 ? 'warning' : 'success',
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
    void inboxQuery.refetch();
    void ordersQuery.refetch();
    void contactsQuery.refetch();
    void teamQuery.refetch();
  };

  const requestAiSummary = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
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
      });
      setAiSummary(summary);
    } catch (error) {
      setAiError(getErrorMessage(error, 'No se pudo generar el resumen IA.'));
    } finally {
      setIsLoadingAi(false);
    }
  };

  const requestExport = async (resource: BackofficeExportResource, format: BackofficeExportFormat) => {
    const key = `${resource}-${format}`;
    setExporting(key);
    try {
      const result = await backofficeService.requestExport({
        tenant_slug: tenantSlug,
        resource,
        format,
        filters: { scope },
        include_ai_summary: format === 'pdf',
      });
      window.open(result.download_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setAiError(getErrorMessage(error, 'No se pudo preparar la exportacion.'));
    } finally {
      setExporting(null);
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
        <Button type="button" variant="outline" onClick={refresh} disabled={isLoading}>
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
