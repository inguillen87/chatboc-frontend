import { surveyCardMetrics, surveyCountLabel, surveyDateLabel } from '@/utils/surveyCardPresentation';
import './surveyCard.css';
import { useRef, useState } from 'react';
import { BarChart3, CalendarDays, Edit, LinkIcon, Send, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SeedButton } from '@/components/surveys/SeedButton';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { SurveyAdmin } from '@/types/encuestas';
import { getPublicSurveyUrlFromRecord } from '@/utils/publicSurveyUrl';
import { isGovernedSurvey, surveyCanShare, surveyIsReceiving } from '@/utils/surveyPublicationLifecycle';
import { SurveyParticipationAssurance } from '@/components/surveys/SurveyParticipationAssurance';
import { SurveyJurisdictionNextAction } from '@/components/surveys/SurveyJurisdictionNextAction';

interface SurveyCardProps {
  survey: SurveyAdmin;
  tenantSlug?: string | null;
  onEdit: () => void;
  onAnalytics: () => void;
  onPublish?: () => void;
  onManageGovernance?: () => void;
  publishing?: boolean;
  onClose?: () => Promise<void> | void;
  closing?: boolean;
  onCopyLink?: () => void;
  onDelete?: () => Promise<void> | void;
  deleting?: boolean;
  onSeed?: () => Promise<void>;
  seeding?: boolean;
  publicationNotice?: string | null;
}

const formatDate = surveyDateLabel;

const statusLabels: Record<SurveyAdmin['estado'], string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  cerrada: 'Cerrada',
  archivada: 'Archivada',
};

const phaseLabels: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  collecting: 'Recibiendo respuestas',
  live_voting: 'Votación en vivo',
  window_ended: 'Finalizada',
  closed: 'Cerrada',
  archived: 'Archivada',
  unknown: 'Estado no disponible',
};

const getPublishDisabledMessage = (
  reasonCode: string | null | undefined,
  status: SurveyAdmin['estado'],
  nextAction?: string | null,
) => {
  const declaredNextAction = nextAction?.trim();
  switch (reasonCode) {
    case 'survey_questions_required':
      return 'Agregá al menos una pregunta antes de publicar.';
    case 'survey_governance_release_required':
      return 'Completá la revisión y aprobación antes de publicar.';
    case 'survey_consent_public_text_required':
      return 'Completá el texto público de consentimiento antes de publicar.';
    case 'survey_jurisdiction_binding_conflict':
      return 'Los datos institucionales de la encuesta no coinciden con esta organización. No puede publicarse acá.';
    case 'survey_tenant_jurisdiction_unverified':
    case 'survey_jurisdiction_unbound':
    case 'survey_jurisdiction_binding_required':
      return 'Validá los datos institucionales de la organización y de la encuesta antes de publicar.';
    case 'survey_synthetic_sandbox_publish_forbidden':
      return 'Esta versión contiene datos de demostración. Prepará una versión limpia antes de abrir la participación.';
    case 'survey_identity_hmac_secret_unavailable':
      return 'Falta la configuración segura necesaria para aplicar el control de participación.';
    case 'survey_not_draft':
      if (status === 'publicada') return 'Ya está publicada y disponible para participar.';
      if (status === 'cerrada') return 'La participación ya fue cerrada y no admite una nueva publicación.';
      if (status === 'archivada') return 'Está archivada; restaurala antes de iniciar una nueva publicación.';
      return 'Sólo los borradores pueden publicarse.';
    default:
      if (declaredNextAction && !/^[a-z0-9_:-]+$/i.test(declaredNextAction)) {
        return declaredNextAction;
      }
      return 'La publicación no está habilitada para el estado actual.';
  }
};

