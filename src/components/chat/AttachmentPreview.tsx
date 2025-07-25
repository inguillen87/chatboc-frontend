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
  Presentation, // Replaced FilePresentation
  FileJson2, // Added (Lucide has FileJson2)
  FileQuestion, // Added for 'other'
  Download, // Added for explicit download button if needed elsewhere
  Loader2, // For uploading indicator
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
  // Acceder a locationData de forma segura, message puede no estar siempre si solo se pasa attachmentInfo (aunque el plan es pasar message)
  const locationData = message?.locationData;

  // Log para depuración
  if (attachmentInfo) {
    console.log("AttachmentPreview attachmentInfo:", attachmentInfo);
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
    const { url, name: filename, type: attachmentType, size, isUploading } = attachmentInfo;
    // Sanear el fallbackText solo una vez si existe
    const sanitizedFallbackHtml = fallbackText ? sanitizeMessageHtml(fallbackText) : null;

    const renderDownloadLink = (displayText = filename, showIcon = false) => (
      <a
        href={isUploading ? '#' : url} // Don't allow download if uploading
        download={isUploading ? undefined : filename}
        onClick={isUploading ? (e) => e.preventDefault() : undefined}
        className={cn(
          "text-xs text-muted-foreground hover:underline break-all flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded hover:bg-muted",
          isUploading && "opacity-50 cursor-default"
        )}
        title={isUploading ? "Archivo subiendo..." : `Descargar ${filename} ${formatFileSize(size)}`}
      >
        {showIcon && !isUploading && <Download className="w-3 h-3 flex-shrink-0" />}
        {isUploading && <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin mr-1" />}
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
          <a
            href={isUploading ? '#' : url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={isUploading ? (e) => e.preventDefault() : undefined}
            className={cn("hover:opacity-80 transition-opacity block relative", isUploading && "cursor-default opacity-60")}
          >
            <img
              src={url} // La URL debe ser completa y accesible
              alt={filename}
              className="max-w-[260px] sm:max-w-xs md:max-w-sm max-h-[200px] sm:max-h-[250px] object-contain rounded-lg border border-border shadow-md bg-muted"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </a>
          {renderDownloadLink(filename, !isUploading)} {/* Show download icon only if not uploading */}
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
          <div className={cn("relative w-full max-w-xs", isUploading && "opacity-60")}>
            <audio controls src={url} className="w-full rounded" disabled={isUploading}>
              Tu navegador no soporta el elemento de audio.
            </audio>
            {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded">
                    <Loader2 className="w-5 h-5 text-foreground animate-spin" />
                </div>
            )}
          </div>
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
          <div className={cn("relative w-full max-w-xs sm:max-w-sm max-h-[250px]", isUploading && "opacity-60")}>
            <video controls src={url} className="w-full max-h-[250px] rounded border border-border bg-muted" muted={isUploading} playsInline={isUploading}>
              Tu navegador no soporta el elemento de video.
            </video>
            {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
            )}
          </div>
          {renderDownloadLink()}
        </div>
      );
    }

    // Generic file types
    let IconComponent: React.ElementType = FileQuestion;
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
        {sanitizedFallbackHtml && (
            <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-2"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
        )}
        <a
          href={isUploading ? '#' : url}
          download={isUploading ? undefined : filename}
          onClick={isUploading ? (e) => e.preventDefault() : undefined}
          className={cn(
            "flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/80 transition-colors group border border-border min-w-[200px] max-w-full",
            isUploading && "opacity-60 cursor-default"
          )}
          title={isUploading ? "Archivo subiendo..." : `Descargar ${filename} ${fileSizeDisplay}`}
        >
          {isUploading
            ? <Loader2 className={`w-7 h-7 flex-shrink-0 text-primary opacity-80 group-hover:opacity-100 animate-spin`} />
            : <IconComponent className={`w-7 h-7 flex-shrink-0 text-primary opacity-80 group-hover:opacity-100`} />
          }
          <div className="flex-grow overflow-hidden">
            <span className="block text-sm font-medium text-foreground truncate group-hover:text-primary">
              {filename}
            </span>
            {fileSizeDisplay && <span className="text-xs text-muted-foreground">{fileSizeDisplay}</span>}
          </div>
          {!isUploading && <Download className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary flex-shrink-0" />}
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