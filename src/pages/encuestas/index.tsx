import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Bot, CalendarDays, Copy, Download, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { listPublicSurveys } from '@/api/encuestas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/api';
import type { PublicSurveyListResult } from '@/api/encuestas';
import type { SurveyPublic, SurveyTipo } from '@/types/encuestas';
import { getPublicSurveyQrPageUrl, getPublicSurveyQrUrl, getPublicSurveyUrl } from '@/utils/publicSurveyUrl';
import { SurveyQrPreview } from '@/components/surveys/SurveyQrPreview';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePageMetadata } from '@/hooks/usePageMetadata';
import {
  buildSurveyDigestMessage,
  buildSurveyShareMessage,
  buildWidgetUrlWithChannel,
  getSurveyChannelAssets,
  getSurveyGeneralImage,
  shortenUrlForDisplay,
  sortAndFilterActiveSurveys,
} from '@/utils/surveyDigest';

const TIPO_LABELS: Record<SurveyTipo, string> = {
  opinion: 'Opinión',
  votacion: 'Votación',
  sondeo: 'Sondeo',
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d 'de' MMMM yyyy", { locale: es });
};

const getStatus = (survey: SurveyPublic) => {
  const now = new Date();
  const start = survey.inicio_at ? new Date(survey.inicio_at) : null;
  const end = survey.fin_at ? new Date(survey.fin_at) : null;

  if (start && Number.isNaN(start.getTime())) {
    return { label: 'Disponible', variant: 'secondary' as const };
  }
  if (end && Number.isNaN(end.getTime())) {
    return { label: 'Disponible', variant: 'secondary' as const };
  }

  if (start && now < start) {
    return { label: 'Próximamente', variant: 'secondary' as const };
  }

  if (end && now > end) {
    return { label: 'Finalizada', variant: 'outline' as const };
  }

  return { label: 'En curso', variant: 'default' as const };
};

