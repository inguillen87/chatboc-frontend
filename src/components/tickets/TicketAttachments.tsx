import React, { useState } from 'react';
import { CardContent } from '@/components/ui/card';
import type { Attachment } from '@/types/tickets';
import {
  deriveAttachmentInfoFromPayload,
  getAttachmentSecurityLabel,
  isAllowedAttachmentType,
} from '@/utils/attachment';
import { ExternalLink, LockKeyhole, Paperclip, ShieldCheck, X } from 'lucide-react';

interface Props {
  attachments: Attachment[];
}

const TicketAttachments: React.FC<Props> = ({ attachments }) => {
  const processed = attachments
    .map((att) => {
      const info = deriveAttachmentInfoFromPayload(att, att.filename || 'archivo_adj');
      if (!info) return null;
      return {
        data: att,
        info,
        deliveryUrl: info.url,
        previewUrl: info.thumbUrl || info.url,
        securityLabel: info.securityLabel || getAttachmentSecurityLabel(att),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const allowed = processed.filter((p) => isAllowedAttachmentType(p.info));
  const disallowed = processed.filter((p) => !isAllowedAttachmentType(p.info));
  const images = allowed.filter((p) => p.info.type === 'image');
  const others = allowed.filter((p) => p.info.type !== 'image');
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (!openUrl) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenUrl(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openUrl]);

  if (!images.length && !others.length && !disallowed.length) return null;

  return (
    <CardContent className="p-4 border-t">
      <h4 className="font-semibold mb-2">Adjuntos</h4>
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {images.map(({ data, info, deliveryUrl, previewUrl, securityLabel }) => (
            <button
              key={`${data.id}-${info.url}`}
              onClick={() => {
                setOpenUrl(deliveryUrl);
              }}
              className="relative group aspect-video overflow-hidden rounded-lg border"
              aria-label="Abrir imagen adjunta"
            >
              <img
                src={previewUrl}
                alt={info.name || 'Adjunto'}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              {securityLabel ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white shadow">
                  {info.isPrivate ? (
                    <LockKeyhole className="h-3 w-3" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                  {securityLabel}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1">
          {others.map(({ data, info, deliveryUrl, securityLabel }, index) => (
            <li key={`${data.id}-${info.url}-${index}`}>
              <a
                href={deliveryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[8px] border bg-muted/20 px-2 py-1.5 text-sm text-primary hover:bg-muted/40"
              >
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{info.name}</span>
                {securityLabel ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {info.isPrivate ? (
                      <LockKeyhole className="h-3 w-3" />
                    ) : (
                      <ShieldCheck className="h-3 w-3" />
                    )}
                    {securityLabel}
                  </span>
                ) : null}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {disallowed.length > 0 && (
        <p className="text-xs text-destructive mt-2">
          Algunos archivos no se muestran por tipo no permitido.
        </p>
      )}
      {openUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpenUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <img
              src={openUrl}
              alt="Adjunto ampliado"
              className="max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              onClick={() => setOpenUrl(null)}
              className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-1 hover:bg-black/80 focus:outline-none"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </CardContent>
  );
};

export default TicketAttachments;
