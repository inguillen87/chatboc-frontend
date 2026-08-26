import { useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, Edit, LinkIcon, Send, Trash2 } from 'lucide-react';

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
import { getAutoSeedCantidad } from '@/utils/surveyDemoPriority';

interface SurveyCardProps {
  survey: SurveyAdmin;
  tenantSlug?: string | null;
  onEdit: () => void;
  onAnalytics: () => void;
  onPublish?: () => void;
  publishing?: boolean;
  onClose?: () => Promise<void> | void;
  closing?: boolean;
  onCopyLink?: () => void;
  onDelete?: () => Promise<void> | void;
  deleting?: boolean;
  onSeed?: () => Promise<void>;
  seeding?: boolean;
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('es-AR') : 'Sin fecha');

const statusVariants: Record<SurveyAdmin['estado'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  borrador: 'secondary',
  publicada: 'default',
  cerrada: 'outline',
  archivada: 'destructive',
};

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
  window_ended: 'Ventana finalizada',
  closed: 'Cerrada',
  archived: 'Archivada',
  unknown: 'Estado no disponible',
};

const getPublishDisabledMessage = (reasonCode: string | null | undefined, status: SurveyAdmin['estado']) => {
  switch (reasonCode) {
    case 'survey_questions_required':
      return 'Agregá al menos una pregunta antes de publicar.';
    case 'survey_governance_release_required':
      return 'La publicación requiere completar la revisión y aprobación de gobernanza.';
    case 'survey_consent_public_text_required':
      return 'Completá el texto público de consentimiento antes de publicar.';
    case 'survey_jurisdiction_binding_conflict':
      return 'La jurisdicción del contenido no coincide con esta organización. Se conserva para auditoría y no puede publicarse aquí.';
    case 'survey_tenant_jurisdiction_unverified':
    case 'survey_jurisdiction_unbound':
    case 'survey_jurisdiction_binding_required':
      return 'Validá la jurisdicción institucional de la organización y del instrumento antes de publicar.';
    case 'survey_synthetic_sandbox_publish_forbidden':
      return 'Esta versión contiene datos de demostración. Prepará una versión limpia antes de abrir la participación.';
    case 'survey_identity_hmac_secret_unavailable':
      return 'Falta la configuración segura de identidad necesaria para aplicar la política de unicidad.';
    case 'survey_not_draft':
      if (status === 'publicada') return 'Ya está publicada y disponible para participar.';
      if (status === 'cerrada') return 'La participación ya fue cerrada y no admite una nueva publicación.';
      if (status === 'archivada') return 'Está archivada; restaurala antes de iniciar una nueva publicación.';
      return 'Sólo los borradores pueden publicarse.';
    default:
      return 'La publicación no está habilitada para el estado actual.';
  }
};