const SurveysPublicIndex = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery<PublicSurveyListResult>({
    queryKey: ['public-surveys'],
    queryFn: () => listPublicSurveys(),
    staleTime: 1000 * 60,
  });

  usePageMetadata({
    title: 'Encuestas ciudadanas | Chatboc',
    description: 'Respondé, compartí y descargá recursos para sumar más voces a los procesos participativos.',
    image: '/images/og-encuestas.svg',
  });

  const hasBadPayload = Boolean(data && (data as any).__badPayload);
  const fallbackNotice =
    data && typeof (data as any).__fallbackNotice === 'string'
      ? (data as any).__fallbackNotice
      : null;
  const surveys = Array.isArray(data) ? data : [];
  const rawPayload = hasBadPayload && typeof (data as any).__raw === 'string' ? (data as any).__raw : null;
  const statusCode = hasBadPayload && typeof (data as any).__status === 'number' ? (data as any).__status : null;
  const showRawFallback = hasBadPayload && !surveys.length;

  const summary = useMemo(() => {
    const now = new Date();
    return surveys.reduce(
      (acc, survey) => {
        const start = survey.inicio_at ? new Date(survey.inicio_at) : null;
        const end = survey.fin_at ? new Date(survey.fin_at) : null;
        if (start && Number.isNaN(start.getTime())) {
          return acc;
        }
        if (end && Number.isNaN(end.getTime())) {
          return acc;
        }
        if (end && now > end) {
          acc.finished += 1;
        } else if (start && now < start) {
          acc.upcoming += 1;
        } else {
          acc.active += 1;
        }
        return acc;
      },
      { active: 0, upcoming: 0, finished: 0 },
    );
  }, [surveys]);

  const activeSurveys = useMemo(() => sortAndFilterActiveSurveys(surveys), [surveys]);
  const latestSurveys = useMemo(() => activeSurveys.slice(0, 10), [activeSurveys]);

  const primarySurvey = latestSurveys[0];
  const widgetAssets = useMemo(() => getSurveyChannelAssets(primarySurvey, 'widget_chat'), [primarySurvey]);
  const whatsappAssets = useMemo(() => getSurveyChannelAssets(primarySurvey, 'whatsapp'), [primarySurvey]);
  const heroImage = useMemo(
    () => getSurveyGeneralImage(primarySurvey, 'widget_chat') ?? getSurveyGeneralImage(primarySurvey, 'whatsapp'),
    [primarySurvey],
  );

  const digestHeaderTitle = whatsappAssets.title ?? widgetAssets.title ?? 'Participación Ciudadana';
  const digestHeaderDescription =
    whatsappAssets.description ?? widgetAssets.description ?? 'Últimas encuestas disponibles (máximo 10).';

  const aggregatedDigest = useMemo(
    () =>
      buildSurveyDigestMessage({
        surveys: latestSurveys,
        channel: 'whatsapp',
        headerTitle: digestHeaderTitle,
        headerDescription: digestHeaderDescription,
        includeHeaderImage: true,
        fallbackImageUrl: heroImage ?? null,
      }),
    [latestSurveys, digestHeaderTitle, digestHeaderDescription, heroImage],
  );

  const aggregatedShareMessage = latestSurveys.length ? aggregatedDigest.message : null;
  const aggregatedImageUrl = latestSurveys.length ? aggregatedDigest.imageUrl : null;

  const heroVisual = useMemo(
    () => heroImage ?? aggregatedImageUrl ?? '/images/og-encuestas.svg',
    [aggregatedImageUrl, heroImage],
  );
  const heroAlt = heroImage || aggregatedImageUrl
    ? 'Imagen destacada de la campaña de participación ciudadana'
    : 'Ilustración con tarjetas y gráficos sobre participación ciudadana';

  const handleShareDigestOnWhatsApp = () => {
    if (!aggregatedShareMessage) return;
    const url = `https://wa.me/?text=${encodeURIComponent(aggregatedShareMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyDigest = async () => {
    if (!aggregatedShareMessage) return;
    try {
      await navigator.clipboard.writeText(aggregatedShareMessage);
      toast({
        title: 'Resumen copiado',
        description: 'Pegalo en WhatsApp, email o redes para difundir las últimas encuestas.',
      });
    } catch (copyError) {
      toast({
        title: 'No se pudo copiar el resumen',
        description: String((copyError as Error)?.message ?? copyError),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">No pudimos cargar las encuestas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
            <Button onClick={() => refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showRawFallback) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">No pudimos cargar las encuestas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                El servidor devolvió un formato inesperado{statusCode ? ` (código ${statusCode})` : ''}. Intentá nuevamente en unos
                minutos.
              </p>
              {rawPayload ? (
                <div className="max-h-64 w-full overflow-auto rounded-md border bg-muted/40 p-3 text-left font-mono text-xs">
                  {rawPayload.split('\n').map((line, index) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('http')) {
                      return (
                        <div key={`${line}-${index}`} className="py-0.5">
                          <a
                            href={trimmed}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-primary underline"
                          >
                            {trimmed}
                          </a>
                        </div>
                      );
                    }
                    return (
                      <div key={`${line}-${index}`} className="whitespace-pre-wrap py-0.5">
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <Button onClick={() => refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!surveys.length) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">Por ahora no hay encuestas activas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-center text-sm text-muted-foreground">
            <p>Volvé más tarde para participar de las próximas instancias de consulta ciudadana.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {fallbackNotice ? (
        <Alert className="border-amber-500/40 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Mostrando enlaces recuperados</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{fallbackNotice}</p>
            {statusCode ? (
              <p className="text-xs opacity-80">Código devuelto por el servidor: {statusCode}</p>
            ) : null}
            {rawPayload ? (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Ver respuesta original</summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded border bg-background/60 p-2 text-foreground/90">
                  {rawPayload}
                </pre>
              </details>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-lg shadow-primary/5 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/30">
        <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
              Participación ciudadana inclusiva
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Encuestas ciudadanas
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Compartí encuestas, generá códigos QR accesibles y sumá canales de difusión para que más vecinas y vecinos puedan opinar.
            </p>
            <ul className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-primary/20 text-center text-xs font-semibold text-primary">1</span>
                <span>Copiá el enlace oficial para responder desde cualquier dispositivo.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-primary/20 text-center text-xs font-semibold text-primary">2</span>
                <span>Descargá o imprimí el código QR para espacios públicos o eventos.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-primary/20 text-center text-xs font-semibold text-primary">3</span>
                <span>Compartí el chat asistente para responder dudas en tiempo real.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-primary/20 text-center text-xs font-semibold text-primary">4</span>
                <span>Reenviá un resumen listo para WhatsApp o redes comunitarias.</span>
              </li>
            </ul>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="relative flex w-full max-w-sm items-center justify-center">
              <img
                src={heroVisual}
                alt={heroAlt}
                className="w-full rounded-2xl border border-white/60 shadow-xl shadow-primary/20 object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>
      <header className="space-y-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Conocé los procesos abiertos, respondé y compartí el enlace para sumar más voces.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">Activas: {summary.active}</span>
          <span className="rounded-full border px-3 py-1">Próximas: {summary.upcoming}</span>
          <span className="rounded-full border px-3 py-1">Finalizadas: {summary.finished}</span>
        </div>
      </header>

      {aggregatedShareMessage ? (
        <Card className="border-dashed border-primary/40 bg-primary/5 dark:bg-primary/10">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Compartir las últimas encuestas</p>
              <p className="text-xs text-muted-foreground">
                Generá un mensaje compacto con hasta 10 encuestas recientes listo para enviar por WhatsApp.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="inline-flex items-center gap-2" onClick={handleShareDigestOnWhatsApp}>
                <Share2 className="h-4 w-4" /> Enviar por WhatsApp
              </Button>
              <Button variant="outline" className="inline-flex items-center gap-2" onClick={handleCopyDigest}>
                <Copy className="h-4 w-4" /> Copiar resumen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {surveys.map((survey) => {
          const status = getStatus(survey);
          const inicio = formatDate(survey.inicio_at);
          const fin = formatDate(survey.fin_at);
          const rango = inicio && fin ? `${inicio} – ${fin}` : inicio || fin || null;

          const participationPath = getPublicSurveyUrl(survey.slug, { absolute: false }) || '#';
          const participationUrl = getPublicSurveyUrl(survey.slug) || '';
          const qrUrl = getPublicSurveyQrUrl(survey.slug, { size: 512 });
          const widgetUrl = participationUrl ? buildWidgetUrlWithChannel(participationUrl) : '';
          const whatsappShareMessage = participationUrl
            ? buildSurveyShareMessage(
                survey,
                {
                  participationUrl,
                  widgetUrl,
                  qrPageUrl,
                  qrUrl,
                },
                getSurveyChannelAssets(survey, 'whatsapp'),
              )
            : '';
          const qrPagePath = getPublicSurveyQrPageUrl(survey.slug, { absolute: false }) || '#';
          const qrPageUrl = getPublicSurveyQrPageUrl(survey.slug);

          const handleCopyLink = async () => {
            if (!participationUrl) return;
            try {
              await navigator.clipboard.writeText(participationUrl);
              toast({
                title: 'Enlace copiado',
                description: 'Pegalo en redes, mails o el chat para sumar más respuestas.',
              });
            } catch (error) {
              toast({
                title: 'No se pudo copiar',
                description: String((error as Error)?.message ?? error),
                variant: 'destructive',
              });
            }
          };

          const handleShareWhatsApp = () => {
            if (!participationUrl) return;
            const whatsappMessage = buildSurveyShareMessage(
              survey,
              {
                participationUrl,
                widgetUrl,
                qrPageUrl,
                qrUrl,
              },
              getSurveyChannelAssets(survey, 'whatsapp'),
            );
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
          };

          const handleCopyQrLink = async () => {
            if (!qrUrl) return;
            try {
              await navigator.clipboard.writeText(qrUrl);
              toast({
                title: 'Enlace del QR copiado',
                description: 'Pegalo donde quieras compartir la imagen del código.',
              });
            } catch (error) {
              toast({
                title: 'No se pudo copiar el enlace del QR',
                description: String((error as Error)?.message ?? error),
                variant: 'destructive',
              });
            }
          };

          return (
            <Card key={`${survey.slug}-${survey.id ?? survey.slug}`} className="overflow-hidden">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-semibold leading-tight">{survey.titulo}</CardTitle>
                    {survey.descripcion && (
                      <p className="text-sm text-muted-foreground">{survey.descripcion}</p>
                    )}
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="bg-transparent font-normal capitalize tracking-wide">
                    {TIPO_LABELS[survey.tipo] ?? survey.tipo}
                  </Badge>
                  {rango && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {rango}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 border-t bg-muted/30 px-6 py-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Compartí esta encuesta para ampliar la participación ciudadana.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="inline-flex items-center gap-2" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4" /> Copiar enlace
                      </Button>
                      <Button
                        variant="outline"
                        className="inline-flex items-center gap-2"
                        onClick={() => {
                          if (!widgetUrl) return;
                          navigator.clipboard
                            .writeText(widgetUrl)
                            .then(() => {
                              toast({
                                title: 'Enlace del asistente copiado',
                                description: 'Pegalo donde necesites para abrir el chat directo.',
                              });
                            })
                            .catch((widgetError) => {
                              console.warn('No se pudo copiar el enlace del widget', widgetError);
                              toast({
                                title: 'No se pudo copiar el enlace del asistente',
                                description: String((widgetError as Error)?.message ?? widgetError),
                                variant: 'destructive',
                              });
                            });
                        }}
                        disabled={!widgetUrl}
                      >
                        <Bot className="h-4 w-4" /> Copiar enlace del asistente
                      </Button>
                      <Button variant="outline" className="inline-flex items-center gap-2" onClick={handleShareWhatsApp}>
                        <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                      </Button>
                      {qrUrl ? (
                        <Button
                          variant="outline"
                          className="inline-flex items-center gap-2"
                          onClick={handleCopyQrLink}
                        >
                          <Share2 className="h-4 w-4" /> Copiar enlace del QR
                        </Button>
                      ) : null}
                      {qrPagePath !== '#' ? (
                        <Button variant="outline" className="inline-flex items-center gap-2" asChild>
                          <Link to={qrPagePath}>
                            <Download className="h-4 w-4" /> Ver QR ampliado
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid max-w-2xl gap-3 text-sm text-muted-foreground">
                      {participationUrl ? (
                        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            Enlace para responder
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Abrí este enlace para completar la encuesta desde cualquier dispositivo.
                          </p>
                          <a
                            href={participationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex max-w-full items-center gap-2 text-primary hover:underline"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            <span className="truncate">{shortenUrlForDisplay(participationUrl)}</span>
                          </a>
                        </div>
                      ) : null}
                      {widgetUrl ? (
                        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            Asistente virtual
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Accedé al chat automatizado que acompaña la difusión de la encuesta.
                          </p>
                          <a
                            href={widgetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex max-w-full items-center gap-2 text-primary hover:underline"
                          >
                            <Bot className="h-3.5 w-3.5" />
                            <span className="truncate">Abrir asistente virtual</span>
                          </a>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
                            {widgetUrl ? shortenUrlForDisplay(widgetUrl) : null}
                          </p>
                        </div>
                      ) : null}
                      {whatsappShareMessage ? (
                        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            Reenviar por WhatsApp
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Abrí un mensaje prearmado para compartir con grupos o contactos.
                          </p>
                          <button
                            type="button"
                            onClick={handleShareWhatsApp}
                            className="mt-2 inline-flex max-w-full items-center gap-2 text-left text-primary hover:underline"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span className="truncate">Abrir WhatsApp con el mensaje</span>
                          </button>
                        </div>
                      ) : null}
                      {qrPageUrl ? (
                        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            Código QR
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ideal para afiches, tótems o pantallas en espacios públicos.
                          </p>
                          <Link
                            to={qrPagePath}
                            className="mt-2 inline-flex max-w-full items-center gap-2 text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="truncate">Ver QR listo para descargar</span>
                          </Link>
                          {qrUrl ? (
                            <p className="mt-1 break-all text-[11px] text-muted-foreground/70">
                              {shortenUrlForDisplay(qrUrl)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 lg:w-56">
                    <SurveyQrPreview slug={survey.slug} title={survey.titulo} remoteUrl={qrUrl} />
                    {qrPagePath !== '#' ? (
                      <Button variant="secondary" size="sm" asChild className="w-full">
                        <Link to={qrPagePath} className="inline-flex items-center justify-center gap-2">
                          <Download className="h-4 w-4" /> Abrir QR en pantalla completa
                        </Link>
                      </Button>
                    ) : null}
                    {qrUrl ? (
                      <Button variant="ghost" size="sm" asChild className="w-full">
                        <a href={qrUrl} download>
                          <Download className="h-4 w-4" /> Descargar imagen QR
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild className="w-full">
                      <Link to={participationPath} className="inline-flex items-center justify-center gap-2">
                        Participar
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const SurveysPublicIndexWithErrorBoundary = () => (
  <ErrorBoundary fallbackTitle="No pudimos cargar las encuestas">
    <SurveysPublicIndex />
  </ErrorBoundary>
);

export default SurveysPublicIndexWithErrorBoundary;
