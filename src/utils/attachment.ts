export type AttachmentType =
  | 'image'
  | 'pdf'
  | 'spreadsheet' // xls, xlsx, csv
  | 'document'    // doc, docx, txt
  | 'presentation'// ppt, pptx
  | 'archive'     // zip, rar (con precaución)
  | 'audio'       // mp3, wav, ogg
  | 'video'       // mp4, mov, webm
  | 'text'        // txt, md (si no se clasifica como 'document')
  | 'code'        // js, py, html, etc. (generalmente no para descarga directa amigable)
  | 'json'
  | 'other';       // Tipo por defecto o desconocido

export interface AttachmentInfo {
  url: string;
  type: AttachmentType;
  extension: string;
  name: string;
  mimeType?: string; // Añadido para que la función pueda usarlo
  size?: number; // Añadido
}

// --- Listas Blancas ---
// Priorizar MIME types cuando estén disponibles y sean fiables.
// Extensiones como fallback o para UI.

const ALLOWED_MIME_TYPES: Record<string, AttachmentType> = {
  // Imágenes
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image', // SVG es imagen, pero cuidado con XSS si se renderiza inline sin sanitizar
  // Documentos
  'application/pdf': 'pdf',
  'application/msword': 'document', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document', // .docx
  'application/vnd.ms-excel': 'spreadsheet', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet', // .xlsx
  'text/csv': 'spreadsheet', // .csv
  'text/plain': 'text', // .txt
  'application/rtf': 'document',
  // Presentaciones
  'application/vnd.ms-powerpoint': 'presentation', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation', // .pptx
  // Audio
  'audio/mpeg': 'audio', // .mp3
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/aac': 'audio',
  'audio/mp4': 'audio', // m4a es audio/mp4
  // Video (considerar límites de tamaño/duración en otro lado)
  'video/mp4': 'video',
  'video/quicktime': 'video', // .mov
  'video/webm': 'video',
  'video/x-msvideo': 'video', // .avi
  // Archivos (usar con precaución - podrían no estar en la lista de "descarga amigable" por defecto)
  // 'application/zip': 'archive',
  // 'application/vnd.rar': 'archive',
  // 'application/x-tar': 'archive',
  // 'application/gzip': 'archive',
};

const ALLOWED_EXTENSIONS: Record<string, AttachmentType> = {
  // Imágenes
  'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image', 'avif': 'image',
  // Documentos
  'pdf': 'pdf',
  'doc': 'document', 'docx': 'document',
  'xls': 'spreadsheet', 'xlsx': 'spreadsheet', 'csv': 'spreadsheet',
  'txt': 'text', 'md': 'text', 'rtf': 'document',
  // Presentaciones
  'ppt': 'presentation', 'pptx': 'presentation',
  // Audio
  'mp3': 'audio', 'wav': 'audio', 'ogg': 'audio', 'aac': 'audio', 'm4a': 'audio',
  // Video
  'mp4': 'video', 'mov': 'video', 'webm': 'video', 'avi': 'video', 'mkv': 'video',
  // Otros que podrían ser seguros para mostrar como link de descarga
  // 'zip': 'archive', 'rar': 'archive',
};

// Lista negra de extensiones (para una capa extra de seguridad si mimeType no es concluyente o es genérico)
const DENIED_EXTENSIONS = [
  'exe', 'msi', 'bat', 'sh', 'com', 'cmd', 'scr', 'jar', 'js', 'vbs', 'ps1', 'dll', 'so', 'app', 'dmg',
  // Extensiones que podrían ser código y no se quieren como descarga directa simple:
  // 'html', 'css', 'php', 'py', 'rb', (a menos que se traten específicamente como 'code' y se muestren diferente)
];


/**
 * Determina el AttachmentType y la información relevante de un archivo.
 * Prioriza el mimeType proporcionado por el backend.
 * Usa la extensión del nombre del archivo como fallback.
 * No intenta "adivinar" a partir de URLs genéricas si no hay mimeType o extensión clara.
 */
