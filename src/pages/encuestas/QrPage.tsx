import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSurveyPublic } from '@/hooks/useSurveyPublic';
import { usePageMetadata } from '@/hooks/usePageMetadata';
import { getPublicSurveyQrUrl, getPublicSurveyUrl, isQuickchartQrUrl } from '@/utils/publicSurveyUrl';

const SurveyQrPage = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { survey, isLoading, error } = useSurveyPublic(slug);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const participationUrl = useMemo(() => getPublicSurveyUrl(slug) || '', [slug]);
  const directQrUrl = useMemo(() => getPublicSurveyQrUrl(slug, { size: 768 }), [slug]);
  const isDirectQuickchart = useMemo(() => isQuickchartQrUrl(directQrUrl), [directQrUrl]);
  const fallbackQrUrl = useMemo(() => {
    if (!participationUrl || isDirectQuickchart) return '';
    return `https://quickchart.io/qr?size=720&margin=12&text=${encodeURIComponent(participationUrl)}`;
  }, [participationUrl, isDirectQuickchart]);
  const normalizedTitle = survey?.titulo ?? 'Encuesta ciudadana';

  usePageMetadata({
    title: `Código QR · ${normalizedTitle}`,
    description:
      'Descargá y compartí el código QR oficial para difundir la encuesta en cartelería, eventos o redes.',
    image: '/images/og-encuestas.svg',
  });

  useEffect(() => {
    setImageError(null);
    if (directQrUrl) {
      setDisplayUrl(directQrUrl);
      setUsingFallback(false);
      return;
    }

    if (fallbackQrUrl) {
      setDisplayUrl(fallbackQrUrl);
      setUsingFallback(true);
      setImageError('Mostramos un QR alternativo generado automáticamente.');
    } else {
      setDisplayUrl(null);
      setUsingFallback(false);
    }
  }, [directQrUrl, fallbackQrUrl]);

  const handleImageError = () => {
    if (!usingFallback && fallbackQrUrl) {
      setDisplayUrl(fallbackQrUrl);
      setUsingFallback(true);
      setImageError('Mostramos un QR alternativo generado automáticamente.');
      return;
    }

    setDisplayUrl(null);
    setImageError('No pudimos cargar el código QR automáticamente.');
  };

  if (!slug) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-lg font-semibold">No encontramos la encuesta solicitada.</p>
            <Button asChild>
              <Link to="/encuestas">Volver al listado</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && !survey) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-lg font-semibold">No pudimos cargar la encuesta.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild>
              <Link to="/encuestas">Volver al listado</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-10">
      <div>
        <Link
          to={survey ? `/e/${survey.slug}` : '/encuestas'}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 bg-muted/40">
          <CardTitle className="text-2xl font-semibold">Código QR para “{normalizedTitle}”</CardTitle>
          <p className="text-sm text-muted-foreground">
            Descargá el QR en alta calidad para imprimirlo o compartirlo en pantallas. Incluimos también el enlace directo para
            pegarlo en redes o materiales gráficos.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 py-8">
          <div className="flex flex-col items-center gap-4">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={`Código QR de ${normalizedTitle}`}
                className="w-64 max-w-full rounded-xl border border-border bg-white p-6 shadow-sm"
                onError={handleImageError}
              />
            ) : (
              <div className="flex h-60 w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-center text-sm text-muted-foreground">
                No pudimos generar el código QR de manera automática.
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {displayUrl ? (
                <Button asChild>
                  <a href={displayUrl} download={`encuesta-${slug}-qr.png`}>
                    <Download className="h-4 w-4" /> Descargar imagen PNG
                  </a>
                </Button>
              ) : null}
              {participationUrl ? (
                <Button variant="outline" asChild>
                  <a href={participationUrl} target="_blank" rel="noreferrer">
                    Responder encuesta
                  </a>
                </Button>
              ) : null}
            </div>
            {imageError ? (
              <p className="text-sm text-muted-foreground">{imageError}</p>
            ) : null}
          </div>
          {directQrUrl && !isDirectQuickchart ? (
            <Alert className="border-primary/40 bg-primary/5 text-primary">
              <AlertTitle>¿Preferís el archivo original?</AlertTitle>
              <AlertDescription className="space-y-2 text-sm">
                <p>
                  Si tu backend tiene acceso al servicio de encuestas, podés descargar la imagen PNG directamente desde este enlace:
                </p>
                <a href={directQrUrl} className="break-all font-medium underline" target="_blank" rel="noreferrer">
                  {directQrUrl}
                </a>
              </AlertDescription>
            </Alert>
          ) : null}
          {participationUrl ? (
            <div className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Enlace para compartir</p>
              <p className="mt-2 break-all text-sm">{participationUrl}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default SurveyQrPage;
