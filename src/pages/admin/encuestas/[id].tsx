import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { SurveyEditor } from '@/components/surveys/SurveyEditor';
import { SurveyGovernancePanel } from '@/components/surveys/SurveyGovernancePanel';
import { SurveyEligibilityAdminPanel } from '@/components/surveys/SurveyEligibilityAdminPanel';
import { SeedButton } from '@/components/surveys/SeedButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type { SurveyDraftPayload } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { ApiError, getErrorMessage } from '@/utils/api';
import { isSurveySyntheticSeedQaEnabled } from '@/utils/surveySyntheticSeedGate';
import {
  SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE,
  SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE,
  isSurveyResponseDuplicateError,
} from '@/utils/surveySubmissionErrors';

const isStructureLockedError = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 409 &&
  typeof error.body === 'object' &&
  error.body !== null &&
  (error.body as Record<string, unknown>).reason_code === 'survey_structure_locked';

const SurveyDetailPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const surveyId = useMemo(() => (params.id ? Number(params.id) : null), [params.id]);
  const {
    survey,
    isLoadingSurvey,
    surveyError,
    saveSurvey,
    duplicateSurvey,
    publishSurvey,
    seedSurvey,
    isSaving,
    isPublishing,
    isDuplicating,
    isSeeding,
    refetchSurvey,
    tenantSlug,
  } = useSurveyAdmin({ id: surveyId ?? undefined });
  const [lockedEditMessage, setLockedEditMessage] = useState<string | null>(null);
  const syntheticSeedQaEnabled = isSurveySyntheticSeedQaEnabled({ tenantId: survey?.tenant_id });

  const handleSave = async (payload: SurveyDraftPayload) => {
    try {
      await saveSurvey(payload);
      setLockedEditMessage(null);
      toast({ title: 'Encuesta actualizada', description: 'Los cambios se guardaron correctamente.' });
      await refetchSurvey();
    } catch (error) {
      const description = getErrorMessage(error, 'No pudimos guardar la encuesta.');
      if (isStructureLockedError(error)) {
        setLockedEditMessage(description);
      }
      toast({ title: 'Error al guardar', description, variant: 'destructive' });
      throw error;
    }
  };

  const handlePublish = async () => {
    try {
      await publishSurvey();
      toast({ title: 'Encuesta publicada', description: 'Compartí el enlace o descargá el QR para difundirla.' });
      await refetchSurvey();
    } catch (error) {
      toast({ title: 'No se pudo publicar', description: String((error as Error)?.message ?? error), variant: 'destructive' });
      throw error;
    }
  };

  const handleDuplicate = async () => {
    if (!surveyId || !survey) return;
    try {
      const duplicated = await duplicateSurvey(surveyId);
      toast({
        title: 'Nueva version creada',
        description: 'Abrimos una copia editable para cambiar preguntas sin romper respuestas historicas.',
      });
      navigate(`/admin/encuestas/${duplicated.id}`);
    } catch (error) {
      toast({ title: 'No pudimos crear la nueva version', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const seedSyntheticTestData = async () => {
    if (!surveyId) return;
    try {
      const result = await seedSurvey(surveyId, { cantidad: 100, reset: true });
      const resetInfo = result.reset
        ? ` (${result.reset.respuestas ?? 0} respuestas, ${result.reset.comentarios ?? 0} comentarios)`
        : '';
      toast({
        title: 'Datos sintéticos actualizados',
        description: `Se generaron ${result.creadas} respuestas sintéticas.${resetInfo}`,
      });
    } catch (error) {
      if (isSurveyResponseDuplicateError(error)) {
        toast({
          title: SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE,
          description: SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE,
        });
        return;
      }
      toast({
        title: 'Error al generar datos sintéticos',
        description: getErrorMessage(error, 'Intentá nuevamente en unos minutos.'),
        variant: 'destructive',
      });
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

  const structureLocked = survey.structure_guard
    ? survey.structure_guard.locked
    : survey.estado === 'publicada';
  const lockMessage =
    lockedEditMessage ||
    'Podes corregir textos, fechas y configuracion. Para cambiar preguntas u opciones, crea una nueva version editable.';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Editar encuesta</CardTitle>
            <CardDescription>Actualizá contenido, reglas y preguntas antes de compartirla.</CardDescription>
          </div>
          {syntheticSeedQaEnabled ? (
            <SeedButton
              onSeed={seedSyntheticTestData}
              loading={isSeeding}
              surveyTitle={survey.titulo}
              labels={{
                button: 'Reemplazar por 100 respuestas sintéticas',
                buttonTitle: 'Herramienta de QA con datos sintéticos',
                dialogTitle: '¿Reemplazar las respuestas por datos sintéticos?',
                dialogDescription:
                  'Esta acción elimina las respuestas y comentarios actuales de “{title}” y los reemplaza por 100 respuestas sintéticas de prueba.',
                confirmLabel: 'Sí, reemplazar con datos sintéticos',
                loadingLabel: 'Generando datos sintéticos...',
                cancelLabel: 'Cancelar',
              }}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {structureLocked || lockedEditMessage ? (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold text-amber-100">Esta encuesta ya tiene respuestas y su estructura esta bloqueada.</p>
              <p className="mt-1 text-amber-100/80">{lockMessage}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={handleDuplicate}
                disabled={isDuplicating}
              >
                {isDuplicating ? 'Creando version...' : 'Crear nueva version editable'}
              </Button>
            </div>
          ) : null}
          <SurveyEditor
            survey={survey}
            tenantSlug={tenantSlug}
            onSave={handleSave}
            onPublish={handlePublish}
            isSaving={isSaving}
            isPublishing={isPublishing}
            structureLocked={structureLocked}
          />
        </CardContent>
      </Card>
      <SurveyGovernancePanel surveyId={survey.id} tenantSlug={tenantSlug} />
      <SurveyEligibilityAdminPanel surveyId={survey.id} tenantSlug={tenantSlug} />
      <div className="text-sm text-muted-foreground">
        <button className="underline" onClick={() => navigate('/admin/encuestas')}>
          Volver al listado
        </button>
      </div>
    </div>
  );
};

export default SurveyDetailPage;
