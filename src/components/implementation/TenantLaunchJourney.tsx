import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  Lock,
  RefreshCw,
  Rocket,
} from 'lucide-react';

import type {
  TenantImplementationJourneyContract,
  TenantImplementationJourneyStage,
} from '@/api/v2/channelActivation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const statusPresentation = {
  ready: {
    label: 'Lista',
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  },
  action_required: {
    label: 'Requiere acción',
    icon: AlertTriangle,
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200',
  },
  pending: {
    label: 'En preparación',
    icon: Clock3,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  },
  blocked: {
    label: 'Bloqueada',
    icon: Lock,
    className: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200',
  },
  not_published: {
    label: 'No publicada',
    icon: CircleDashed,
    className: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  },
} as const;

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const isSafeInternalPath = (value: string) => {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
};

export const buildTenantJourneyHref = (
  href: string,
  tenantSlug: string,
  returnTo?: string,
) => {
  const cleanHref = href.trim();
  const normalizedTenant = normalizeTenantSlug(tenantSlug);
  if (!normalizedTenant || !isSafeInternalPath(cleanHref)) return null;

  const safeReturnTo = returnTo?.trim() || `/implementacion?tenant_slug=${encodeURIComponent(normalizedTenant)}`;
  if (!isSafeInternalPath(safeReturnTo)) return null;

  try {
    const base = new URL('https://chatboc.local');
    const target = new URL(cleanHref, base);
    const returnTarget = new URL(safeReturnTo, base);
    if (target.origin !== base.origin || returnTarget.origin !== base.origin) return null;

    const tenantPathMatch = target.pathname.match(/^\/t\/([^/]+)(?:\/|$)/i);
    if (tenantPathMatch && decodeURIComponent(tenantPathMatch[1]).toLowerCase() !== normalizedTenant) {
      return null;
    }

    target.searchParams.set('tenant_slug', normalizedTenant);
    target.searchParams.set(
      'return_to',
      `${returnTarget.pathname}${returnTarget.search}${returnTarget.hash}`,
    );
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
};

interface TenantLaunchJourneyProps {
  tenantSlug: string;
  journey?: TenantImplementationJourneyContract | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  returnTo?: string;
  technicalDetails?: React.ReactNode;
}

const JourneyTechnicalDetails: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  if (!children) return null;
  return (
    <details
      data-testid="implementation-technical-details"
      className="group border-t border-border/70 bg-muted/[0.18]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
        Detalle técnico de canales
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/60 p-4 sm:p-5">{children}</div>
    </details>
  );
};

