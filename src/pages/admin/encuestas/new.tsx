import { useNavigate } from 'react-router-dom';

import { SurveyEditor } from '@/components/surveys/SurveyEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type { SurveyDraftPayload } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';

const NewSurveyPage = () => {
  const navigate = useNavigate();
  const { createSurvey, isSaving } = useSurveyAdmin();

  const handleSave = async (payload: SurveyDraftPayload) => {
    try {
      const created = await createSurvey(payload);
      toast({ title: 'Encuesta creada', description: 'Ya podés continuar editando preguntas o publicarla.' });
      navigate(`/admin/encuestas/${created.id}`);
    } catch (error) {
      toast({ title: 'No pudimos crear la encuesta', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva encuesta</CardTitle>
          <CardDescription>Definí el formulario, las preguntas y las reglas de participación.</CardDescription>
        </CardHeader>
        <CardContent>
          <SurveyEditor onSave={handleSave} isSaving={isSaving} />
        </CardContent>
      </Card>
    </div>
  );
};

export default NewSurveyPage;
