import { CalendarDays, BarChart3, Edit, LinkIcon, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SurveyAdmin } from '@/types/encuestas';

interface SurveyCardProps {
  survey: SurveyAdmin;
  onEdit: () => void;
  onAnalytics: () => void;
  onPublish?: () => void;
  publishing?: boolean;
  onCopyLink?: () => void;
}

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : 'Sin fecha';

const statusVariants: Record<SurveyAdmin['estado'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  borrador: 'secondary',
  publicada: 'default',
  cerrada: 'outline',
  archivada: 'destructive',
};

export const SurveyCard = ({ survey, onEdit, onAnalytics, onPublish, publishing, onCopyLink }: SurveyCardProps) => (
  <Card className="border border-border/70 shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-xl font-semibold">{survey.titulo}</CardTitle>
        <Badge variant={statusVariants[survey.estado]} className="uppercase tracking-wide">
          {survey.estado}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">{survey.descripcion || 'Sin descripción'}</p>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {formatDate(survey.inicio_at)} – {formatDate(survey.fin_at)}</span>
        <span className="inline-flex items-center gap-1">Tipo: {survey.tipo}</span>
        <span className="inline-flex items-center gap-1">Slug: {survey.slug}</span>
      </div>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground space-y-1">
      <p>Preguntas: {survey.preguntas.length}</p>
      <p>Política de unicidad: {survey.politica_unicidad}</p>
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
    </CardFooter>
  </Card>
);
