import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  DatabaseZap,
  ExternalLink,
  Filter,
  LocateFixed,
  LockKeyhole,
  Map as MapIcon,
  MapPinOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/api';

import { getOperationsHeatmapV2 } from './analyticsApi';
import {
  adaptTerritorialPreviewQueue,
  adaptTerritorialAdminQueue,
  adaptPendingLocationQueue,
  normalizeTerritorialFilter,
  type PendingLocationAction,
  type PendingLocationCandidate,
} from './territorialPendingLocations';
import {
  applyTerritorialGeocodingJob,
  createTerritorialExecutionIdempotencyKey,
  createTerritorialReviewIdempotencyKey,
  createTerritorialSyncIdempotencyKey,
  getTerritorialGeocodingAttempts,
  getTerritorialGeocodingDetail,
  getTerritorialGeocodingPreviewQueue,
  getTerritorialGeocodingQueue,
  isTerritorialApiStatus,
  isTerritorialQueueEndpointUnavailable,
  reviewTerritorialGeocodingJob,
  resolveTerritorialGeocodingJob,
  syncTerritorialGeocodingQueue,
} from './territorialGeocodingApi';
import type {
  TerritorialGeocodingAttempt,
  TerritorialGeocodingDetail,
  TerritorialGeocodingItem,
  TerritorialGeocodingPreviewQueue,
  TerritorialGeocodingQueue,
  TerritorialGeocodingSyncResponse,
  TerritorialReviewDecision,
} from './territorialGeocodingTypes';

interface TerritorialPendingLocationsInboxProps {
  tenantSlug?: string | null;
  initialFacet?: string | null;
  initialZone?: string | null;
  embedded?: boolean;
}

type QueueQueryResult =
  | { source: 'admin'; queue: TerritorialGeocodingQueue }
  | { source: 'preview'; queue: TerritorialGeocodingPreviewQueue }
  | { source: 'heatmap_fallback'; queue: ReturnType<typeof adaptPendingLocationQueue> };

interface ReviewDraft {
  jobId: string;
  decision: TerritorialReviewDecision;
  reasonCode: string;
  idempotencyKey: string;
  expectedProposalDigest: string;
  expectedAttemptId: string;
  expectedAttemptNumber: number;
  confirmed: boolean;
}

interface ApplyDraft {
  jobId: string;
  idempotencyKey: string;
  expectedProposalDigest: string;
  expectedAttemptId: string;
  expectedAttemptNumber: number;
  confirmed: boolean;
}

const REVIEW_REASON_LABELS: Record<string, string> = {
  verified_against_source: 'Verificada contra la fuente del reclamo',
  verified_on_map: 'Verificada manualmente en el mapa',
  verified_with_field_team: 'Verificada con el equipo de territorio',
  ambiguous_candidate: 'La propuesta es ambigua',
  duplicate_job: 'La revisión está duplicada',
  incorrect_location: 'La ubicación propuesta es incorrecta',
  insufficient_precision: 'La precisión es insuficiente',
  outside_jurisdiction: 'La propuesta está fuera de jurisdicción',
  stale_source: 'La fuente quedó desactualizada',
};

const humanizeCode = (value: string | null | undefined) =>
  value ? REVIEW_REASON_LABELS[value] ?? value.replace(/[_-]+/g, ' ') : 'No publicado';

const formatCoordinate = (value: number | null) => value === null ? 'No disponible' : value.toFixed(5);

const formatAuditDate = (value: string | null) => {
  if (!value) return 'Sin fecha publicada';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Fecha no válida'
    : new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
};

const statusLabel = (status: string | null) => {
  const normalized = normalizeTerritorialFilter(status);
  if (normalized === 'ready') return 'Lista para revisar';
  if (normalized === 'pending' || normalized === 'queued') return 'Pendiente';
  if (normalized === 'degraded' || normalized === 'partial') return 'Cobertura parcial';
  return status ? status.replace(/[_-]+/g, ' ') : 'Estado no publicado';
};

const actionControl = (action: PendingLocationAction) => {
  const Icon = action.kind === 'approve' ? Check : action.kind === 'reject' ? X : ShieldCheck;
  const variant = action.kind === 'reject' ? 'outline' : action.kind === 'approve' ? 'default' : 'secondary';
  if (action.enabled && action.href) {
    return (
      <Button key={action.kind} asChild size="sm" variant={variant} className="justify-start gap-2">
        <a href={action.href} title={action.reason}>
          <Icon className="h-4 w-4" />
          {action.label}
        </a>
      </Button>
    );
  }
  return (
    <Button key={action.kind} type="button" size="sm" variant={variant} className="justify-start gap-2" disabled title={action.reason}>
      <Icon className="h-4 w-4" />
      {action.label}
    </Button>
  );
};

