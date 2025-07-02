// src/components/chat/AttachmentPreview.tsx
import React from 'react';
import {
  File as FileIcon,
  FileDown,
  FileSpreadsheet,
  FileText,
  MapPin,
  FileArchive,
  FileAudio,
  FileVideo,
  FileCode,
  FileImage,
  Presentation, // Corrected icon name
  FileJson2,
  FileQuestion,
  Download,
} from 'lucide-react';
import type { AttachmentInfo } from '@/utils/attachment'; 
import sanitizeMessageHtml from '@/utils/sanitizeMessageHtml';
import { Message } from '@/types/chat';
import { formatFileSize } from '@/utils/files';

interface Props {
  message: Message; 
  attachmentInfo: AttachmentInfo | null;
  fallbackText?: string; 
}

const AttachmentPreview: React.FC<Props> = ({ message, attachmentInfo, fallbackText }) => {
  const locationData = message?.locationData;

  // Log para depuración de lo que recibe AttachmentPreview
  if (attachmentInfo) {
    console.log("AttachmentPreview: Received props with attachmentInfo:", attachmentInfo);
  } else if (fallbackText && !locationData) {
    // Solo loguea si no hay adjunto ni ubicación, para ver si solo es texto
    // console.log("AttachmentPreview: Received only fallbackText or message without relevant attachments.");
  }

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

  if (attachmentInfo && attachmentInfo.url) {
    const { url, name: filename, type: attachmentType, size } = attachmentInfo;
    // Sanear el fallbackText solo una vez si existe
    const sanitizedFallbackHtml = fallbackText ? sanitizeMessageHtml(fallbackText) : null;

    const renderDownloadLink = (displayText = filename, showIcon = false) => (
      <a
        href={url}
        download={filename}
        className="text-xs text-muted-foreground hover:underline break-all flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded hover:bg-muted"
        title={`Descargar ${filename} ${formatFileSize(size)}`}
      >
        {showIcon && <Download className="w-3 h-3 flex-shrink-0" />}
        <span>{displayText}</span>
        {formatFileSize(size) && <span className="text-xs opacity-70 ml-1">{formatFileSize(size)}</span>}
      </a>
    );

    if (attachmentType === 'image') {
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {sanitizedFallbackHtml && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1 text-xs"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity block">
            <img
              src={url} // La URL debe ser completa y accesible
              alt={filename}
              className="max-w-[260px] sm:max-w-xs md:max-w-sm max-h-[200px] sm:max-h-[250px] object-contain rounded-lg border border-border cursor-pointer shadow-md bg-muted"
            />
          </a>
          {renderDownloadLink(filename, true)}
        </div>
      );
    }
    
    if (attachmentType === 'audio') {
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {sanitizedFallbackHtml && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
          )}
          <audio controls src={url} className="w-full max-w-xs rounded">
            Tu navegador no soporta el elemento de audio.
          </audio>
          {renderDownloadLink()}
        </div>
      );
    }

    if (attachmentType === 'video') {
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {sanitizedFallbackHtml && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
          )}
          <video controls src={url} className="w-full max-w-xs sm:max-w-sm max-h-[250px] rounded border border-border bg-muted">
            Tu navegador no soporta el elemento de video.
          </video>
          {renderDownloadLink()}
        </div>
      );
    }

    let IconComponent: React.ElementType = FileQuestion;
    switch (attachmentType) {
      case 'pdf': IconComponent = FileText; break;
      case 'spreadsheet': IconComponent = FileSpreadsheet; break;
      case 'document': IconComponent = FileText; break;
      case 'presentation': IconComponent = Presentation; break;
      case 'archive': IconComponent = FileArchive; break;
      case 'audio': IconComponent = FileAudio; break; 
      case 'video': IconComponent = FileVideo; break; 
      case 'text': IconComponent = FileText; break;
      case 'code': IconComponent = FileCode; break;
      case 'json': IconComponent = FileJson2; break;
      default: IconComponent = FileQuestion;
    }
    
    const fileSizeDisplay = formatFileSize(size);
    return (
      <div className="py-1">
        {sanitizedFallbackHtml && (
            <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-2"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
        )}
        <a
          href={url} // La URL debe ser completa y accesible
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

  // Si solo hay fallbackText (y no es ubicación ni adjunto válido)
  if (fallbackText) {
    const sanitizedFallbackHtml = sanitizeMessageHtml(fallbackText);
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
        dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
      />
    );
  }

  return null;
};

export default AttachmentPreview;