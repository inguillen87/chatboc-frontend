import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { SurveyEditor } from '@/components/surveys/SurveyEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type { SurveyDraftPayload } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { apiFetch } from '@/utils/api';

const SurveyDetailPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const surveyId = useMemo(() => (params.id ? Number(params.id) : null), [params.id]);
  const { survey, isLoadingSurvey, surveyError, saveSurvey, publishSurvey, isSaving, isPublishing, refetchSurvey } = useSurveyAdmin({ id: surveyId ?? undefined });

  const handleSave = async (payload: SurveyDraftPayload) => {
    try {
      await saveSurvey(payload);
      toast({ title: 'Encuesta actualizada', description: 'Los cambios se guardaron correctamente.' });
      await refetchSurvey();
    } catch (error) {
      toast({ title: 'Error al guardar', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handlePublish = async () => {
    try {
      await publishSurvey();
      toast({ title: 'Encuesta publicada', description: 'Compartí el enlace o descargá el QR para difundirla.' });
      await refetchSurvey();
    } catch (error) {
      toast({ title: 'No se pudo publicar', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const seedDemoData = async () => {
    if (!surveyId) return;
    try {
      const result = await apiFetch<{ message: string }>(`/admin/encuestas/${surveyId}/seed-demo`, {
        method: 'POST',
        body: {},
        omitEntityToken: true
      });
      toast({ title: "Seeding complete", description: result.message });
    } catch (error) {
      console.error('Seeding failed:', error);
      toast({ title: 'Error seeding data', variant: 'destructive' });
    }
  };

  if (isLoadingSurvey) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!survey || surveyError) {
    return <p className="text-sm text-destructive">{surveyError || 'No encontramos esta encuesta.'}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Editar encuesta</CardTitle>
            <CardDescription>Actualizá contenido, reglas y preguntas antes de compartirla.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={seedDemoData}>
            Seed Demo Data
          </Button>
        </CardHeader>
        <CardContent>
          <SurveyEditor
            survey={survey}
            onSave={handleSave}
            onPublish={handlePublish}
            isSaving={isSaving}
            isPublishing={isPublishing}
          />
        </CardContent>
      </Card>
      <div className="text-sm text-muted-foreground">
        <button className="underline" onClick={() => navigate('/admin/encuestas')}>
          Volver al listado
        </button>
      </div>
    </div>
  );
};

export default SurveyDetailPage;
