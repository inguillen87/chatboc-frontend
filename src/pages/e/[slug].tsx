import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { SurveyForm } from '@/components/surveys/SurveyForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import type { PublicResponsePayload } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { ApiError } from '@/utils/api';
import { usePageMetadata } from '@/hooks/usePageMetadata';
import { PublicSurveyShareActions } from '@/components/surveys/PublicSurveyShareActions';
import { trackSurveySubmission } from '@/utils/surveyAnalytics';

const PublicSurveyPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<PublicResponsePayload | null>(null);
  const {
    survey,
    isLoading,
    error,
    submit,
    isSubmitting,
    submitError,
    duplicateDetected,
    submitStatus,
  } = useSurveyPublic(slug, { tenantSlug });

  usePageMetadata({
    title: survey?.titulo ? `${survey.titulo} · Encuesta ciudadana` : 'Encuesta ciudadana',
    description:
      survey?.descripcion ??
      'Respondé la encuesta y ayudá a tomar decisiones basadas en la voz de la comunidad.',
    image: '/images/og-encuestas.svg',
  });

  const metadata = useMemo(() => {
    const canalParam = searchParams.get('canal') || searchParams.get('source');
    const normalizedCanal = canalParam === 'qr' || canalParam === 'web' || canalParam === 'whatsapp' || canalParam === 'email'
      ? canalParam
      : undefined;
    return {
      utm_source: searchParams.get('utm_source') || undefined,
      utm_campaign: searchParams.get('utm_campaign') || undefined,
      canal: normalizedCanal,
    } as Pick<PublicResponsePayload, 'utm_source' | 'utm_campaign' | 'canal'>;
  }, [searchParams]);

  const handleSubmit = useCallback(
    async (payload: PublicResponsePayload) => {
      try {
        const finalPayload: PublicResponsePayload = { ...payload, ...metadata };
        await submit(finalPayload);
        setLastSubmission(finalPayload);
        setSubmitted(true);
        if (survey) {
          trackSurveySubmission({ survey, payload: finalPayload });
        }
        toast({ title: '¡Gracias por participar!', description: 'Tu aporte se registró correctamente.' });
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
    [metadata, submit, survey, submitError],
  );

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setLastSubmission(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-lg font-medium">No pudimos cargar esta encuesta.</p>
            <p className="text-sm text-muted-foreground">{error || 'El enlace puede estar vencido o no existe.'}</p>
            <Button asChild>
              <Link to="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && survey) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-2xl font-semibold">¡Gracias por participar!</h1>
              <p className="text-muted-foreground">
                Tu respuesta ya alimenta los tableros en tiempo real con segmentación demográfica y territorial. Compartí la encuesta para que más personas se sumen y podamos medir tendencias de manera instantánea.
              </p>
            </div>
            <PublicSurveyShareActions survey={survey} submission={lastSubmission} />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link to="/">Ir al sitio principal</Link>
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Volver a la encuesta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-10">
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
  );
};

export default PublicSurveyPage;
