import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';

import { TenantShell } from '@/components/tenant/TenantShell';
import { useTenant } from '@/context/TenantContext';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import type { PublicResponsePayload } from '@/types/encuestas';
import { SurveyForm } from '@/components/surveys/SurveyForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ApiError } from '@/utils/api';
import { PublicSurveyShareActions } from '@/components/surveys/PublicSurveyShareActions';
import { trackSurveySubmission } from '@/utils/surveyAnalytics';

const TenantSurveyDetailPage = () => {
  const { slug: surveySlug } = useParams<{ slug: string }>();
  const { tenant, currentSlug } = useTenant();
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<PublicResponsePayload | null>(null);

  const tenantSlug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    return null;
  }, [currentSlug, tenant?.slug]);

  const basePath = tenantSlug ? `/t/${encodeURIComponent(tenantSlug)}` : null;

  const {
    survey,
    isLoading,
    error,
    submit,
    isSubmitting,
    submitError,
    duplicateDetected,
    submitStatus,
  } = useSurveyPublic(surveySlug, { tenantSlug });

  const metadata = useMemo(() => ({ tenant: tenantSlug ?? undefined }), [tenantSlug]);

  const handleSubmit = useCallback(
    async (payload: PublicResponsePayload) => {
      try {
        const finalPayload: PublicResponsePayload = { ...payload, metadata: { ...payload.metadata, ...metadata } };
        await submit(finalPayload);
        setLastSubmission(finalPayload);
        setSubmitted(true);
        if (survey) {
          trackSurveySubmission({ survey, payload: finalPayload });
        }
        toast({ title: '¡Gracias por participar!', description: 'Registramos tu respuesta correctamente.' });
      } catch (err) {
        setLastSubmission(null);
        if (err instanceof ApiError && err.status === 409) {
          toast({
            title: 'Ya registramos tu opinión',
            description: 'La política de unicidad impide enviar más de una respuesta.',
          });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: 'No pudimos enviar tu respuesta',
          description: submitError ?? message ?? 'Intentá nuevamente.',
          variant: 'destructive',
        });
      }
    },
    [metadata, submit, submitError, survey],
  );

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setLastSubmission(null);
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
      ) : submitted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-2xl font-semibold">¡Gracias por participar!</h1>
              <p className="text-muted-foreground">
                Tu respuesta se registró correctamente. Compartí esta encuesta para invitar a más personas a sumarse.
              </p>
            </div>
            <PublicSurveyShareActions survey={survey} submission={lastSubmission} />
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
            duplicateDetected={duplicateDetected}
          />
        </div>
      )}
    </TenantShell>
  );
};

export default TenantSurveyDetailPage;
