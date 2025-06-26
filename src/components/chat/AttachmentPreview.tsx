import React from 'react'
import { File, FileDown, FileSpreadsheet, FileText, MapPin } from 'lucide-react'
import type { AttachmentInfo } from '@/utils/attachment'

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

    if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      // Si es una imagen, muestra la imagen directamente
      return (
        <div className="flex flex-col items-start gap-1">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt={filename}
              className="max-w-[260px] rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer shadow-md"
            />
          </a>
          <span className="text-xs text-gray-600 dark:text-gray-400 break-all">{filename}</span>
        </div>
      );
    } else if (extension === 'pdf') {
      IconComponent = FileText;
    } else if (extension && ['xls', 'xlsx', 'csv'].includes(extension)) {
      IconComponent = FileSpreadsheet;
    } else {
      IconComponent = File; // Default para otros tipos de archivos
    }

    return (
      <a
        href={url}
        download
        className="flex items-center gap-2 text-blue-500 underline hover:opacity-80 font-medium"
      >
        <IconComponent className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <span className="break-all">{filename}</span>
        <FileDown className="w-4 h-4 ml-1" />
      </a>
    );
  }

  // Si no hay mediaUrl ni locationData, muestra el texto original del mensaje
  if (fallbackText) {
    // Asegurarse de sanear el fallbackText también
    const sanitizedFallbackHtml = DOMPurify.sanitize(fallbackText);
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
