import { useState } from 'react';
import { BarChart3, CalendarDays, Edit, LinkIcon, Send, Trash2 } from 'lucide-react';

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

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('es-AR') : 'Sin fecha');

const statusVariants: Record<SurveyAdmin['estado'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  borrador: 'secondary',
  publicada: 'default',
  cerrada: 'outline',
  archivada: 'destructive',
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

export const SurveyCard = ({
  survey,
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
  const publicUrl = getPublicSurveyUrlFromRecord(survey);
  const instrumentLabel = lifecycle?.instrument_kind === 'voting' ? 'Votación' : 'Encuesta';
  const canPublish = lifecycle?.capabilities.can_publish ?? survey.estado === 'borrador';
  const canClose = lifecycle?.capabilities.can_close ?? survey.estado === 'publicada';
  const canShare = lifecycle?.capabilities.can_share ?? survey.estado === 'publicada';
  const participation = lifecycle?.participation;
  const busy = Boolean(publishing || closing);

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
    <Card className="border border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl font-semibold">{survey.titulo}</CardTitle>
          <Badge variant={statusVariants[survey.estado] ?? 'outline'} className="uppercase tracking-wide">
            {survey.estado || 'sin estado'}
          </Badge>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{survey.descripcion || 'Sin descripción'}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4" /> {formatDate(survey.inicio_at)} – {formatDate(survey.fin_at)}
          </span>
          <span>Tipo: {survey.tipo || '—'}</span>
          <span>Slug: {survey.slug || '—'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{instrumentLabel}</Badge>
          {lifecycle ? <Badge variant="secondary">{phaseLabels[lifecycle.phase] ?? lifecycle.phase}</Badge> : null}
          {survey.mostrar_resultados_envivo ? <Badge variant="secondary">Resultados en tiempo real</Badge> : null}
          {survey.permitir_comentarios ? <Badge variant="outline">Comentarios abiertos</Badge> : null}
          {autoSeedCantidad ? <Badge variant="outline">Demo precargada: {autoSeedCantidad}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Preguntas: {Array.isArray(survey.preguntas) ? survey.preguntas.length : 0}</p>
        <p>Política de unicidad: {survey.politica_unicidad || '—'}</p>
        {participation ? (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-4">
            <div>
              <p className="text-xs">Respuestas</p>
              <p className="font-semibold tabular-nums text-foreground">{participation.responses.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-xs">Participantes</p>
              <p className="font-semibold tabular-nums text-foreground">
                {participation.unique_participants.toLocaleString('es-AR')}
              </p>
            </div>
            <div>
              <p className="text-xs">Últimas 24 h</p>
              <p className="font-semibold tabular-nums text-foreground">
                {participation.responses_last_24h.toLocaleString('es-AR')}
              </p>
            </div>
            <div>
              <p className="text-xs">Abstención</p>
              <p className="font-semibold text-foreground">
                {participation.abstentions === null ? 'No disponible' : participation.abstentions.toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy} className="inline-flex items-center gap-2">
          <Edit className="h-4 w-4" /> Editar
        </Button>
        <Button variant="outline" size="sm" onClick={onAnalytics} disabled={busy} className="inline-flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Resultados
        </Button>
        {canPublish && onPublish ? (
          <Button size="sm" onClick={onPublish} disabled={publishing} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" /> {publishing ? 'Publicando…' : 'Publicar'}
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

        {onDelete && !busy ? (
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
