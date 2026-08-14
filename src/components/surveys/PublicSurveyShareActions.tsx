import { useMemo } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  QrCode,
  Radio,
  ScanLine,
  Share2,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SurveyQrPreview } from '@/components/surveys/SurveyQrPreview';
import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import {
  getPublicSurveyCanonicalSlug,
  getPublicSurveyQrPageUrl,
  getPublicSurveyUrlFromRecord,
  getPublicSurveyWhatsAppShareUrl,
} from '@/utils/publicSurveyUrl';
import {
  AGE_RANGE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  type DemographicOption,
} from '@/components/surveys/demographicOptions';

interface PublicSurveyShareActionsProps {
  survey: SurveyPublic;
  submission?: PublicResponsePayload | null;
  tenantSlug?: string | null;
}

const labelForOption = (options: DemographicOption[], value?: string | null) => {
  if (!value) return undefined;
  return options.find((option) => option.value === value)?.label ?? value;
};

const buildLocationSummary = (submission?: PublicResponsePayload | null): string | undefined => {
  const location = submission?.metadata?.demographics?.ubicacion;
  if (!location) return undefined;

  const segments = [location.barrio, location.ciudad, location.provincia, location.pais]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => Boolean(part));

  if (!segments.length) {
    return undefined;
  }

  return segments.join(' · ');
};

const copyToClipboard = async (text: string) => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('[PublicSurveyShareActions] navigator.clipboard.writeText failed', error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch (error) {
    console.warn('[PublicSurveyShareActions] Fallback copy failed', error);
    return false;
  }
};

const openShareWindow = (url: string) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=640');
  } catch (error) {
    console.warn('[PublicSurveyShareActions] No se pudo abrir la ventana de compartir', error);
    window.location.href = url;
  }
};

const humanizeChannel = (value?: string | null) => {
  if (!value) return undefined;
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
};

