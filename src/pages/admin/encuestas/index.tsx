import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';

import { SurveyCard } from '@/components/surveys/SurveyCard';
import { Button } from '@/components/ui/button';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type { SurveyAdmin } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { getAbsolutePublicSurveyUrl } from '@/utils/publicSurveyUrl';

const AdminSurveysIndex = () => {
  const navigate = useNavigate();
  const { surveys, isLoadingList, listError, publishSurvey, isPublishing, refetchList } = useSurveyAdmin();
  const [publishingId, setPublishingId] = useState<number | null>(null);

  const handlePublish = async (survey: SurveyAdmin) => {
    try {
      setPublishingId(survey.id);
      await publishSurvey(survey.id);
      toast({ title: 'Encuesta publicada', description: 'Ya podés compartir el enlace público.' });
      await refetchList();
    } catch (error) {
      toast({ title: 'No pudimos publicar la encuesta', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    } finally {
      setPublishingId(null);
    }
  };

  const handleCopyLink = async (survey: SurveyAdmin) => {
    const publicUrl = getAbsolutePublicSurveyUrl(survey.slug);
    if (!publicUrl) {
      toast({
        title: 'No se pudo generar el enlace público',
        description: 'Verificá que la encuesta tenga un slug configurado.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Link copiado', description: 'Compartilo en redes, mailings o un QR impreso.' });
    } catch (error) {
      toast({ title: 'No se pudo copiar el enlace', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const items = surveys?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Encuestas ciudadanas</h1>
          <p className="text-sm text-muted-foreground">Diseñá, gestioná y difundí instancias de participación desde un solo lugar.</p>
        </div>
        <Button onClick={() => navigate('/admin/encuestas/new')} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nueva encuesta
        </Button>
      </div>

      {listError && <p className="text-sm text-destructive">{listError}</p>}

      {isLoadingList ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onEdit={() => navigate(`/admin/encuestas/${survey.id}`)}
              onAnalytics={() => navigate(`/admin/encuestas/${survey.id}/analytics`)}
              onPublish={survey.estado !== 'publicada' ? () => handlePublish(survey) : undefined}
              publishing={isPublishing && publishingId === survey.id}
              onCopyLink={survey.estado === 'publicada' ? () => handleCopyLink(survey) : undefined}
            />
          ))}
          {!items.length && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Todavía no cargaste encuestas. Creá una nueva para comenzar la fase de participación.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSurveysIndex;