const PendingLocationDetail = ({ candidate }: { candidate: PendingLocationCandidate | null }) => {
  if (!candidate) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/15 p-6 text-center">
        <LocateFixed className="h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold">Seleccioná un caso pendiente</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          La revisión muestra sólo contexto territorial seguro. El domicilio completo permanece protegido en el ticket.
        </p>
      </div>
    );
  }

  return (
    <article aria-labelledby="pending-location-detail-title" className="min-w-0 rounded-xl border bg-background shadow-sm">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Revisión territorial</p>
          <h3 id="pending-location-detail-title" className="mt-1 truncate text-lg font-semibold">
            {candidate.ticketId ? `Reclamo #${candidate.ticketId}` : 'Registro sin ticket publicado'}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{candidate.category}</Badge>
            <Badge variant="outline">{candidate.source}</Badge>
          </div>
        </div>
        {candidate.ticketHref ? (
          <Button asChild size="sm" className="shrink-0 gap-2">
            <a href={candidate.ticketHref}>
              <Ticket className="h-4 w-4" />
              Abrir ticket
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled title="El contrato no publicó la identidad del ticket">
            Abrir ticket
          </Button>
        )}
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <section className="rounded-lg border bg-muted/15 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <MapPinOff className="h-4 w-4 text-amber-600" />
            Referencia agregada
          </div>
          <p className="mt-2 text-base font-semibold">{candidate.safeAreaLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Domicilio exacto oculto en esta vista para proteger a la persona denunciante.
          </p>
        </section>
        <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Razón de calidad
          </div>
          <p className="mt-2 text-sm font-semibold">{candidate.qualityLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{candidate.qualityDetail}</p>
        </section>
      </div>

      <section className="border-t p-4" aria-labelledby="pending-location-actions-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 id="pending-location-actions-title" className="text-sm font-semibold">Decisión guiada</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Las decisiones sólo se habilitan cuando el backend publica una ruta segura y auditable.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">Sin escritura implícita</Badge>
        </div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {(['review', 'approve', 'reject'] as const).map((kind, index) => {
            const action = candidate.actions[kind];
            return (
              <li key={kind} className="rounded-lg border bg-muted/10 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{action.label}</span>
                </div>
                <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{action.reason}</p>
                <div className="mt-2">{actionControl(action)}</div>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
};

const TerritorialAdminDetail = ({
  candidate,
  item,
  detail,
  attempts,
  loading,
  detailError,
  attemptsError,
  onReview,
  onResolve,
  onNewResolve,
  onApply,
  canStartNewResolve,
  resolving,
  applying,
  executionError,
}: {
  candidate: PendingLocationCandidate | null;
  item: TerritorialGeocodingItem | null;
  detail: TerritorialGeocodingDetail | undefined;
  attempts: TerritorialGeocodingAttempt[];
  loading: boolean;
  detailError: unknown;
  attemptsError: unknown;
  onReview: (decision: TerritorialReviewDecision) => void;
  onResolve: () => void;
  onNewResolve: () => void;
  onApply: () => void;
  canStartNewResolve: boolean;
  resolving: boolean;
  applying: boolean;
  executionError: unknown;
}) => {
  if (!candidate || !item) return <PendingLocationDetail candidate={null} />;
  const proposal = detail?.proposal;
  const reviewAction = item.reviewAction;
  const accessDenied = isTerritorialApiStatus(detailError, 403);
  const proposalVersionAvailable = Boolean(detail?.proposalDigest && detail.proposalVersion);

  return (
    <article aria-labelledby="territorial-admin-detail-title" className="min-w-0 rounded-xl border bg-background shadow-sm">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Expediente territorial autorizado</p>
          <h3 id="territorial-admin-detail-title" className="mt-1 truncate text-lg font-semibold">
            {candidate.ticketId ? `Reclamo #${candidate.ticketId}` : `Trabajo territorial ${item.id}`}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{candidate.category}</Badge>
            <Badge variant="outline">{humanizeCode(item.reviewState)}</Badge>
            <Badge variant="outline">{humanizeCode(item.quality.state)}</Badge>
          </div>
        </div>
        {candidate.ticketHref ? (
          <Button asChild size="sm" className="shrink-0 gap-2">
            <a href={candidate.ticketHref}>
              <Ticket className="h-4 w-4" /> Abrir ticket <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled title="La identidad de ticket no es compatible con el CRM">
            Abrir ticket
          </Button>
        )}
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <section className="rounded-lg border bg-muted/15 p-3 sm:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <MapPinOff className="h-4 w-4 text-amber-600" /> Área agregada
          </div>
          <p className="mt-2 text-base font-semibold">{candidate.safeAreaLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            El contrato no entrega domicilio crudo, digest del domicilio ni evidencia libre del proveedor.
          </p>
        </section>
        <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">Calidad</p>
          <p className="mt-2 text-sm font-semibold">{candidate.qualityLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{humanizeCode(item.reasonCode)}</p>
        </section>
      </div>

      {loading ? (
        <div role="status" className="mx-4 mb-4 rounded-lg border p-4 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" /> Recuperando propuesta y auditoría…
        </div>
      ) : detailError ? (
        <div role="alert" className="mx-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-semibold">{accessDenied ? 'Acceso administrativo requerido' : 'No pudimos abrir el detalle territorial'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {accessDenied ? 'La cola falla cerrada: sólo administradores y superadministradores pueden revisar evidencia.' : getErrorMessage(detailError)}
          </p>
        </div>
      ) : detail ? (
        <>
          <section className="grid gap-3 border-t p-4 lg:grid-cols-2" aria-label="Propuesta territorial autorizada">
            <div className="rounded-lg border bg-primary/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Propuesta geográfica</h4>
                <Badge variant="outline"><LockKeyhole className="mr-1 h-3.5 w-3.5" /> Vista admin</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border bg-background p-2"><dt className="text-xs text-muted-foreground">Latitud</dt><dd className="mt-1 font-mono font-semibold">{formatCoordinate(proposal?.lat ?? null)}</dd></div>
                <div className="rounded-md border bg-background p-2"><dt className="text-xs text-muted-foreground">Longitud</dt><dd className="mt-1 font-mono font-semibold">{formatCoordinate(proposal?.lng ?? null)}</dd></div>
                <div className="rounded-md border bg-background p-2"><dt className="text-xs text-muted-foreground">Precisión</dt><dd className="mt-1 font-semibold">{proposal?.locationType ?? item.quality.locationType ?? 'No publicada'} · {proposal?.coordinateReference ?? 'referencia no publicada'}</dd></div>
                <div className="rounded-md border bg-background p-2"><dt className="text-xs text-muted-foreground">Jurisdicción</dt><dd className="mt-1 font-semibold">{proposal?.validation.jurisdictionStatus ?? item.quality.jurisdictionStatus ?? 'No publicada'}</dd></div>
              </dl>
              {(proposal?.validation.issues.length ?? 0) > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-amber-800 dark:text-amber-200">
                  {proposal?.validation.issues.map((issue) => <li key={issue}>• {humanizeCode(issue)}</li>)}
                </ul>
              ) : null}
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Decisión humana</h4>
                <Badge variant="outline">No aplica coordenadas</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Aprobar o rechazar agrega un recibo inmutable. No llama al proveedor y no modifica el ticket.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={!reviewAction.canApprove || !proposalVersionAvailable}
                  title={!reviewAction.canApprove ? 'Se requiere una propuesta y autoridad publicada por el contrato' : undefined}
                  onClick={() => onReview('approved')}
                >
                  <Check className="h-4 w-4" /> Aprobar propuesta
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={!reviewAction.canReject || !proposalVersionAvailable}
                  title={!reviewAction.canReject ? 'El contrato no habilita el rechazo de este trabajo' : undefined}
                  onClick={() => onReview('rejected')}
                >
                  <X className="h-4 w-4" /> Rechazar propuesta
                </Button>
              </div>
              <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={!item.resolveAction.enabled || !item.resolveAction.href || resolving || applying}
                  title={humanizeCode(item.resolveAction.reasonCode)}
                  onClick={onResolve}
                >
                  {resolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  Consultar proveedor
                </Button>
                {canStartNewResolve ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={!item.resolveAction.enabled || !item.resolveAction.href || resolving || applying}
                    title="Inicia otra consulta y genera una nueva clave idempotente"
                    onClick={onNewResolve}
                  >
                    <RefreshCw className="h-4 w-4" /> Nueva búsqueda
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={!item.applyAction.enabled || !item.applyAction.href || !proposalVersionAvailable || resolving || applying}
                  title={humanizeCode(item.applyAction.reasonCode)}
                  onClick={onApply}
                >
                  {applying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aplicar coordenadas
                </Button>
              </div>
              {executionError ? (
                <div role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                  <p className="font-semibold">La operación territorial quedó bloqueada</p>
                  <p className="mt-1 text-muted-foreground">{getErrorMessage(executionError)}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 border-t p-4 lg:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Intentos auditables</h4>
                <Badge variant="secondary">{attempts.length}</Badge>
              </div>
              {attemptsError ? (
                <p role="alert" className="mt-3 text-xs text-destructive">No se pudieron recuperar los intentos autorizados.</p>
              ) : attempts.length ? (
                <ol className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {attempts.slice(0, 8).map((attempt) => (
                    <li key={attempt.id} className="rounded-md border bg-muted/10 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">Intento {attempt.attemptNumber}</span><span>{formatAuditDate(attempt.createdAt)}</span></div>
                      <p className="mt-1 text-muted-foreground">{humanizeCode(attempt.outcomeStatus)} · {humanizeCode(attempt.reasonCode)}</p>
                      <p className="mt-1">Proveedor: {attempt.externalCallPerformed ? 'consultado' : 'sin llamada'} · Escritura: {attempt.coordinateWritePerformed ? 'registrada por otro flujo' : 'no realizada'}</p>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-xs text-muted-foreground">Sin intentos publicados.</p>}
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Revisiones humanas</h4>
                <Badge variant="secondary">{detail.reviews.length}</Badge>
              </div>
              {detail.reviews.length ? (
                <ol className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {detail.reviews.slice(0, 8).map((review) => (
                    <li key={review.id} className="rounded-md border bg-muted/10 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{humanizeCode(review.decision)}</span><span>{formatAuditDate(review.createdAt)}</span></div>
                      <p className="mt-1 text-muted-foreground">{humanizeCode(review.reasonCode)} · {humanizeCode(review.effectiveState)}</p>
                      {!review.proposalCurrent ? <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">La propuesta cambió: requiere nueva revisión.</p> : null}
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-xs text-muted-foreground">Todavía no hay decisiones humanas.</p>}
            </div>
          </section>
        </>
      ) : null}
    </article>
  );
};

const TerritorialReviewDialog = ({
  draft,
  item,
  submitting,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ReviewDraft | null;
  item: TerritorialGeocodingItem | null;
  submitting: boolean;
  error: unknown;
  onChange: (draft: ReviewDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const reasons = !draft || !item
    ? []
    : draft.decision === 'approved'
      ? item.reviewAction.approvedReasonCodes
      : item.reviewAction.rejectedReasonCodes;
  const conflict = isTerritorialApiStatus(error, 409);

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft?.decision === 'approved' ? 'Confirmar aprobación territorial' : 'Confirmar rechazo territorial'}</DialogTitle>
          <DialogDescription>
            Esta operación registra una decisión humana auditable. Nunca aplica coordenadas ni llama al proveedor.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Motivo obligatorio
              <select
                aria-label="Motivo de la revisión territorial"
                value={draft.reasonCode}
                onChange={(event) => onChange({ ...draft, reasonCode: event.target.value, confirmed: false })}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
              >
                <option value="">Seleccionar un motivo…</option>
                {reasons.map((reason) => <option key={reason} value={reason}>{humanizeCode(reason)}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-3 rounded-lg border bg-muted/15 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={draft.confirmed}
                onChange={(event) => onChange({ ...draft, confirmed: event.target.checked })}
              />
              <span>Confirmo que revisé la propuesta y comprendo que esta decisión no modifica coordenadas.</span>
            </label>
            {error ? (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-semibold">{conflict ? 'Conflicto de revisión' : 'No se pudo registrar la revisión'}</p>
                <p className="mt-1 text-muted-foreground">
                  {conflict ? 'La propuesta cambió o la clave idempotente ya fue usada con otra decisión. Actualizá la cola antes de volver a revisar.' : getErrorMessage(error)}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="button" onClick={onSubmit} disabled={!draft?.reasonCode || !draft.confirmed || submitting}>
            {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar decisión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TerritorialSyncDialog = ({
  open,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: () => void;
}) => (
  <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !submitting) onClose(); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Actualizar cola territorial</DialogTitle>
        <DialogDescription>
          Se materializarán referencias actuales sin coordenadas. No se consulta un proveedor, no se geocodifica y no se modifica ningún reclamo.
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-lg border bg-muted/15 p-3 text-sm">
        <p className="font-semibold">Ejecución explícita y auditable</p>
        <p className="mt-1 text-muted-foreground">Al terminar se recarga la bandeja redactada con creadas, existentes, desactualizadas y ocultas.</p>
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-semibold">
            {isTerritorialApiStatus(error, 403) ? 'Acceso administrativo requerido' : isTerritorialApiStatus(error, 409) ? 'Actualización en conflicto' : 'No se pudo actualizar la cola'}
          </p>
          <p className="mt-1 text-muted-foreground">{getErrorMessage(error)}</p>
        </div>
      ) : null}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
          Confirmar actualización
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const TerritorialApplyDialog = ({ draft, submitting, error, onChange, onClose, onSubmit }: {
  draft: ApplyDraft | null;
  submitting: boolean;
  error: unknown;
  onChange: (draft: ApplyDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => (
  <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Aplicar coordenadas verificadas</DialogTitle>
        <DialogDescription>
          Esta acción modifica el reclamo. El backend volverá a comprobar propuesta, aprobación humana, polígono oficial y autoridad de escritura.
        </DialogDescription>
      </DialogHeader>
      {draft ? (
        <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={draft.confirmed} onChange={(event) => onChange({ ...draft, confirmed: event.target.checked })} />
          <span>Confirmo que quiero escribir la propuesta aprobada vigente en el reclamo.</span>
        </label>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-semibold">No se aplicaron coordenadas</p>
          <p className="mt-1 text-muted-foreground">{getErrorMessage(error)}</p>
        </div>
      ) : null}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button type="button" onClick={onSubmit} disabled={!draft?.confirmed || submitting}>
          {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar aplicación
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export function TerritorialPendingLocationsInbox({
  tenantSlug,
  initialFacet,
  initialZone,
  embedded = false,
}: TerritorialPendingLocationsInboxProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(() => normalizeTerritorialFilter(initialFacet));
  const [zoneFilter, setZoneFilter] = useState(() => normalizeTerritorialFilter(initialZone));
  const [qualityFilter, setQualityFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [syncIdempotencyKey, setSyncIdempotencyKey] = useState<string | null>(null);
  const [applyDraft, setApplyDraft] = useState<ApplyDraft | null>(null);
  const [resolveIdempotencyKeys, setResolveIdempotencyKeys] = useState<Record<string, string>>({});
  const [lastSyncResult, setLastSyncResult] = useState<TerritorialGeocodingSyncResponse | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => setCategoryFilter(normalizeTerritorialFilter(initialFacet)), [initialFacet]);
  useEffect(() => setZoneFilter(normalizeTerritorialFilter(initialZone)), [initialZone]);

  const query = useQuery({
    queryKey: ['territorial-pending-locations', tenantSlug],
    queryFn: async (): Promise<QueueQueryResult> => {
      let emptyAdminQueue: TerritorialGeocodingQueue | null = null;
      try {
        const adminQueue = await getTerritorialGeocodingQueue({ tenantSlug: tenantSlug!, page: 1, perPage: 100 });
        if (adminQueue.summary.total > 0) return { source: 'admin', queue: adminQueue };
        emptyAdminQueue = adminQueue;
      } catch (error) {
        if (!isTerritorialQueueEndpointUnavailable(error)) throw error;
      }
      try {
        const previewQueue = await getTerritorialGeocodingPreviewQueue({ tenantSlug: tenantSlug!, page: 1, perPage: 100 });
        if (previewQueue.summary.matching > 0 || previewQueue.summary.hidden > 0 || !emptyAdminQueue) {
          return { source: 'preview', queue: previewQueue };
        }
      } catch (error) {
        if (!isTerritorialQueueEndpointUnavailable(error)) throw error;
      }
      if (emptyAdminQueue) return { source: 'admin', queue: emptyAdminQueue };
      const heatmap = await getOperationsHeatmapV2({ tenantSlug, scope: 'municipio', range: '30d', include_ai: 0, limit: 100 });
      return { source: 'heatmap_fallback', queue: adaptPendingLocationQueue(heatmap, tenantSlug) };
    },
    enabled: Boolean(tenantSlug),
    retry: 0,
    staleTime: 30_000,
  });
  const adminQueue = query.data?.source === 'admin' ? query.data.queue : null;
  const queue = useMemo(() => {
    if (query.data?.source === 'admin') return adaptTerritorialAdminQueue(query.data.queue, tenantSlug);
    if (query.data?.source === 'preview') return adaptTerritorialPreviewQueue(query.data.queue, tenantSlug);
    if (query.data?.source === 'heatmap_fallback') return query.data.queue;
    return adaptPendingLocationQueue(undefined, tenantSlug);
  }, [query.data, tenantSlug]);
  const normalizedSearch = normalizeTerritorialFilter(search);

  const categories = useMemo(() => {
    const values = new Map<string, string>();
    queue.candidates.forEach((candidate) => values.set(normalizeTerritorialFilter(candidate.category), candidate.category));
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));
  }, [queue.candidates]);
  const areas = useMemo(() => {
    const values = new Map<string, string>();
    queue.candidates.forEach((candidate) => values.set(normalizeTerritorialFilter(candidate.safeAreaLabel), candidate.safeAreaLabel));
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));
  }, [queue.candidates]);
  const qualityReasons = useMemo(() => {
    const values = new Map<string, string>();
    queue.candidates.forEach((candidate) => values.set(candidate.qualityCode, candidate.qualityLabel));
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));
  }, [queue.candidates]);

  const visibleCandidates = useMemo(
    () => queue.candidates.filter((candidate) => {
      const matchesCategory = !categoryFilter || normalizeTerritorialFilter(candidate.category) === categoryFilter;
      const matchesQuality = !qualityFilter || candidate.qualityCode === qualityFilter;
      const matchesZone = !zoneFilter || normalizeTerritorialFilter(candidate.safeAreaLabel).includes(zoneFilter);
      const haystack = normalizeTerritorialFilter([
        candidate.ticketId,
        candidate.category,
        candidate.safeAreaLabel,
        candidate.qualityLabel,
      ].filter(Boolean).join(' '));
      return matchesCategory && matchesQuality && matchesZone && (!normalizedSearch || haystack.includes(normalizedSearch));
    }),
    [categoryFilter, normalizedSearch, qualityFilter, queue.candidates, zoneFilter],
  );
  const selectedCandidate = visibleCandidates.find((candidate) => candidate.id === selectedId) ?? visibleCandidates[0] ?? null;
  const selectedAdminItem = adminQueue?.items.find((item) => item.id === selectedCandidate?.id) ?? null;

  const detailQuery = useQuery({
    queryKey: ['territorial-geocoding-detail', tenantSlug, selectedAdminItem?.id],
    queryFn: () => getTerritorialGeocodingDetail(selectedAdminItem!.id, tenantSlug!),
    enabled: Boolean(tenantSlug && selectedAdminItem?.detailHref),
    retry: 0,
    staleTime: 15_000,
  });
  const attemptsQuery = useQuery({
    queryKey: ['territorial-geocoding-attempts', tenantSlug, selectedAdminItem?.id],
    queryFn: () => getTerritorialGeocodingAttempts(selectedAdminItem!.id, tenantSlug!),
    enabled: Boolean(tenantSlug && selectedAdminItem?.attemptsHref),
    retry: 0,
    staleTime: 15_000,
  });
  const reviewMutation = useMutation({
    mutationFn: reviewTerritorialGeocodingJob,
    onSuccess: async (_response, variables) => {
      setReviewDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['territorial-pending-locations', tenantSlug] }),
        queryClient.invalidateQueries({ queryKey: ['territorial-geocoding-detail', tenantSlug, variables.jobId] }),
        queryClient.invalidateQueries({ queryKey: ['territorial-geocoding-attempts', tenantSlug, variables.jobId] }),
      ]);
    },
  });
  const syncMutation = useMutation({
    mutationFn: syncTerritorialGeocodingQueue,
    onSuccess: async (response) => {
      setLastSyncResult(response);
      setSyncIdempotencyKey(null);
      await queryClient.invalidateQueries({ queryKey: ['territorial-pending-locations', tenantSlug] });
    },
  });
  const invalidateTerritorialState = async (jobId: string, includeHeatmap: boolean) => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['territorial-pending-locations', tenantSlug] }),
      queryClient.invalidateQueries({ queryKey: ['territorial-geocoding-detail', tenantSlug, jobId] }),
      queryClient.invalidateQueries({ queryKey: ['territorial-geocoding-attempts', tenantSlug, jobId] }),
    ];
    if (includeHeatmap) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ['v2-operations-heatmap', tenantSlug] }),
        queryClient.invalidateQueries({ queryKey: ['v2-operations-dashboard', tenantSlug] }),
        queryClient.invalidateQueries({ queryKey: ['v2-operations-action-center', tenantSlug] }),
      );
    }
    await Promise.all(invalidations);
  };
  const resolveMutation = useMutation({
    mutationFn: resolveTerritorialGeocodingJob,
    onSuccess: async (_response, variables) => invalidateTerritorialState(variables.jobId, false),
  });
  const applyMutation = useMutation({
    mutationFn: applyTerritorialGeocodingJob,
    onSuccess: async (_response, variables) => {
      setApplyDraft(null);
      await invalidateTerritorialState(variables.jobId, true);
    },
  });

  const openReview = (decision: TerritorialReviewDecision) => {
    const proposalVersion = detailQuery.data?.proposalVersion;
    if (!selectedAdminItem || !proposalVersion) return;
    const permitted = decision === 'approved'
      ? selectedAdminItem.reviewAction.canApprove
      : selectedAdminItem.reviewAction.canReject;
    if (!permitted) return;
    setReviewDraft({
      jobId: selectedAdminItem.id,
      decision,
      reasonCode: '',
      idempotencyKey: createTerritorialReviewIdempotencyKey(selectedAdminItem.id),
      expectedProposalDigest: detailQuery.data!.proposalDigest,
      expectedAttemptId: proposalVersion.attemptId,
      expectedAttemptNumber: proposalVersion.attemptNumber,
      confirmed: false,
    });
    reviewMutation.reset();
  };

  const submitReview = () => {
    if (!reviewDraft || !tenantSlug || !reviewDraft.reasonCode || !reviewDraft.confirmed) return;
    reviewMutation.mutate({
      tenantSlug,
      jobId: reviewDraft.jobId,
      decision: reviewDraft.decision,
      reasonCode: reviewDraft.reasonCode,
      idempotencyKey: reviewDraft.idempotencyKey,
      expectedProposalDigest: reviewDraft.expectedProposalDigest,
      expectedAttemptId: reviewDraft.expectedAttemptId,
      expectedAttemptNumber: reviewDraft.expectedAttemptNumber,
    });
  };

  const openSync = () => {
    if (query.data?.source !== 'admin' || !tenantSlug) return;
    setSyncIdempotencyKey(createTerritorialSyncIdempotencyKey());
    syncMutation.reset();
  };

  const submitSync = () => {
    if (!tenantSlug || !syncIdempotencyKey) return;
    syncMutation.mutate({ tenantSlug, idempotencyKey: syncIdempotencyKey });
  };

  const resolveSelected = (newSearch = false) => {
    if (!tenantSlug || !selectedAdminItem?.resolveAction.enabled || !selectedAdminItem.resolveAction.href) return;
    const operationId = `${normalizeTerritorialFilter(tenantSlug)}:${selectedAdminItem.id}`;
    const existingKey = resolveIdempotencyKeys[operationId];
    const idempotencyKey = newSearch || !existingKey
      ? createTerritorialExecutionIdempotencyKey('resolve', selectedAdminItem.id)
      : existingKey;
    if (idempotencyKey !== existingKey) {
      setResolveIdempotencyKeys((current) => ({ ...current, [operationId]: idempotencyKey }));
    }
    resolveMutation.reset();
    resolveMutation.mutate({
      tenantSlug,
      jobId: selectedAdminItem.id,
      idempotencyKey,
    });
  };

  const openApply = () => {
    const proposalVersion = detailQuery.data?.proposalVersion;
    if (!selectedAdminItem?.applyAction.enabled || !selectedAdminItem.applyAction.href || !proposalVersion) return;
    applyMutation.reset();
    setApplyDraft({
      jobId: selectedAdminItem.id,
      idempotencyKey: createTerritorialExecutionIdempotencyKey('apply', selectedAdminItem.id),
      expectedProposalDigest: detailQuery.data!.proposalDigest,
      expectedAttemptId: proposalVersion.attemptId,
      expectedAttemptNumber: proposalVersion.attemptNumber,
      confirmed: false,
    });
  };

  const submitApply = () => {
    if (!tenantSlug || !applyDraft?.confirmed) return;
    applyMutation.mutate({
      tenantSlug,
      jobId: applyDraft.jobId,
      idempotencyKey: applyDraft.idempotencyKey,
      expectedProposalDigest: applyDraft.expectedProposalDigest,
      expectedAttemptId: applyDraft.expectedAttemptId,
      expectedAttemptNumber: applyDraft.expectedAttemptNumber,
    });
  };

  const normalInboxHref = tenantSlug
    ? `/perfil?tab=tickets&tenant_slug=${encodeURIComponent(tenantSlug)}&tenant=${encodeURIComponent(tenantSlug)}`
    : '/perfil?tab=tickets';
  const mapHref = tenantSlug
    ? `/perfil?tab=mapas&tenant_slug=${encodeURIComponent(tenantSlug)}&tenant=${encodeURIComponent(tenantSlug)}`
    : '/perfil?tab=mapas';

  return (
    <section
      data-testid="territorial-pending-locations-inbox"
      className={cn(
        'flex min-h-[560px] w-full flex-col overflow-hidden border border-border/70 bg-card/95',
        embedded ? 'rounded-none border-x-0 border-b-0' : 'rounded-xl shadow-xl',
      )}
      aria-labelledby="territorial-pending-locations-title"
    >
      <header className="flex flex-col gap-3 border-b bg-[linear-gradient(110deg,hsl(var(--background)),hsl(var(--primary)/0.07))] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <DatabaseZap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">CRM territorial</p>
            <h2 id="territorial-pending-locations-title" className="truncate text-xl font-semibold">Ubicaciones pendientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Revisá calidad territorial sin exponer domicilios en la bandeja agregada.</p>
          </div>
        </div>
        <nav aria-label="Navegación de ubicaciones pendientes" className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={normalInboxHref}><ArrowLeft className="h-4 w-4" /> Reclamos</a>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={mapHref}><MapIcon className="h-4 w-4" /> Volver al mapa</a>
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} /> Recargar
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={openSync}
            disabled={query.data?.source !== 'admin' || query.isFetching || syncMutation.isPending}
            title={query.data?.source !== 'admin' ? 'Disponible sólo con el contrato administrativo activo' : 'Materializa referencias pendientes sin geocodificar'}
          >
            <DatabaseZap className="h-4 w-4" /> Actualizar cola
          </Button>
        </nav>
      </header>

      {query.isLoading ? (
        <div role="status" className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
          <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 font-semibold">Recuperando contrato territorial</p>
          <p className="mt-1 text-sm text-muted-foreground">La bandeja no crea filas hasta recibir candidatos verificables.</p>
        </div>
      ) : query.isError ? (
        <div role="alert" className="m-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h3 className="mt-3 text-base font-semibold">
            {isTerritorialApiStatus(query.error, 403) ? 'Acceso administrativo requerido' : 'No pudimos cargar ubicaciones pendientes'}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {isTerritorialApiStatus(query.error, 403)
              ? 'Esta bandeja contiene evidencia territorial autorizada y falla cerrada para perfiles sin rol admin o superadmin.'
              : getErrorMessage(query.error)}
          </p>
          <Button type="button" size="sm" className="mt-4 gap-2" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      ) : queue.state === 'unavailable' || queue.state === 'summary_only' ? (
        <div role="status" className="m-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <MapPinOff className="h-8 w-8 text-amber-700 dark:text-amber-300" />
          <h3 className="mt-3 text-base font-semibold">
            {queue.state === 'summary_only' ? 'Hay pendientes, pero falta el detalle seguro' : 'El backend no publicó esta bandeja'}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {queue.state === 'summary_only'
              ? `El contrato informa ${queue.total} ubicaciones pendientes, pero no entregó candidatos identificables. No se inventan filas ni domicilios.`
              : 'La vista territorial sigue disponible, pero todavía no existe un contrato de candidatos para operar desde CRM.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" variant="outline"><a href={mapHref}>Volver al mapa</a></Button>
            <Button type="button" size="sm" onClick={() => void query.refetch()}>Reintentar contrato</Button>
          </div>
        </div>
      ) : queue.state === 'empty' ? (
        <div role="status" className="m-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
          <Check className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 text-base font-semibold">No hay ubicaciones pendientes</h3>
          <p className="mt-1 text-sm text-muted-foreground">El contrato territorial no informó casos para revisar con los filtros actuales.</p>
          <Button asChild size="sm" variant="outline" className="mt-4"><a href={mapHref}>Ver cobertura territorial</a></Button>
        </div>
      ) : (
        <>
          {query.data?.source === 'preview' ? (
            <div role="status" className="flex flex-col gap-1 border-b border-primary/20 bg-primary/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Pendientes detectadas sin alterar datos</p>
                <p className="text-xs text-muted-foreground">La cola descubre los reclamos vigentes en modo lectura. Abrí el caso para completar su ubicación; no se consultó ningún proveedor ni se escribieron coordenadas.</p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/30">Vista previa segura</Badge>
            </div>
          ) : query.data?.source === 'heatmap_fallback' ? (
            <div role="status" className="flex flex-col gap-1 border-b border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Modo lectura de respaldo</p>
                <p className="text-xs text-muted-foreground">La API administrativa no está disponible. Se muestran sólo señales compatibles del mapa; no se habilitan revisiones ni escrituras.</p>
              </div>
              <Badge variant="outline" className="w-fit border-amber-500/40">Sólo lectura</Badge>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/15 px-4 py-2 text-xs" role="status" aria-live="polite">
            <Badge variant="secondary">{queue.total} informadas</Badge>
            <Badge variant="outline">{queue.published} con detalle seguro</Badge>
            {queue.paginated ? <Badge variant="outline">{queue.paginated} fuera de esta página</Badge> : null}
            {queue.hidden ? <Badge variant="outline">{queue.hidden} sin detalle publicado</Badge> : null}
            <span className="text-muted-foreground">{statusLabel(queue.status)}</span>
            <span className="ml-auto text-muted-foreground">Revisión humana: {queue.writesEnabled ? 'habilitada' : 'no publicada'}</span>
          </div>
          {lastSyncResult ? (
            <div role="status" className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/[0.04] px-4 py-3 text-xs" aria-live="polite">
              <span className="font-semibold">Cola actualizada</span>
              <Badge variant="secondary">{lastSyncResult.summary.created} creadas</Badge>
              <Badge variant="outline">{lastSyncResult.summary.existing} existentes</Badge>
              <Badge variant="outline">{lastSyncResult.summary.refreshed} refrescadas</Badge>
              <Badge variant="outline">{lastSyncResult.summary.stale} desactualizadas</Badge>
              {lastSyncResult.summary.hidden ? <Badge variant="outline">{lastSyncResult.summary.hidden} ocultas</Badge> : null}
              {lastSyncResult.idempotentReplay ? <Badge variant="outline">Repetición idempotente</Badge> : null}
              <span className="ml-auto text-muted-foreground">Sin proveedor · sin escritura de coordenadas</span>
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
            <aside className="min-h-0 border-b bg-muted/10 lg:border-b-0 lg:border-r" aria-label="Cola de ubicaciones pendientes">
              <div className="border-b p-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-primary" /> Filtros de revisión</div>
                <label className="relative mt-3 block">
                  <span className="sr-only">Buscar caso pendiente</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar ticket, categoría o corredor"
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <label className="text-xs font-medium">
                    Categoría
                    <select
                      aria-label="Filtrar pendientes por categoría"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Área agregada
                    <select
                      aria-label="Filtrar pendientes por área agregada"
                      value={zoneFilter}
                      onChange={(event) => setZoneFilter(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {zoneFilter && !areas.some(([value]) => value === zoneFilter) ? (
                        <option value={zoneFilter}>{initialZone?.trim() || zoneFilter}</option>
                      ) : null}
                      {areas.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Calidad
                    <select
                      aria-label="Filtrar pendientes por calidad"
                      value={qualityFilter}
                      onChange={(event) => setQualityFilter(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {qualityReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto p-2" role="list" aria-label={`${visibleCandidates.length} ubicaciones visibles`}>
                {visibleCandidates.length ? visibleCandidates.map((candidate) => {
                  const active = selectedCandidate?.id === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="listitem"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedId(candidate.id)}
                      className={cn(
                        'mb-2 w-full rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        active ? 'border-primary bg-primary/5 shadow-sm' : 'bg-background hover:border-primary/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{candidate.ticketId ? `Reclamo #${candidate.ticketId}` : 'Registro territorial'}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{candidate.safeAreaLabel}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="max-w-full truncate">{candidate.category}</Badge>
                        <Badge variant="outline" className="max-w-full truncate">{candidate.qualityLabel}</Badge>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed p-5 text-center">
                    <p className="text-sm font-semibold">Sin coincidencias</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ajustá búsqueda, categoría o calidad.</p>
                    <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { setSearch(''); setCategoryFilter(''); setZoneFilter(''); setQualityFilter(''); }}>
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </div>
            </aside>

            <main className="min-w-0 overflow-y-auto p-3 sm:p-4">
              {selectedAdminItem ? (
                <TerritorialAdminDetail
                  candidate={selectedCandidate}
                  item={selectedAdminItem}
                  detail={detailQuery.data}
                  attempts={attemptsQuery.data?.attempts ?? detailQuery.data?.attempts ?? []}
                  loading={detailQuery.isLoading || attemptsQuery.isLoading}
                  detailError={detailQuery.error}
                  attemptsError={attemptsQuery.error}
                  onReview={openReview}
                  onResolve={() => resolveSelected(false)}
                  onNewResolve={() => resolveSelected(true)}
                  onApply={openApply}
                  canStartNewResolve={Boolean(
                    tenantSlug
                    && selectedAdminItem
                    && resolveIdempotencyKeys[`${normalizeTerritorialFilter(tenantSlug)}:${selectedAdminItem.id}`]
                  )}
                  resolving={resolveMutation.isPending}
                  applying={applyMutation.isPending}
                  executionError={resolveMutation.variables?.jobId === selectedAdminItem.id ? resolveMutation.error : null}
                />
              ) : (
                <PendingLocationDetail candidate={selectedCandidate} />
              )}
            </main>
          </div>
        </>
      )}
      <TerritorialReviewDialog
        draft={reviewDraft}
        item={selectedAdminItem}
        submitting={reviewMutation.isPending}
        error={reviewMutation.error}
        onChange={setReviewDraft}
        onClose={() => { setReviewDraft(null); reviewMutation.reset(); }}
        onSubmit={submitReview}
      />
      <TerritorialSyncDialog
        open={Boolean(syncIdempotencyKey)}
        submitting={syncMutation.isPending}
        error={syncMutation.error}
        onClose={() => { setSyncIdempotencyKey(null); syncMutation.reset(); }}
        onSubmit={submitSync}
      />
      <TerritorialApplyDialog
        draft={applyDraft}
        submitting={applyMutation.isPending}
        error={applyMutation.error}
        onChange={setApplyDraft}
        onClose={() => { setApplyDraft(null); applyMutation.reset(); }}
        onSubmit={submitApply}
      />
    </section>
  );
}

export default TerritorialPendingLocationsInbox;
