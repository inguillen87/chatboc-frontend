import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';

import { TenantShell } from '@/components/tenant/TenantShell';
import { useTenant } from '@/context/TenantContext';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import type { PublicResponsePayload } from '@/types/encuestas';
import { SurveyForm } from '@/components/surveys/SurveyForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  AmbiguousSurveySubmissionError,
  SURVEY_RESPONSE_DUPLICATE_MESSAGE,
  SURVEY_RESPONSE_DUPLICATE_TITLE,
  isSurveyResponseDuplicateError,
} from '@/utils/surveySubmissionErrors';
import { PublicSurveyShareActions } from '@/components/surveys/PublicSurveyShareActions';
import { resolveSurveyResponseProvenance } from '@/components/surveys/SurveyResponseProvenanceBadge';
import { trackSurveyDemoInteraction, trackSurveySubmission } from '@/utils/surveyAnalytics';

const TenantSurveyDetailPage = () => {
  const { slug: surveySlug } = useParams<{ slug: string }>();
  const { tenant, currentSlug } = useTenant();
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<PublicResponsePayload | null>(null);
  const [demoSubmissionPersisted, setDemoSubmissionPersisted] = useState<boolean | null>(null);

  const tenantSlug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    return null;
  }, [currentSlug, tenant?.slug]);

  const basePath = tenantSlug ? `/t/${encodeURIComponent(tenantSlug)}` : null;
  const liveExperiencePath = useMemo(() => {
    if (!surveySlug?.trim()) return null;
    const query = tenantSlug ? `?tenant_slug=${encodeURIComponent(tenantSlug)}` : '';
    return `/e/${encodeURIComponent(surveySlug.trim())}${query}`;
  }, [surveySlug, tenantSlug]);

  const {
    survey,
    isLoading,
    error,
    submit,
    isSubmitting,
    submitError,
    submitStatus,
    submitErrorDetails,
    submitReasonCode,
  } = useSurveyPublic(surveySlug, { tenantSlug });

  const isSyntheticDemo = Boolean(
    survey?.demo_mode === true ||
      resolveSurveyResponseProvenance(survey?.resultados_envivo, survey)?.mode === 'synthetic',
  );

  const metadata = useMemo(() => ({ tenant: tenantSlug ?? undefined }), [tenantSlug]);

  const handleSubmit = useCallback(
    async (payload: PublicResponsePayload) => {
      try {
        const finalPayload: PublicResponsePayload = { ...payload, metadata: { ...payload.metadata, ...metadata } };
        const submissionAck = await submit(finalPayload);
        const ackMatchesSurvey = isSyntheticDemo
          ? submissionAck.ack_kind === 'synthetic_demo' || submissionAck.ack_kind === 'durable_demo'
          : submissionAck.ack_kind === 'durable_response';
        if (!ackMatchesSurvey) {
          throw new AmbiguousSurveySubmissionError(
            'La confirmación del servidor no coincide con el tipo de encuesta publicada. Reintenta con la misma respuesta.',
          );
        }
        const persistedDemoInteraction = submissionAck.ack_kind === 'durable_demo';
        setDemoSubmissionPersisted(isSyntheticDemo ? persistedDemoInteraction : null);
        setLastSubmission(
          isSyntheticDemo && !persistedDemoInteraction ? null : finalPayload,
        );
        setSubmitted(true);
        if (survey) {
          if (isSyntheticDemo) {
            trackSurveyDemoInteraction({
              survey,
              payload: finalPayload,
              persisted: persistedDemoInteraction,
              durable: persistedDemoInteraction,
            });
          } else {
            trackSurveySubmission({ survey, payload: finalPayload });
          }
        }
        toast({
          title: isSyntheticDemo
            ? persistedDemoInteraction
              ? 'Participación demo guardada en Preview'
              : 'Simulación completada'
            : '¡Gracias por participar!',
          description: isSyntheticDemo
            ? persistedDemoInteraction
              ? 'La interacción de prueba quedó separada de cualquier dato ciudadano.'
              : 'La selección no se guardó ni modificó datos ciudadanos.'
            : 'Registramos tu respuesta correctamente.',
        });
      } catch (err) {
        setLastSubmission(null);
        if (isSurveyResponseDuplicateError(err)) {
          toast({
            title: SURVEY_RESPONSE_DUPLICATE_TITLE,
            description: SURVEY_RESPONSE_DUPLICATE_MESSAGE,
          });
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: 'No pudimos enviar tu respuesta',
          description: submitError ?? message ?? 'Intentá nuevamente.',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [isSyntheticDemo, metadata, submit, submitError, survey],
  );

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setLastSubmission(null);
    setDemoSubmissionPersisted(null);
  }, []);

  return (
    <TenantShell>
      {!surveySlug ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-lg font-medium">No encontramos la encuesta solicitada.</p>
            {basePath ? (
              <Button asChild>
                <Link to={`${basePath}/encuestas`}>Volver al listado</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error || !survey ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-lg font-medium">No pudimos cargar esta encuesta.</p>
            <p className="text-sm text-muted-foreground">{error || 'El enlace puede estar vencido o no existe.'}</p>
            {basePath ? (
              <Button asChild>
                <Link to={`${basePath}/encuestas`}>Ver otras encuestas</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (survey.es_votacion_envivo || survey.mostrar_resultados_envivo) && liveExperiencePath ? (
        <Navigate to={liveExperiencePath} replace />
      ) : submitted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-2xl font-semibold">
                {isSyntheticDemo
                  ? demoSubmissionPersisted
                    ? 'Participación demo guardada en Preview'
                    : 'Simulación interactiva completada'
                  : '¡Gracias por participar!'}
              </h1>
              <p className="text-muted-foreground">
                {isSyntheticDemo
                  ? demoSubmissionPersisted
                    ? 'La interacción quedó registrada únicamente como dato de prueba y no forma parte de resultados ciudadanos.'
                    : 'La selección no se guardó ni alteró datos ciudadanos.'
                  : 'Tu respuesta se registró correctamente. Compartí esta encuesta para invitar a más personas a sumarse.'}
              </p>
            </div>
            <PublicSurveyShareActions
              survey={survey}
              submission={isSyntheticDemo ? null : lastSubmission}
              tenantSlug={tenantSlug}
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              {basePath ? (
                <Button asChild>
                  <Link to={`${basePath}/encuestas`}>Volver al listado</Link>
                </Button>
              ) : null}
              <Button variant="outline" onClick={handleReset}>
                Responder nuevamente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Link
            to={basePath ? `${basePath}/encuestas` : '/encuestas'}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a encuestas
          </Link>
          <SurveyForm
            survey={survey}
            onSubmit={handleSubmit}
            loading={isSubmitting}
            defaultMetadata={metadata}
            submitErrorMessage={submitError}
            submitErrorStatus={submitStatus}
            submitErrorDetails={submitErrorDetails}
            submitReasonCode={submitReasonCode}
          />
        </div>
      )}
    </TenantShell>
  );
};

export default TenantSurveyDetailPage;
