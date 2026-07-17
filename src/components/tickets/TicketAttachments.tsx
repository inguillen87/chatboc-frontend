import React, { useState } from 'react';
import { CardContent } from '@/components/ui/card';
import type { Attachment } from '@/types/tickets';
import {
  deriveAttachmentInfoFromPayload,
  getAttachmentSecurityLabel,
  isAllowedAttachmentType,
} from '@/utils/attachment';
import { ExternalLink, FileText, Image as ImageIcon, LockKeyhole, Paperclip, ShieldCheck, X } from 'lucide-react';

interface Props {
  attachments: Attachment[];
}

const formatFileSize = (value?: number) => {
  if (!value || value <= 0) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const sourceLabel = (attachment: Attachment) => {
  const source = String(attachment.origin || attachment.source || '').toLowerCase();
  if (source === 'whatsapp_flow') return 'WhatsApp Flow';
  if (source.includes('whatsapp')) return 'WhatsApp';
  if (source === 'public_tracking') return 'Portal ciudadano';
  if (source === 'claim_attachment') return 'Carga inicial';
  return null;
};

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
        sourceLabel: sourceLabel(att),
        sizeLabel: formatFileSize(info.size),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const allowed = processed.filter((p) => isAllowedAttachmentType(p.info));
  const disallowed = processed.filter((p) => !isAllowedAttachmentType(p.info));
  const images = allowed.filter((p) => p.info.type === 'image');
  const others = allowed.filter((p) => p.info.type !== 'image');
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [openName, setOpenName] = useState('Adjunto');
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!openUrl) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenUrl(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [openUrl]);

  if (!images.length && !others.length && !disallowed.length) return null;

  return (
    <CardContent className="border-t p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <h4 className="font-semibold">Evidencia</h4>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {allowed.length} {allowed.length === 1 ? 'archivo' : 'archivos'}
        </span>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {images.map(({ data, info, deliveryUrl, previewUrl, securityLabel, sourceLabel: originLabel }) => (
            <button
              key={`${data.id}-${info.url}`}
              onClick={() => {
                setOpenName(info.name || 'Adjunto');
                setOpenUrl(deliveryUrl);
              }}
              className="group relative aspect-video overflow-hidden rounded-lg border bg-muted/20 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Abrir ${info.name || 'imagen adjunta'}`}
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
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/70 px-2 py-1.5 text-[11px] text-white">
                <ImageIcon className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{info.name}</span>
                {originLabel ? <span className="shrink-0 text-white/75">{originLabel}</span> : null}
              </span>
            </button>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1">
          {others.map(({ data, info, deliveryUrl, securityLabel, sourceLabel: originLabel, sizeLabel }, index) => (
            <li key={`${data.id}-${info.url}-${index}`}>
              <a
                href={deliveryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-[8px] border bg-muted/20 px-3 py-2.5 text-sm hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{info.name}</span>
                  {(originLabel || sizeLabel) ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[originLabel, sizeLabel].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </span>
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
          aria-label={`Vista ampliada de ${openName}`}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <img
              src={openUrl}
              alt={openName}
              className="max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              onClick={() => setOpenUrl(null)}
              ref={closeButtonRef}
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
