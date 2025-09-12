import React, { useState } from 'react';
import { CardContent } from '@/components/ui/card';
import type { Attachment } from '@/types/tickets';
import { deriveAttachmentInfo } from '@/utils/attachment';
import { Paperclip } from 'lucide-react';

interface Props {
  attachments: Attachment[];
}

const TicketAttachments: React.FC<Props> = ({ attachments }) => {
  const processed = attachments.map((att) => ({
    data: att,
    info: deriveAttachmentInfo(
      att.url,
      att.filename || att.url.split('/').pop() || 'archivo_adj',
      att.mime_type,
      att.size,
      att.thumbUrl || att.thumb_url
    ),
  }));

  const images = processed.filter((p) => p.info.type === 'image');
  const others = processed.filter((p) => p.info.type !== 'image');
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  if (!images.length && !others.length) return null;

  return (
    <CardContent className="p-4 border-t">
      <h4 className="font-semibold mb-2">Adjuntos</h4>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {images.map(({ data, info }) => (
            <button
              key={data.id}
              onClick={() => setOpenUrl(data.url)}
              className="relative group aspect-video overflow-hidden rounded-lg border"
              aria-label="Abrir imagen adjunta"
            >
              <img
                src={info.thumbUrl || data.thumbUrl || data.thumb_url || data.url}
                alt={info.name || 'Adjunto'}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1">
          {others.map(({ data, info }) => (
            <li key={data.id}>
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
              >
                <Paperclip className="h-4 w-4" />
                <span>{info.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {openUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpenUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={openUrl}
            alt="Adjunto ampliado"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
          />
        </div>
      )}
    </CardContent>
  );
};

export default TicketAttachments;