export const PublicSurveyShareActions = ({
  survey,
  submission,
  tenantSlug: tenantSlugOverride,
}: PublicSurveyShareActionsProps) => {
  const tenantSlug =
    typeof tenantSlugOverride === 'string' && tenantSlugOverride.trim()
      ? tenantSlugOverride.trim()
      : typeof survey.tenant_slug === 'string' && survey.tenant_slug.trim()
        ? survey.tenant_slug.trim()
      : undefined;
  const canonicalSlug = getPublicSurveyCanonicalSlug(survey);
  const shareUrl = useMemo(
    () => getPublicSurveyUrlFromRecord(survey, { tenantSlug }),
    [survey, tenantSlug],
  );
  const shareText = useMemo(
    () =>
      `Participá de la encuesta “${survey.titulo}” y sumá tu voz a la toma de decisiones.`,
    [survey.titulo],
  );
  const qrPageUrl = useMemo(
    () => getPublicSurveyQrPageUrl(canonicalSlug, { tenantSlug }),
    [canonicalSlug, tenantSlug],
  );

  const whatsappUrl = useMemo(
    () => getPublicSurveyWhatsAppShareUrl(shareUrl, shareText),
    [shareText, shareUrl],
  );

  const socialTargets = useMemo(
    () => [
      {
        id: 'facebook',
        label: 'Facebook',
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      },
      {
        id: 'twitter',
        label: 'X (Twitter)',
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      },
      {
        id: 'telegram',
        label: 'Telegram',
        url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      },
    ],
    [shareText, shareUrl],
  );

  const analyticsHighlights = useMemo(() => {
    const highlights: string[] = [];
    const metadata = submission?.metadata;

    if (!metadata) {
      return highlights;
    }

    if (
      typeof metadata.answeredQuestions === 'number' &&
      typeof metadata.totalQuestions === 'number'
    ) {
      highlights.push(
        `Preguntas respondidas: ${metadata.answeredQuestions} de ${metadata.totalQuestions}.`,
      );
    }

    const canal = submission?.canal ?? metadata.canal;
    if (canal) {
      highlights.push(`Canal detectado: ${canal}.`);
    }

    if (submission?.utm_source) {
      highlights.push(
        submission.utm_campaign
          ? `UTM: ${submission.utm_source} · ${submission.utm_campaign}.`
          : `UTM: ${submission.utm_source}.`,
      );
    } else if (submission?.utm_campaign) {
      highlights.push(`UTM campaña: ${submission.utm_campaign}.`);
    }

    const demographics = metadata.demographics;
    if (demographics) {
      const rango = labelForOption(AGE_RANGE_OPTIONS, demographics.rangoEtario);
      if (rango) {
        highlights.push(`Rango etario: ${rango}.`);
      }

      const generoLabel = labelForOption(GENDER_OPTIONS, demographics.genero);
      if (generoLabel) {
        const custom = demographics.generoDescripcion;
        highlights.push(`Identidad de género: ${custom ? `${custom} (${generoLabel})` : generoLabel}.`);
      }

      const nivelEducativo = labelForOption(EDUCATION_LEVEL_OPTIONS, demographics.nivelEducativo);
      if (nivelEducativo) {
        highlights.push(`Nivel educativo: ${nivelEducativo}.`);
      }

      const situacionLaboral = labelForOption(
        EMPLOYMENT_STATUS_OPTIONS,
        demographics.situacionLaboral,
      );
      if (situacionLaboral) {
        highlights.push(`Situación laboral: ${situacionLaboral}.`);
      }

      if (demographics.ocupacion) {
        highlights.push(`Ocupación: ${demographics.ocupacion}.`);
      }

      if (demographics.tiempoResidencia) {
        highlights.push(`Tiempo de residencia: ${demographics.tiempoResidencia}.`);
      }

      const locationSummary = buildLocationSummary(submission);
      if (locationSummary) {
        highlights.push(`Ubicación declarada: ${locationSummary}.`);
      }

      if (demographics.ubicacion?.codigoPostal) {
        highlights.push(`Código postal: ${demographics.ubicacion.codigoPostal}.`);
      }

      if (
        typeof demographics.ubicacion?.lat === 'number' &&
        typeof demographics.ubicacion?.lng === 'number'
      ) {
        highlights.push(
          `Coordenadas GPS: ${demographics.ubicacion.lat.toFixed(4)}, ${demographics.ubicacion.lng.toFixed(4)}.`,
        );
      }

      if (demographics.ubicacion?.precision) {
        const precisionMap: Record<string, string> = {
          gps: 'GPS',
          manual: 'Manual',
          estimada: 'Estimada',
        };
        highlights.push(
          `Precisión de ubicación: ${
            precisionMap[demographics.ubicacion.precision] ?? demographics.ubicacion.precision
          }.`,
        );
      }
    }

    return highlights;
  }, [submission]);

  const distributionStatus = useMemo(() => {
    const isRealtime = Boolean(survey.es_votacion_envivo || survey.mostrar_resultados_envivo);
    const channel = humanizeChannel(submission?.canal ?? submission?.metadata?.canal);

    return [
      {
        id: 'status',
        icon: CheckCircle2,
        label: submission ? 'Respuesta registrada' : 'Link publico activo',
        detail: submission ? 'La participacion ya entro al tablero.' : 'Listo para copiar, publicar y medir.',
      },
      {
        id: 'realtime',
        icon: Radio,
        label: isRealtime ? 'Realtime encendido' : 'Realtime trazable',
        detail: isRealtime ? 'Resultados, QR y canales alimentan la lectura en vivo.' : 'UTM, canal y metadatos quedan listos para analytics.',
      },
      {
        id: 'qr',
        icon: ScanLine,
        label: 'QR para sala',
        detail: 'Pantalla completa para eventos, comercios o territorio.',
      },
      {
        id: 'share',
        icon: Share2,
        label: channel ? `Canal ${channel}` : 'Share multicanal',
        detail: 'WhatsApp, redes, link nativo y enlace directo.',
      },
    ];
  }, [submission, survey.es_votacion_envivo, survey.mostrar_resultados_envivo]);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      toast({
        title: 'Enlace copiado',
        description: 'Pegalo en redes sociales, WhatsApp o enviálo por email.',
      });
      return;
    }

    toast({
      title: 'No pudimos copiar el enlace',
      description: shareUrl,
      variant: 'destructive',
    });
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      await handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title: survey.titulo,
        text: shareText,
        url: shareUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.warn('[PublicSurveyShareActions] navigator.share falló', error);
      toast({
        title: 'No se pudo compartir automáticamente',
        description: 'Copiamos el enlace para que lo compartas manualmente.',
      });
      await handleCopyLink();
    }
  };

  return (
    <div className="w-full space-y-5 text-left">
      <div
        className="overflow-hidden rounded-xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_32%),linear-gradient(135deg,#ffffff,rgba(248,250,252,0.92))] shadow-sm"
        data-testid="public-survey-distribution-status"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Difusion operativa
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-normal text-foreground">
                QR, share y resultados listos para operar
              </h3>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {submission ? 'Sincronizado' : 'Preparado'}
          </span>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {distributionStatus.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="rounded-lg border border-slate-200/80 bg-white/80 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={handleCopyLink} className="min-w-[180px]">
          <Copy className="mr-2 h-4 w-4" /> Copiar enlace
        </Button>
        <Button variant="outline" asChild>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> Compartir por WhatsApp
          </a>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Share2 className="mr-2 h-4 w-4" /> Redes sociales
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {socialTargets.map((target) => (
              <DropdownMenuItem key={target.id} onSelect={() => openShareWindow(target.url)}>
                {target.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" onClick={handleNativeShare}>
          <Share2 className="mr-2 h-4 w-4" /> Compartir desde el dispositivo
        </Button>
      </div>
      <div className="grid w-full gap-4 md:grid-cols-2">
        <div className="flex h-full flex-col gap-3 rounded-lg border border-border/70 bg-background/90 p-4">
          <div className="flex items-center gap-2 text-left">
            <QrCode className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Código QR listo para difundir
            </span>
          </div>
          <SurveyQrPreview
            slug={canonicalSlug}
            title={survey.titulo}
            tenantSlug={tenantSlug}
            size={176}
            className="items-start"
          />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="break-all">
              Enlace directo:
              {' '}
              <code className="rounded bg-muted px-1 py-0.5">{shareUrl}</code>
            </p>
            <Button variant="outline" size="sm" asChild className="w-full">
              <a href={qrPageUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir QR en pantalla completa
              </a>
            </Button>
          </div>
        </div>
        <div className="flex h-full flex-col gap-3 rounded-lg border border-border/70 bg-background/90 p-4">
          <div className="flex items-center gap-2 text-left">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Analíticas capturadas
            </span>
          </div>
          {analyticsHighlights.length ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {analyticsHighlights.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              La respuesta se integró a los tableros en tiempo real con sus metadatos de difusión, demografía y ubicación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicSurveyShareActions;
