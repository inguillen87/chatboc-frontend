import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { SurveyForm } from '@/components/surveys/SurveyForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import type { PublicResponsePayload } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { ApiError } from '@/utils/api';

const PublicSurveyPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const { survey, isLoading, error, submit, isSubmitting, submitError } = useSurveyPublic(slug);

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

  const handleSubmit = async (payload: PublicResponsePayload) => {
    try {
      await submit({ ...payload, ...metadata });
      setSubmitted(true);
      toast({ title: '¡Gracias por participar!', description: 'Tu aporte se registró correctamente.' });
    } catch (err) {
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
  };

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

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <h1 className="text-2xl font-semibold">¡Gracias por participar!</h1>
            <p className="text-muted-foreground max-w-md">
              Tu opinión se sumó a este proceso de participación activa. Podés compartir el enlace con otras personas para que también se expresen.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link to="/">Ir al sitio principal</Link>
              </Button>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
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
      <SurveyForm survey={survey} onSubmit={handleSubmit} loading={isSubmitting} defaultMetadata={metadata} />
    </div>
  );
};

export default PublicSurveyPage;
