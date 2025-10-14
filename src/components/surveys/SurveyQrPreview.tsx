import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { getPublicSurveyUrl } from '@/utils/publicSurveyUrl';

interface SurveyQrPreviewProps {
  slug: string;
  title: string;
  remoteUrl?: string | null;
  size?: number;
  className?: string;
  imageClassName?: string;
}

export const SurveyQrPreview = ({
  slug,
  title,
  remoteUrl,
  size = 168,
  className,
  imageClassName,
}: SurveyQrPreviewProps) => {
  const [src, setSrc] = useState<string | null>(remoteUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const targetUrl = useMemo(() => getPublicSurveyUrl(slug) || '', [slug]);
  const fallbackQrUrl = useMemo(() => {
    if (!targetUrl) return '';
    const normalizedSize = Math.min(1024, Math.max(120, Math.round(size * 3)));
    return `https://quickchart.io/qr?size=${normalizedSize}&text=${encodeURIComponent(targetUrl)}`;
  }, [targetUrl, size]);

  const displaySize = useMemo(() => Math.max(96, Math.round(size)), [size]);
  const sharedStyle = useMemo(() => ({ width: displaySize, height: displaySize }), [displaySize]);
  const imageClasses = useMemo(
    () => cn('rounded-md border border-border bg-background p-2 object-contain', imageClassName),
    [imageClassName],
  );

  useEffect(() => {
    setUsedFallback(false);
    if (remoteUrl) {
      setSrc(remoteUrl);
      setError(null);
      return;
    }

    if (fallbackQrUrl) {
      setSrc(fallbackQrUrl);
      setUsedFallback(true);
      setError('Mostramos un QR alternativo generado automáticamente.');
    } else {
      setSrc(null);
      setError(null);
    }
  }, [remoteUrl, fallbackQrUrl]);

  const handleGenerateFallback = useCallback(() => {
    if (!targetUrl || !fallbackQrUrl) {
      return;
    }

    setSrc(fallbackQrUrl);
    setUsedFallback(true);
    setError('Mostramos un QR alternativo generado automáticamente.');
  }, [targetUrl, fallbackQrUrl]);

  const handleError = useCallback(() => {
    if (!usedFallback) {
      handleGenerateFallback();
      return;
    }

    setSrc(null);
    setError('No se pudo cargar el código QR automáticamente.');
  }, [handleGenerateFallback, usedFallback]);

  useEffect(() => {
    if (!remoteUrl && targetUrl && !usedFallback) {
      handleGenerateFallback();
    }
  }, [remoteUrl, targetUrl, usedFallback, handleGenerateFallback]);

  if (!targetUrl) {
    return null;
  }

  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', className)}>
      {src ? (
        <img
          src={src}
          alt={`Código QR para participar de ${title}`}
          className={imageClasses}
          style={sharedStyle}
          loading="lazy"
          onError={handleError}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] text-muted-foreground"
          style={sharedStyle}
        >
          No disponible
        </div>
      )}
      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
    </div>
  );
};

export default SurveyQrPreview;
