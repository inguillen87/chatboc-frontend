import { useMemo } from 'react';
import { Copy, ExternalLink, MessageCircle, QrCode, Share2, TrendingUp } from 'lucide-react';

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
import { getPublicSurveyQrPageUrl, getPublicSurveyUrl } from '@/utils/publicSurveyUrl';
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

export const PublicSurveyShareActions = ({ survey, submission }: PublicSurveyShareActionsProps) => {
  const shareUrl = useMemo(() => getPublicSurveyUrl(survey.slug), [survey.slug]);
  const shareText = useMemo(
    () =>
      `Participá de la encuesta “${survey.titulo}” y sumá tu voz a la toma de decisiones.`,
    [survey.titulo],
  );
  const qrPageUrl = useMemo(() => getPublicSurveyQrPageUrl(survey.slug), [survey.slug]);

  const whatsappUrl = useMemo(() => {
    const message = `${shareText}\n${shareUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [shareText, shareUrl]);

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
          <SurveyQrPreview slug={survey.slug} title={survey.titulo} size={176} className="items-start" />
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