const StageDetail: React.FC<{
  stage: TenantImplementationJourneyStage;
  isCurrent: boolean;
  actionHref: string | null;
  actionLabel?: string;
  panelId: string;
}> = ({ stage, isCurrent, actionHref, actionLabel, panelId }) => (
  <div
    id={panelId}
    role="region"
    aria-label={`Detalle de ${stage.label}`}
    className="border-t border-border/60 px-4 pb-4 pt-3 sm:pl-[4.75rem] sm:pr-5"
  >
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{stage.description}</p>

    <details className="group mt-3 rounded-lg border border-border/60 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Evidencia y referencias técnicas
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-border/60 px-3 py-3 text-xs text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Fuentes del contrato</p>
          <p className="mt-1 break-words font-mono">{stage.source_ids.join(' · ')}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Evidencia publicada</p>
          <p className="mt-1">{stage.evidence.length ? stage.evidence.join(' · ') : 'Sin evidencia adicional publicada.'}</p>
        </div>
        {stage.reason_codes.length ? (
          <div>
            <p className="font-semibold text-foreground">Códigos de estado</p>
            <p className="mt-1 break-words font-mono">{stage.reason_codes.join(' · ')}</p>
          </div>
        ) : null}
      </div>
    </details>

    {isCurrent && actionHref ? (
      <Button asChild className="mt-4 w-full sm:w-auto">
        <a href={actionHref}>
          {actionLabel || 'Continuar implementación'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </a>
      </Button>
    ) : null}
    {isCurrent && stage.primary_action && !actionHref ? (
      <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
        La próxima acción no se publicó con un enlace interno seguro. Actualizá el estado antes de continuar.
      </p>
    ) : null}
  </div>
);

const TenantLaunchJourney: React.FC<TenantLaunchJourneyProps> = ({
  tenantSlug,
  journey,
  loading = false,
  error,
  onRefresh,
  returnTo,
  technicalDetails,
}) => {
  const currentStageId = journey?.summary.current_stage_id || null;
  const [expandedStageId, setExpandedStageId] = React.useState<string | null>(currentStageId);

  React.useEffect(() => {
    setExpandedStageId(currentStageId);
  }, [currentStageId, tenantSlug]);

  if (!journey) {
    return (
      <section
        data-testid="tenant-launch-journey"
        data-state={loading ? 'loading' : 'not-published'}
        className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300">
              {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CircleDashed className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <Badge variant="outline" className="bg-background/70">Ruta de salida</Badge>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                {loading ? 'Sincronizando implementación' : 'Ruta de salida no publicada'}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {loading
                  ? 'Estamos consultando el estado autorizado de esta organización.'
                  : 'La plataforma todavía no publicó una secuencia validada para este tenant. No se muestran avances inferidos desde canales aislados.'}
              </p>
              {error ? <p role="alert" className="mt-2 text-sm text-amber-700 dark:text-amber-200">{error}</p> : null}
            </div>
          </div>
          {onRefresh ? (
            <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>
          ) : null}
        </div>
        <JourneyTechnicalDetails>{technicalDetails}</JourneyTechnicalDetails>
      </section>
    );
  }

  const currentStage = currentStageId
    ? journey.stages.find((stage) => stage.id === currentStageId) || null
    : null;
  const nextAction = journey.summary.next_action;
  const safeActionHref = nextAction && currentStage
    ? buildTenantJourneyHref(nextAction.href, tenantSlug, returnTo)
    : null;

  return (
    <section
      data-testid="tenant-launch-journey"
      data-state={currentStage ? 'in-progress' : 'ready'}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    >
      <div className="grid gap-5 border-b border-border/70 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 p-5 text-white sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-blue-300/30 bg-blue-400/15 text-blue-50" variant="outline">
              Ruta de salida
            </Badge>
            {journey.summary.blocked ? (
              <Badge className="border-red-300/30 bg-red-400/15 text-red-50" variant="outline">
                {journey.summary.blocked} bloqueada{journey.summary.blocked === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">De la configuración a la operación</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Cinco etapas gobernadas por la plataforma. Abrimos sólo el próximo paso para que el equipo avance sin recorrer pantallas interminables.
          </p>
          {error ? <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p> : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.08] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-200">
              {currentStage ? 'Implementación en curso' : 'Ruta completada'}
            </span>
            <span className="text-2xl font-black text-white">{journey.summary.progress}%</span>
          </div>
          <Progress
            value={journey.summary.progress}
            className="mt-3 h-2 bg-slate-800"
            aria-label="Progreso de la ruta de salida"
          />
          <p className="mt-3 text-sm text-slate-300">
            {journey.summary.ready} de {journey.summary.total} etapas listas · {journey.summary.published} publicadas
          </p>
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Actualizar estado
            </Button>
          ) : null}
        </div>
      </div>

      <ol className="space-y-2 p-4 sm:p-5" aria-label="Etapas de implementación">
        {journey.stages.map((stage, index) => {
          const presentation = statusPresentation[stage.status];
          const StatusIcon = presentation.icon;
          const expanded = expandedStageId === stage.id;
          const isCurrent = currentStageId === stage.id;
          const panelId = `implementation-stage-${index + 1}`;

          return (
            <li
              key={stage.id}
              data-stage-id={stage.id}
              data-stage-status={stage.status}
              className={cn(
                'overflow-hidden rounded-xl border bg-background/70 transition-colors',
                expanded ? 'border-blue-500/35 shadow-sm' : 'border-border/70',
              )}
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                onClick={() => setExpandedStageId((current) => current === stage.id ? null : stage.id)}
              >
                <span className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
                  stage.ready
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                    : isCurrent
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-200'
                      : 'border-border bg-muted/50 text-muted-foreground',
                )}>
                  {stage.ready ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{stage.label}</span>
                    {isCurrent ? <span className="text-xs font-semibold text-blue-700 dark:text-blue-200">Próximo paso</span> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">{presentation.label}</span>
                </span>
                <span className={cn(
                  'hidden items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold sm:inline-flex',
                  presentation.className,
                )}>
                  <StatusIcon className="h-3 w-3" />
                  {presentation.label}
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded ? (
                <StageDetail
                  stage={stage}
                  isCurrent={isCurrent}
                  actionHref={isCurrent ? safeActionHref : null}
                  actionLabel={isCurrent ? nextAction?.label : undefined}
                  panelId={panelId}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border/60 bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-2">
          <Rocket className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
          Los estados y el próximo paso provienen del contrato publicado por la plataforma.
        </span>
      </div>
      <JourneyTechnicalDetails>{technicalDetails}</JourneyTechnicalDetails>
    </section>
  );
};

export default TenantLaunchJourney;
