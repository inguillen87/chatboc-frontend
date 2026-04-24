// src/components/chat/AttachmentPreview.tsx
import React, { Suspense } from 'react';
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
  Presentation,
  FileJson2,
  FileQuestion,
  Download,
  Loader2,
} from 'lucide-react';
import type { AttachmentInfo } from '@/utils/attachment';
import sanitizeMessageHtml from '@/utils/sanitizeMessageHtml';
import { Message } from '@/types/chat';
import { formatFileSize } from '@/utils/files';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Lazy load MapLibreMap to avoid heavy bundle on initial load
const MapLibreMap = React.lazy(() => import('@/components/MapLibreMap'));

interface Props {
  message: Message; 
  attachmentInfo: AttachmentInfo | null;
  fallbackText?: string; 
}

const AttachmentPreview: React.FC<Props> = ({ message, attachmentInfo, fallbackText }) => {
  const locationData = message?.locationData;

  if (locationData && typeof locationData.lat === 'number' && typeof locationData.lon === 'number') {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lon}`;

    return (
      <div className="w-full max-w-[280px] rounded-xl overflow-hidden border border-border shadow-sm bg-card my-1">
        <div className="h-32 w-full relative bg-muted">
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
             <MapLibreMap
                center={[locationData.lon, locationData.lat]}
                marker={[locationData.lon, locationData.lat]}
                initialZoom={14}
                className="w-full h-full"
                showHeatmap={false}
             />
          </Suspense>
        </div>
        <div className="p-3 bg-card">
            {locationData.address && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {locationData.address}
                </p>
            )}
            <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-2"
                onClick={() => window.open(googleMapsUrl, '_blank')}
            >
                <MapPin className="w-3 h-3" />
                Cómo llegar
            </Button>
        </div>
      </div>
    );
  }

  if (attachmentInfo && attachmentInfo.url) {
    const { url, name: filename, type: attachmentType, size, isUploading } = attachmentInfo;
    const sanitizedFallbackHtml = fallbackText ? sanitizeMessageHtml(fallbackText) : null;

    const renderDownloadLink = (displayText = filename, showIcon = false) => (
      <a
        href={isUploading ? '#' : url}
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
      const imgSrc = attachmentInfo.thumbUrl || url;
      return (
        <div className="flex flex-col items-start gap-1 my-1">
          {sanitizedFallbackHtml && (
             <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-1 text-xs"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
          )}
          <Dialog>
            <DialogTrigger asChild>
              <button
                disabled={isUploading}
                className={cn("hover:opacity-80 transition-opacity block relative", isUploading && "cursor-default opacity-60")}
              >
                <img
                  src={imgSrc}
                  alt={filename}
                  className="max-w-[260px] sm:max-w-xs md:max-w-sm max-h-[200px] sm:max-h-[250px] object-cover rounded-lg border border-border shadow-md bg-muted"
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{filename}</DialogTitle>
                <DialogDescription>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    Ver original
                  </a>
                </DialogDescription>
              </DialogHeader>
              <img src={url} alt={filename} className="w-full h-full object-contain" />
            </DialogContent>
          </Dialog>
          {renderDownloadLink(filename, !isUploading)}
        </div>
      );
    }

    if (attachmentType === 'pdf') {
      return (
        <div className="py-1">
          {sanitizedFallbackHtml && (
            <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 mb-2"
                dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
            />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted border border-border"
          >
            {attachmentInfo.thumbUrl && (
              <img src={attachmentInfo.thumbUrl} alt={`Previsualización de ${filename}`} className="w-20 h-24 object-cover rounded-md bg-white" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold">{filename}</span>
              <span className="text-sm text-muted-foreground">PDF</span>
              {formatFileSize(size) && <span className="text-xs text-muted-foreground mt-1">{formatFileSize(size)}</span>}
            </div>
          </a>
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

    let IconComponent: React.ElementType = FileQuestion;
    switch (attachmentType) {
      case 'spreadsheet':
        IconComponent = FileSpreadsheet;
        break;
      case 'document':
        IconComponent = FileText;
        break;
      case 'presentation':
        IconComponent = Presentation;
        break;
      case 'archive':
        IconComponent = FileArchive;
        break;
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
      default:
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
