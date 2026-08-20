import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { Eye, EyeOff, FlaskConical, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicResponsePayload, SurveyDraftPayload, SurveyPublic } from '@/types/encuestas';
import { parseSurveyConditionalLogic } from '@/utils/surveyConditionalLogic';

const LazySurveyForm = lazy(async () => {
  const module = await import('./SurveyForm');
  return { default: module.SurveyForm };
});

const PREVIEW_START_DATE = '2000-01-01T00:00:00.000Z';
const PREVIEW_END_DATE = '2100-01-01T00:00:00.000Z';

const noOpPreviewSubmit = async (_payload: PublicResponsePayload) => undefined;

const validDateOr = (value: string | null | undefined, fallback: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return fallback;
  return value;
};

/**
 * Converts an unsaved admin draft into a deterministic public-survey shape.
 * Synthetic IDs are local to the tester and can never be confused with persisted records.
 */
export const buildSurveyPreview = (draft: SurveyDraftPayload): SurveyPublic => ({
  slug: '__local-survey-preview__',
  titulo: draft.titulo.trim() || 'Encuesta sin título',
  descripcion: draft.descripcion?.trim() || undefined,
  tipo: draft.tipo,
  inicio_at: validDateOr(draft.inicio_at, PREVIEW_START_DATE),
  fin_at: validDateOr(draft.fin_at, PREVIEW_END_DATE),
  politica_unicidad: draft.politica_unicidad,
  auth_mode: 'anonymous',
  anonimo_permitido: true,
  requiere_datos_contacto: Boolean(draft.requiere_datos_contacto),
  preguntas: draft.preguntas.map((question, questionIndex) => ({
    id: questionIndex + 1,
    question_ref: question.question_ref,
    orden: questionIndex + 1,
    tipo: question.tipo,
    texto: question.texto.trim() || `Pregunta ${questionIndex + 1} sin título`,
    obligatoria: question.obligatoria,
    min_selecciones: question.min_selecciones ?? undefined,
    max_selecciones: question.max_selecciones ?? undefined,
    conditional_logic: parseSurveyConditionalLogic(question.conditional_logic),
    opciones:
      question.tipo === 'abierta'
        ? undefined
        : (Array.isArray(question.opciones) ? question.opciones : []).map((option, optionIndex) => ({
            id: `preview-${questionIndex + 1}-${optionIndex + 1}`,
            option_ref: option.option_ref,
            orden: optionIndex + 1,
            texto: option.texto.trim() || `Opción ${optionIndex + 1} sin texto`,
            valor: option.valor,
          })),
  })),
  es_votacion_envivo: Boolean(draft.es_votacion_envivo),
  mostrar_resultados_envivo: Boolean(draft.mostrar_resultados_envivo),
  permitir_comentarios: Boolean(draft.permitir_comentarios),
  puntos_recompensa: draft.puntos_recompensa,
});

interface SurveyPreviewTesterProps {
  draft: SurveyDraftPayload;
}

export const SurveyPreviewTester = ({ draft }: SurveyPreviewTesterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const previewSurvey = useMemo(() => buildSurveyPreview(draft), [draft]);
  const adaptiveQuestions = draft.preguntas.filter((question) => Boolean(question.conditional_logic)).length;

  return (
    <Card className="border-dashed border-primary/40 bg-primary/[0.03]" data-testid="survey-preview-tester">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
            Tester de experiencia y rutas
          </CardTitle>
          <CardDescription>
            Recorré el borrador como participante y comprobá qué preguntas aparecen con cada respuesta.
          </CardDescription>
          <p className="text-xs font-medium text-primary">
            {adaptiveQuestions > 0
              ? `${adaptiveQuestions} pregunta${adaptiveQuestions === 1 ? '' : 's'} con ruta adaptativa`
              : 'Sin rutas adaptativas configuradas'}
          </p>
        </div>
        <Button
          type="button"
          variant={isOpen ? 'secondary' : 'outline'}
          className="w-full shrink-0 sm:w-auto"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {isOpen ? 'Cerrar tester' : 'Abrir tester'}
        </Button>
      </CardHeader>

      {isOpen ? (
        <CardContent id={panelId} className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <p>
              Simulación local: no crea votos, no llama APIs, no emite analítica y no solicita ni conserva datos personales.
            </p>
          </div>

          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border/70 bg-muted/20 p-2 shadow-inner sm:p-4">
            <div className="mb-3 flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Vista participante</span>
              <span>Sesión efímera</span>
            </div>
            <Suspense
              fallback={(
                <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground" role="status">
                  Preparando simulación…
                </div>
              )}
            >
              <LazySurveyForm
                survey={previewSurvey}
                onSubmit={noOpPreviewSubmit}
                previewMode
                variant={draft.tipo === 'votacion' ? 'votacion' : 'default'}
              />
            </Suspense>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
};
