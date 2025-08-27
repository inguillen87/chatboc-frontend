import React from 'react';
import {
  File, FileDown, FileSpreadsheet, FileText, MapPin,
  FileArchive, FileAudio, FileVideo, FileCode, FileImage, FileUp, FileType2, FileKey, FileLock, FileJson, FileTerminal
} from 'lucide-react'; // Añadir más iconos
import type { AttachmentInfo, AttachmentType } from '@/utils/attachment'; // Importar AttachmentType
import sanitizeMessageHtml from '@/utils/sanitizeMessageHtml';

interface Props {
  attachment?: AttachmentInfo
  mediaUrl?: string // URL del archivo adjunto (imagen, pdf, etc.)
  locationData?: { lat: number; lon: number } // Datos de ubicación
  fallbackText?: string // Texto a mostrar si no hay adjunto válido para renderizar
}

const AttachmentPreview: React.FC<Props> = ({ attachment, mediaUrl, locationData, fallbackText }) => {
  // --- Lógica para ubicación ---
  if (locationData && typeof locationData.lat === 'number' && typeof locationData.lon === 'number') {
    // CORREGIDO: Formato de URL para Google Maps
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${locationData.lat},${locationData.lon}`;
    return (
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-500 underline hover:opacity-80 font-medium"
      >
        <MapPin className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <span>Ver Ubicación en Mapa</span>
      </a>
    );
  }

  // --- Lógica para archivos adjuntos (imágenes, PDFs, otros) ---
  const url = attachment?.url || mediaUrl
  if (url) {
    const filename = attachment?.name || url.split('/').pop()?.split(/[?#]/)[0] || 'Archivo Adjunto'
    const extension = attachment?.extension || filename.split('.').pop()?.toLowerCase()

    let IconComponent: React.ElementType = File; // Icono por defecto
    let iconColorClass = "text-blue-600"; // Color por defecto

    // Priorizar attachment.type si existe y es útil, luego caer en la extensión
    const typeToUse = attachment?.type;
    const extensionToUse = extension || attachment?.extension;

    if (typeToUse === 'image' || (extensionToUse && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extensionToUse))) {
      // Si es una imagen, muestra la imagen directamente
      return (
        <div className="flex flex-col items-start gap-1">
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
            <img
              src={url}
              alt={filename}
              className="max-w-[260px] max-h-[200px] object-contain rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer shadow-md bg-gray-100 dark:bg-gray-800"
            />
          </a>
          <a href={url} download className="text-xs text-gray-600 dark:text-gray-400 hover:underline break-all flex items-center gap-1">
            <FileDown className="w-3 h-3 flex-shrink-0" />
            {filename}
          </a>
        </div>
      );
    } else if (typeToUse === 'pdf' || extensionToUse === 'pdf') {
      IconComponent = FileText;
      iconColorClass = "text-red-600";
    } else if (typeToUse === 'spreadsheet' || (extensionToUse && ['xls', 'xlsx', 'csv'].includes(extensionToUse))) {
      IconComponent = FileSpreadsheet;
      iconColorClass = "text-green-600";
    } else if (extensionToUse && ['doc', 'docx'].includes(extensionToUse)) {
      IconComponent = FileText; // FileType2 o un icono específico para Word si se prefiere
      iconColorClass = "text-blue-700";
    } else if (extensionToUse && ['ppt', 'pptx'].includes(extensionToUse)) {
      IconComponent = FileSpreadsheet; // FilePresentation o similar si existe y se importa
      iconColorClass = "text-orange-500";
    } else if (extensionToUse && ['zip', 'rar', 'tar', 'gz'].includes(extensionToUse)) {
      IconComponent = FileArchive;
      iconColorClass = "text-yellow-600";
    } else if (extensionToUse && ['mp3', 'wav', 'ogg', 'aac'].includes(extensionToUse)) {
      IconComponent = FileAudio;
      iconColorClass = "text-purple-600";
    } else if (extensionToUse && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extensionToUse)) {
      IconComponent = FileVideo;
      iconColorClass = "text-pink-600";
    } else if (extensionToUse && ['txt', 'md'].includes(extensionToUse)) {
      IconComponent = FileType2; // Un icono más específico para texto plano/markdown
      iconColorClass = "text-gray-600";
    } else if (extensionToUse && ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'go', 'rb', 'php', 'sh'].includes(extensionToUse)) {
      IconComponent = FileCode;
      iconColorClass = "text-indigo-600";
    } else if (extensionToUse && ['json', 'yml', 'yaml'].includes(extensionToUse)) {
      IconComponent = FileJson;
      iconColorClass = "text-teal-600";
    }
    // Se pueden añadir más 'else if' para otros tipos comunes
    // Por ejemplo, FileKey, FileLock, FileTerminal si son relevantes.
    // IconComponent = File; // Ya es el default

    return (
      <a
        href={url}
        download={filename} // Sugerir el nombre original para la descarga
        className="flex items-center gap-2 text-primary hover:underline font-medium group"
      >
        <IconComponent className={`w-6 h-6 flex-shrink-0 ${iconColorClass} transition-colors group-hover:opacity-80`} />
        <span className="break-all text-sm text-foreground group-hover:text-primary transition-colors">{filename}</span>
        {/* El icono de descarga se puede ocultar y mostrar al hacer hover si se prefiere, o mantenerlo visible */}
        <FileDown className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
      </a>
    );
  }

  // Si no hay mediaUrl ni locationData, muestra el texto original del mensaje
  if (fallbackText) {
    // Asegurarse de sanear el fallbackText también
    const sanitizedFallbackHtml = sanitizeMessageHtml(fallbackText);
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
        dangerouslySetInnerHTML={{ __html: sanitizedFallbackHtml }}
      />
    );
  }

  return null; // No renderizar nada si no hay información de adjunto ni texto
}

export default AttachmentPreview;