export function deriveAttachmentInfo(
  url: string,
  name: string,
  mimeType?: string,
  size?: number
): AttachmentInfo {
  const fallbackName = name || url.split('/').pop()?.split(/[?#]/)[0] || 'archivo_desconocido';
  const extension = (fallbackName.includes('.') ? fallbackName.split('.').pop()?.toLowerCase() : '') || '';

  let type: AttachmentType = 'other';

  // 1. Validar por MIME Type (si se proporciona y es confiable)
  if (mimeType) {
    const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim(); // Normalizar y quitar parámetros como charset
    if (ALLOWED_MIME_TYPES[normalizedMimeType]) {
      type = ALLOWED_MIME_TYPES[normalizedMimeType];
    } else if (normalizedMimeType === 'application/octet-stream' || normalizedMimeType === 'binary/octet-stream') {
      // Si es octet-stream, dependemos de la extensión
      if (extension && ALLOWED_EXTENSIONS[extension]) {
        type = ALLOWED_EXTENSIONS[extension];
      }
    }
    // Si el mimeType no está en ALLOWED_MIME_TYPES y no es octet-stream, se queda como 'other' por defecto.
  } else if (extension) {
    // 2. Si no hay mimeType, intentar por extensión
    if (ALLOWED_EXTENSIONS[extension]) {
      type = ALLOWED_EXTENSIONS[extension];
    }
  }

  // 3. Chequeo final contra extensiones denegadas (si type sigue siendo 'other' o si queremos doble chequeo)
  if (DENIED_EXTENSIONS.includes(extension)) {
    type = 'other'; // Forzar a 'other' si la extensión está explícitamente denegada.
  }

  return {
    url,
    name: fallbackName,
    mimeType: mimeType || 'application/octet-stream', // Default a octet-stream si no se provee
    type,
    extension,
    size
  };
}


/**
 * Valida si un tipo de adjunto (basado en AttachmentInfo procesada)
 * es seguro y permitido para mostrar como descarga/preview amigable.
 */
export function isAllowedAttachmentType(attachment: AttachmentInfo | null): boolean {
  if (!attachment) return false;

  // Si la extensión está en la lista de DENIED_EXTENSIONS, no es permitido.
  if (attachment.extension && DENIED_EXTENSIONS.includes(attachment.extension)) {
    return false;
  }

  // Si el tipo derivado es 'other' Y la extensión no es vacía (lo que significa que no es una URL sin extensión),
  // podría ser un tipo no reconocido pero no necesariamente peligroso.
  // Aquí decidimos si 'other' con extensión es permitido o no.
  // Por ahora, si es 'other' pero tiene una extensión que no está en DENIED_EXTENSIONS, lo permitimos.
  // Si es 'other' y no tiene extensión (ej. URL rara), no lo permitimos como descarga amigable.
  if (attachment.type === 'other') {
    return !!attachment.extension; // Permitir 'other' solo si tiene alguna extensión (y no está denegada)
  }

  // Para todos los demás tipos específicos (image, pdf, document, etc.) que fueron asignados
  // por `deriveAttachmentInfo` porque estaban en ALLOWED_MIME_TYPES o ALLOWED_EXTENSIONS,
  // se consideran permitidos.
  return true;
}


// La función original getAttachmentInfo ahora se considera deprecada o para uso interno
// si se necesita parsear URLs crudas, pero el flujo principal debería usar `deriveAttachmentInfo`
// con datos del backend.
const IMAGE_EXTS_OLD = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];
const PDF_EXTS_OLD = ['pdf'];
// ... (mantener las otras listas de EXTS_OLD si getAttachmentInfo se mantiene por alguna razón)

export function getAttachmentInfo(textOrUrl: string): AttachmentInfo | null {
  // Esta función ahora debería considerarse con precaución.
  // Es mejor que el backend provea mimeType y nombre.
  try {
    let ext = '';
    const nameParts = textOrUrl.split('/').pop()?.split(/[?#]/)[0]?.split('.');
    if (nameParts && nameParts.length > 1) {
      ext = nameParts.pop()?.toLowerCase() || '';
    }

    // Si no hay extensión clara, y no es una URL absoluta, no podemos hacer mucho.
    if (!ext && !(textOrUrl.startsWith('http://') || textOrUrl.startsWith('https://'))) {
        return null;
    }

    const name = textOrUrl.split('/').pop()?.split(/[?#]/)[0] || `archivo_desconocido${ext ? '.'+ext : ''}`;

    // Usar la nueva lógica de derivación si es posible, aunque aquí no tenemos mimeType
    const derivedInfo = deriveAttachmentInfo(textOrUrl, name, undefined);

    // La función original `getAttachmentInfo` no tenía un `mimeType` de entrada,
    // por lo que `deriveAttachmentInfo` dependerá de la extensión.
    // Si `deriveAttachmentInfo` devuelve type 'other' y no hay extensión, significa que
    // era una URL sin extensión, lo cual es aceptable para `getAttachmentInfo` si es una URL.
    if (derivedInfo.type === 'other' && !derivedInfo.extension && (textOrUrl.startsWith('http://') || textOrUrl.startsWith('https://'))) {
        // Es una URL sin extensión, `deriveAttachmentInfo` la marcó como 'other'.
        // `getAttachmentInfo` puede devolver esto.
        return derivedInfo;
    } else if (derivedInfo.type !== 'other') {
        // `deriveAttachmentInfo` pudo determinar un tipo específico basado en la extensión.
        return derivedInfo;
    }

    // Si `deriveAttachmentInfo` devolvió 'other' con una extensión, también es válido.
    if (derivedInfo.type === 'other' && derivedInfo.extension) {
      return derivedInfo;
    }


    return null; // No se pudo determinar de forma fiable.

  } catch (e) {
    // console.error("Error en getAttachmentInfo (legacy):", e);
    return null;
  }
}