export const SurveyCard = ({
  survey,
  tenantSlug,
  onEdit,
  onAnalytics,
  onPublish,
  publishing,
  onClose,
  closing,
  onCopyLink,
  onDelete,
  deleting,
  onSeed,
  seeding,
}: SurveyCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const lifecycle = survey.admin_lifecycle;
  const autoSeedCantidad = getAutoSeedCantidad(survey);
  const publicUrl = getPublicSurveyUrlFromRecord(survey, { tenantSlug });
  const instrumentLabel = lifecycle?.instrument_kind === 'voting' ? 'Votación' : 'Encuesta';
  const canPublish = lifecycle
    ? lifecycle.capabilities.can_publish && lifecycle.actions.publish.enabled
    : survey.estado === 'borrador';
  const canClose = lifecycle
    ? lifecycle.capabilities.can_close && lifecycle.actions.close.enabled
    : survey.estado === 'publicada';
  const canShare = lifecycle?.capabilities.can_share ?? survey.estado === 'publicada';
  const canDelete = lifecycle?.capabilities.can_delete ?? survey.estado === 'borrador';
  const canViewResults = lifecycle?.capabilities.can_view_results ?? true;
  const participation = lifecycle?.participation;
  const responses = participation?.responses ?? survey.metricas?.total_respuestas ?? 0;
  const uniqueParticipants = participation?.unique_participants ?? survey.metricas?.participantes_unicos ?? 0;
  const responsesLast24h = participation?.responses_last_24h ?? survey.metricas?.respuestas_ultimas_24h ?? 0;
  const publishDisabledMessage = lifecycle && !canPublish
    ? getPublishDisabledMessage(lifecycle.actions.publish.disabled_reason_code, survey.estado)
    : null;
  const busy = Boolean(publishing || closing);
  const primaryAction = canPublish && onPublish ? 'publish' : canViewResults ? 'analytics' : 'edit';

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

  const handleConfirmDelete = async () => {
    if (!onDelete || deleting) return;
    try {
      await onDelete();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('No se pudo eliminar la encuesta', error);
    }
  };

  const handleConfirmClose = async () => {
    if (!onClose || closing) return;
    try {
      await onClose();
      setCloseDialogOpen(false);
    } catch (error) {
      console.error('No se pudo cerrar la encuesta', error);
    }
  };

  return (
    <Card className="overflow-hidden border border-border/70 shadow-sm transition-[border-color,box-shadow] hover:border-border hover:shadow-md">
      <CardHeader className="space-y-0 px-5 pb-3 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {instrumentLabel}
            </p>
            <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug">{survey.titulo}</CardTitle>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant={statusVariants[survey.estado] ?? 'outline'}>
              {statusLabels[survey.estado] ?? 'Sin estado'}
            </Badge>
            {lifecycle ? (
              <span className="text-right text-xs text-muted-foreground">
                {phaseLabels[lifecycle.phase] ?? lifecycle.phase}
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-5 pb-4 pt-0">
        <dl
          role="group"
          aria-label="Métricas de participación"
          className="grid grid-cols-3 divide-x divide-border rounded-lg border bg-muted/25 py-3"
        >
          <div className="min-w-0 px-3">
            <dt className="truncate text-xs text-muted-foreground">Respuestas</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {responses.toLocaleString('es-AR')}
            </dd>
          </div>
          <div className="min-w-0 px-3">
            <dt className="truncate text-xs text-muted-foreground">Participantes</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {uniqueParticipants.toLocaleString('es-AR')}
            </dd>
          </div>
          <div className="min-w-0 px-3">
            <dt className="truncate text-xs text-muted-foreground">Últimas 24 h</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {responsesLast24h.toLocaleString('es-AR')}
            </dd>
          </div>
        </dl>

        {publishDisabledMessage ? (
          <p className="text-xs leading-relaxed text-muted-foreground" data-testid="publish-disabled-reason">
            <span className="font-medium text-foreground">Publicación:</span> {publishDisabledMessage}
          </p>
        ) : null}

        <details className="group rounded-lg border border-border/70 bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            Detalles y configuración
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t px-3 py-3 text-sm text-muted-foreground">
            <p className="mb-3 leading-relaxed">{survey.descripcion || 'Sin descripción cargada.'}</p>
            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground">Vigencia</dt>
                <dd className="mt-0.5 inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDate(survey.inicio_at)} – {formatDate(survey.fin_at)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Identificador público</dt>
                <dd className="mt-0.5 break-all">{survey.slug || 'No asignado'}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Preguntas</dt>
                <dd className="mt-0.5">{Array.isArray(survey.preguntas) ? survey.preguntas.length : 0}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Política de unicidad</dt>
                <dd className="mt-0.5">{survey.politica_unicidad || 'No definida'}</dd>
              </div>
              {participation ? (
                <div>
                  <dt className="font-medium text-foreground">Abstención</dt>
                  <dd className="mt-0.5">
                    {participation.abstentions === null
                      ? 'No disponible'
                      : participation.abstentions.toLocaleString('es-AR')}
                  </dd>
                </div>
              ) : null}
              {participation?.last_response_at ? (
                <div>
                  <dt className="font-medium text-foreground">Última respuesta</dt>
                  <dd className="mt-0.5">{formatDate(participation.last_response_at)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline">Tipo: {survey.tipo || 'No definido'}</Badge>
              {survey.mostrar_resultados_envivo ? <Badge variant="secondary">Resultados en tiempo real</Badge> : null}
              {survey.permitir_comentarios ? <Badge variant="outline">Comentarios abiertos</Badge> : null}
              {autoSeedCantidad ? <Badge variant="outline">Demo precargada: {autoSeedCantidad}</Badge> : null}
            </div>
          </div>
        </details>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/10 px-5 py-3">
        {primaryAction === 'publish' && onPublish ? (
          <Button size="sm" onClick={onPublish} disabled={publishing} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" /> {publishing ? 'Publicando…' : 'Publicar'}
          </Button>
        ) : null}
        {primaryAction === 'analytics' ? (
          <Button size="sm" onClick={onAnalytics} disabled={busy} className="inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Resultados
          </Button>
        ) : null}
        {primaryAction === 'edit' ? (
          <Button size="sm" onClick={onEdit} disabled={busy} className="inline-flex items-center gap-2">
            <Edit className="h-4 w-4" /> Editar
          </Button>
        ) : null}

        {primaryAction !== 'edit' ? (
          <Button variant="outline" size="sm" onClick={onEdit} disabled={busy} className="inline-flex items-center gap-2">
            <Edit className="h-4 w-4" /> Editar
          </Button>
        ) : null}
        {canViewResults && primaryAction !== 'analytics' ? (
          <Button variant="outline" size="sm" onClick={onAnalytics} disabled={busy} className="inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Resultados
          </Button>
        ) : null}

        {canClose && onClose ? (
          <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="inline-flex items-center gap-2" disabled={Boolean(closing)}>
                <CalendarDays className="h-4 w-4" /> {closing ? 'Cerrando…' : 'Cerrar participación'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar {instrumentLabel.toLowerCase()}?</AlertDialogTitle>
                <AlertDialogDescription>
                  La participación se cerrará de forma irreversible y las respuestas nuevas serán rechazadas. Los
                  resultados ya registrados se conservarán.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={Boolean(closing)}>Volver</AlertDialogCancel>
                <AlertDialogAction
                  disabled={Boolean(closing)}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleConfirmClose();
                  }}
                >
                  {closing ? 'Cerrando…' : 'Cerrar definitivamente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {canShare && onCopyLink ? (
          <Button variant="ghost" size="sm" onClick={onCopyLink} disabled={busy} className="inline-flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> Copiar link
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

        {canDelete && onDelete && !busy ? (
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Borrar borrador
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es permanente. Sólo se ofrece para borradores sin respuestas registradas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={Boolean(deleting)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={Boolean(deleting)}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleConfirmDelete();
                  }}
                >
                  {deleting ? 'Borrando…' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardFooter>
    </Card>
  );
};
