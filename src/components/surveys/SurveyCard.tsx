import { useState } from 'react';
import { CalendarDays, BarChart3, Edit, LinkIcon, Send, Trash2 } from 'lucide-react';

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

interface SurveyCardProps {
  survey: SurveyAdmin;
  onEdit: () => void;
  onAnalytics: () => void;
  onPublish?: () => void;
  publishing?: boolean;
  onCopyLink?: () => void;
  onDelete?: () => Promise<void> | void;
  deleting?: boolean;
  onSeed?: () => Promise<void>;
  seeding?: boolean;
}

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : 'Sin fecha';

const statusVariants: Record<SurveyAdmin['estado'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  borrador: 'secondary',
  publicada: 'default',
  cerrada: 'outline',
  archivada: 'destructive',
};

export const SurveyCard = ({
  survey,
  onEdit,
  onAnalytics,
  onPublish,
  publishing,
  onCopyLink,
  onDelete,
  deleting,
  onSeed,
  seeding,
}: SurveyCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    try {
      await onDelete();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('No se pudo eliminar la encuesta', error);
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
          <span className="inline-flex items-center gap-1">Tipo: {survey.tipo || '—'}</span>
          <span className="inline-flex items-center gap-1">Slug: {survey.slug || '—'}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>Preguntas: {Array.isArray(survey.preguntas) ? survey.preguntas.length : 0}</p>
        <p>Política de unicidad: {survey.politica_unicidad || '—'}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="inline-flex items-center gap-2">
          <Edit className="h-4 w-4" /> Editar
        </Button>
        <Button variant="outline" size="sm" onClick={onAnalytics} className="inline-flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Analytics
        </Button>
        {survey.estado !== 'publicada' && onPublish && (
          <Button size="sm" onClick={onPublish} disabled={publishing} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" /> {publishing ? 'Publicando…' : 'Publicar'}
          </Button>
        )}
        {survey.estado === 'publicada' && onCopyLink && (
          <Button variant="ghost" size="sm" onClick={onCopyLink} className="inline-flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> Copiar link
          </Button>
        )}
        {onSeed && (
          <SeedButton onSeed={onSeed} loading={seeding} surveyTitle={survey.titulo} />
        )}
        {onDelete ? (
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Borrar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar encuesta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es permanente y eliminará la encuesta {survey.titulo} y sus respuestas de prueba.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={Boolean(deleting)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} disabled={Boolean(deleting)}>
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