export const SurveyCard = ({
  survey,
  tenantSlug,
  onEdit,
  onAnalytics,
  onPublish,
  onManageGovernance,
  publishing,
  onClose,
  closing,
  onCopyLink,
  onDelete,
  deleting,
  onSeed,
  seeding,
  publicationNotice,
}: SurveyCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const operationLock = useRef(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'delete' | null>(null);
  const [actionError, setActionError] = useState('');
  const lifecycle = survey.admin_lifecycle;
  const publicUrl = getPublicSurveyUrlFromRecord(survey, { tenantSlug });
  const instrumentLabel = (lifecycle?.instrument_kind ?? (survey.tipo === 'votacion' ? 'voting' : 'survey')) === 'voting'
    ? 'Votación'
    : 'Encuesta';
  const canPublish = lifecycle
    ? lifecycle.capabilities.can_publish && lifecycle.actions.publish.enabled
    : survey.estado === 'borrador';
  const canClose = lifecycle
    ? lifecycle.capabilities.can_close && lifecycle.actions.close.enabled
    : survey.estado === 'publicada';
  const canShare = surveyCanShare(survey);
  const canDelete = lifecycle?.capabilities.can_delete ?? survey.estado === 'borrador';
  const canViewResults = lifecycle?.capabilities.can_view_results ?? true;
  const { responses, uniqueParticipants, responsesLast24h } = surveyCardMetrics(survey);
  const opensAt = lifecycle?.schedule.opens_at ?? survey.inicio_at;
  const closesAt = lifecycle?.schedule.closes_at ?? survey.fin_at;
  const governedDraft = isGovernedSurvey(survey) && lifecycle?.phase === 'draft';
  const publishDisabledMessage = lifecycle?.phase === 'draft' && !canPublish && !publicationNotice
    ? getPublishDisabledMessage(
        lifecycle.actions.publish.disabled_reason_code,
        survey.estado,
        lifecycle.actions.publish.next_action,
      )
    : null;
  const busy = Boolean(publishing || closing || deleting || seeding || pendingAction);
  const primaryAction = governedDraft && onManageGovernance
    ? 'governance'
    : canPublish && onPublish
      ? 'publish'
      : canViewResults
        ? 'detail'
        : 'edit';
  const displayStatus = lifecycle
    ? ['collecting', 'live_voting'].includes(lifecycle.phase) && !surveyIsReceiving(survey)
      ? 'Pendiente de validación'
      : phaseLabels[lifecycle.phase] ?? 'Estado no disponible'
    : statusLabels[survey.estado] ?? 'Sin estado';
  const isFinished = lifecycle
    ? ['window_ended', 'closed', 'archived'].includes(lifecycle.phase)
    : ['cerrada', 'archivada'].includes(survey.estado);

  const seedLabels =
    (survey.recursos as Record<string, unknown> | undefined)?.seed_ui as
      | {
          button?: string;
          buttonTitle?: string;
          dialogTitle?: string;
          dialogDescription?: string;
          confirmLabel?: string;
          loadingLabel?: string;
          cancelLabel?: string;
        }
      | undefined;

  const confirmOperation = async (kind: 'close' | 'delete') => {
    const action = kind === 'close' ? onClose : onDelete;
    if (!action || busy || operationLock.current || (kind === 'close' ? !canClose : !canDelete)) return;
    operationLock.current = true; setPendingAction(kind); setActionError('');
    try {
      await action();
      if (kind === 'close') setCloseDialogOpen(false); else setDeleteDialogOpen(false);
    } catch {
      setActionError('No se confirmó la operación. Revisá el estado antes de volver a intentar; no se reenvió automáticamente.');
    } finally { operationLock.current = false; setPendingAction(null); }
  };

  return (
    <Card
      role="article"
      aria-labelledby={`survey-title-${survey.id}`}
      className="survey-card overflow-hidden rounded-xl border border-border/70 shadow-sm transition-[border-color,box-shadow] motion-reduce:transition-none hover:border-border hover:shadow-md"
    >
      <CardHeader className="space-y-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">
            {instrumentLabel}
          </Badge>
          <Badge
            variant="outline"
            className={isFinished
              ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-border bg-muted/30 text-foreground'}
          >
            {displayStatus}
          </Badge>
        </div>
        <div className="min-w-0">
          <CardTitle id={`survey-title-${survey.id}`} className="line-clamp-2 text-lg font-semibold leading-snug">
            {survey.titulo}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-5">
        <SurveyParticipationAssurance survey={survey} compact />
        <dl
          aria-label="Datos de la encuesta"
          className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-4"
        >
          <div className="min-w-0">
            <dt className="text-xs leading-snug text-muted-foreground">Respuestas</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">
              {surveyCountLabel(responses)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs leading-snug text-muted-foreground">Participantes</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">
              {surveyCountLabel(uniqueParticipants)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs leading-snug text-muted-foreground">Últimas 24 h</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">
              {surveyCountLabel(responsesLast24h)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs leading-snug text-muted-foreground">Vigencia</dt>
            <dd className="mt-1 text-sm font-medium leading-snug text-foreground">
              {formatDate(opensAt)} – {formatDate(closesAt)}
            </dd>
          </div>
        </dl>

        {publicationNotice ? (
          <p
            role="status"
            aria-label={`Publicación bloqueada para ${survey.titulo}`}
            className="rounded-xl border border-amber-400/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          >
            {publicationNotice}
          </p>
        ) : null}
        {publishDisabledMessage ? (
          <p
            className="rounded-xl border border-amber-400/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            data-testid="publish-disabled-reason"
          >
            <span className="font-medium">Para publicar:</span> {publishDisabledMessage}
          </p>
        ) : null}
        <SurveyJurisdictionNextAction survey={survey} tenantSlug={tenantSlug} />
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/10 px-4 py-3 sm:px-5">
        {primaryAction === 'publish' && onPublish ? (
          <Button size="sm" onClick={onPublish} disabled={busy} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" /> {publishing ? 'Publicando…' : 'Publicar'}
          </Button>
        ) : null}
        {primaryAction === 'governance' && onManageGovernance ? (
          <Button size="sm" onClick={onManageGovernance} disabled={busy} className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Revisar y publicar
          </Button>
        ) : null}
        {canViewResults ? (
          <Button
            variant={primaryAction === 'detail' ? 'default' : 'outline'}
            size="sm"
            onClick={onAnalytics}
            disabled={busy}
            className="inline-flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Ver detalle
          </Button>
        ) : null}
        <Button
          variant={primaryAction === 'edit' ? 'default' : 'outline'}
          size="sm"
          onClick={onEdit}
          disabled={busy}
          className="inline-flex items-center gap-2"
        >
          <Edit className="h-4 w-4" aria-hidden="true" /> Editar
        </Button>

        {canClose && onClose ? (
          <AlertDialog open={closeDialogOpen} onOpenChange={(open) => { if (!busy && !operationLock.current) { setCloseDialogOpen(open); setActionError(''); } }}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="inline-flex items-center gap-2" disabled={busy}>
                <CalendarDays className="h-4 w-4" /> {closing || pendingAction === 'close' ? 'Cerrando…' : 'Cerrar participación'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="survey-card-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar {instrumentLabel.toLowerCase()}?</AlertDialogTitle>
                <AlertDialogDescription>
                  La participación se cerrará de forma irreversible y las respuestas nuevas serán rechazadas. Los
                  resultados ya registrados se conservarán.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <p className="survey-card-target">{survey.titulo} · ID {survey.id}</p>
              {actionError && <p role="alert">{actionError}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmOperation('close');
                  }}
                >
                  {closing || pendingAction === 'close' ? 'Cerrando…' : 'Cerrar definitivamente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {canShare && onCopyLink ? (
          <Button variant="ghost" size="sm" onClick={onCopyLink} disabled={busy} className="inline-flex items-center gap-2">
            <LinkIcon className="h-4 w-4" aria-hidden="true" /> Copiar enlace
          </Button>
        ) : null}
        {canShare && publicUrl && !busy ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              {lifecycle?.instrument_kind === 'voting' ? 'Ver en vivo' : 'Ver participación'}
            </a>
          </Button>
        ) : null}
        {onSeed && !busy ? <SeedButton onSeed={onSeed} loading={seeding} surveyTitle={survey.titulo} labels={seedLabels} /> : null}

        {canDelete && onDelete ? (
          <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!busy && !operationLock.current) { setDeleteDialogOpen(open); setActionError(''); } }}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy} className="survey-card-delete-trigger inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Borrar borrador
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="survey-card-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es permanente. Sólo se ofrece para borradores sin respuestas registradas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <p className="survey-card-target">{survey.titulo} · ID {survey.id}</p>
              {actionError && <p role="alert">{actionError}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmOperation('delete');
                  }}
                >
                  {deleting || pendingAction === 'delete' ? 'Borrando…' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardFooter>
    </Card>
  );
};
