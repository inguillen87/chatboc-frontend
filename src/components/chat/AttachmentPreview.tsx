import React from 'react';
import {
  File as FileIcon, // Renamed to avoid conflict with native File
  FileDown,
  FileSpreadsheet,
  FileText,
  MapPin,
  FileArchive,
  FileAudio,
  FileVideo,
  FileCode,
  FileImage,
  Presentation, // Replaced FilePresentation
  FileJson2, // Added (Lucide has FileJson2)
  FileQuestion, // Added for 'other'
  Download, // Added for explicit download button if needed elsewhere
} from 'lucide-react';
import type { AttachmentInfo, AttachmentType } from '@/utils/attachment';
import sanitizeMessageHtml from '@/utils/sanitizeMessageHtml';
import { Message } from '@/types/chat'; // Import Message type
import { formatFileSize } from '@/utils/files'; // Importar formatFileSize

interface Props {
  // message prop is preferred to pass all necessary info
  message: Message;
  // attachmentInfo is derived in ChatMessageBase and passed here for clarity
  attachmentInfo: AttachmentInfo | null;
  fallbackText?: string; // Texto a mostrar si no hay adjunto válido para renderizar
}

const AttachmentPreview: React.FC<Props> = ({ message, attachmentInfo, fallbackText }) => {
  // Acceder a locationData de forma segura, message puede no estar siempre si solo se pasa attachmentInfo (aunque el plan es pasar message)
  const locationData = message?.locationData;

  // Log para depuración
  if (attachmentInfo) {
    console.log("AttachmentPreview attachmentInfo:", attachmentInfo);
  }

  // --- Lógica para ubicación ---
  if (locationData && typeof locationData.lat === 'number' && typeof locationData.lon === 'number') {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lon}`;
    return (
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-500 underline hover:opacity-80 font-medium"
      >
        <MapPin className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <span>{locationData.name || locationData.address || 'Ver Ubicación en Mapa'}</span>
      </a>
    );
  }

  // --- Lógica para archivos adjuntos ---
  if (attachmentInfo && attachmentInfo.url) {
    const { url, name: filename, type: attachmentType, size } = attachmentInfo;

    // Si es una imagen, muestra la imagen directamente
    if (attachmentType === 'image') {
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {fallbackText && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1 text-xs"
                dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(fallbackText) }}
            />
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity block">
            <img
              src={url}
              alt={filename}
              className="max-w-[260px] sm:max-w-xs md:max-w-sm max-h-[200px] sm:max-h-[250px] object-contain rounded-lg border border-border cursor-pointer shadow-md bg-muted"
            />
          </a>
          <a
            href={url}
            download={filename}
            className="text-xs text-muted-foreground hover:underline break-all flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded hover:bg-muted"
            title={`Descargar ${filename} ${formatFileSize(size)}`}
          >
            <Download className="w-3 h-3 flex-shrink-0" />
            <span>{filename}</span>
            {formatFileSize(size) && <span className="text-xs opacity-70 ml-1">{formatFileSize(size)}</span>}
          </a>
        </div>
      );
    }

    // Vista previa para Audio
    if (attachmentType === 'audio') {
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {fallbackText && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1"
                dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(fallbackText) }}
            />
          )}
          <audio controls src={url} className="w-full max-w-xs rounded">
            Tu navegador no soporta el elemento de audio.
          </audio>
          <a
            href={url}
            download={filename}
            className="text-xs text-muted-foreground hover:underline break-all flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded hover:bg-muted"
            title={`Descargar ${filename} ${formatFileSize(size)}`}
          >
            <Download className="w-3 h-3 flex-shrink-0" />
            <span>{filename}</span>
            {formatFileSize(size) && <span className="text-xs opacity-70 ml-1">{formatFileSize(size)}</span>}
          </a>
        </div>
      );
    }

    // Vista previa para Video
    if (attachmentType === 'video') {
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {fallbackText && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1"
                dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(fallbackText) }}
            />
          )}
          <video controls src={url} className="w-full max-w-xs sm:max-w-sm max-h-[250px] rounded border border-border bg-muted">
            Tu navegador no soporta el elemento de video.
          </video>
          <a
            href={url}
            download={filename}
            className="text-xs text-muted-foreground hover:underline break-all flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded hover:bg-muted"
            title={`Descargar ${filename} ${formatFileSize(size)}`}
          >
            <Download className="w-3 h-3 flex-shrink-0" />
            <span>{filename}</span>
            {formatFileSize(size) && <span className="text-xs opacity-70 ml-1">{formatFileSize(size)}</span>}
          </a>
        </div>
      );
    }

    // Para otros tipos de archivo (que no sean imagen, audio, video), mostrar icono, nombre y botón de descarga
    let IconComponent: React.ElementType = FileQuestion; // Default para 'other'

    switch (attachmentType) {
      case 'pdf':
        IconComponent = FileText;
        break;
      case 'spreadsheet':
        IconComponent = FileSpreadsheet;
        break;
      case 'document':
        IconComponent = FileText;
        break;
      case 'presentation':
        IconComponent = Presentation; // Replaced FilePresentation
        break;
      case 'archive':
        IconComponent = FileArchive;
        break;
      // Los casos 'audio' y 'video' no deberían llegar aquí si tienen previews.
      // Se dejan por si acaso el attachmentType es audio/video pero no se pudo generar preview.
      case 'audio':
        IconComponent = FileAudio;
        break;
      case 'video':
        IconComponent = FileVideo;
        break;
      case 'text':
        IconComponent = FileText;
        break;
      case 'code':
        IconComponent = FileCode;
        break;
      case 'json':
        IconComponent = FileJson2;
        break;
      default: // 'other' o tipos no manejados explícitamente arriba
        IconComponent = FileQuestion;
    }

    const fileSizeDisplay = formatFileSize(size);

    return (
      <div className="py-1">
        {fallbackText && (
            <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-2"
                dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(fallbackText) }}
            />
        )}
        <a
          href={url}
          download={filename}
          className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/80 transition-colors group border border-border min-w-[200px] max-w-full"
          title={`Descargar ${filename} ${fileSizeDisplay}`}
        >
          <IconComponent className={`w-7 h-7 flex-shrink-0 text-primary opacity-80 group-hover:opacity-100`} />
          <div className="flex-grow overflow-hidden">
            <span className="block text-sm font-medium text-foreground truncate group-hover:text-primary">
              {filename}
            </span>
            {fileSizeDisplay && <span className="text-xs text-muted-foreground">{fileSizeDisplay}</span>}
          </div>
          <Download className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary flex-shrink-0" />
        </a>
      </div>
    );
  }

  // Si no hay mediaUrl ni locationData ni attachmentInfo, muestra el texto original del mensaje
  if (fallbackText) {
    const sanitizedFallbackHtml = sanitizeMessageHtml(fallbackText);
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
        dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
      />
    );
  }

  return null; // No renderizar nada si no hay información relevante
};

export default AttachmentPreview;
