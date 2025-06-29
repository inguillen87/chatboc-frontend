export type AttachmentType =
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'document' // Para doc, docx
  | 'presentation' // Para ppt, pptx
  | 'archive' // Para zip, rar
  | 'audio'
  | 'video'
  | 'text' // Para txt, md
  | 'code' // Para varios lenguajes de programación
  | 'json'
  | 'other';

export interface AttachmentInfo {
  url: string;
  type: AttachmentType;
  extension: string;
  name: string;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];
const PDF_EXTS = ['pdf'];
const SPREADSHEET_EXTS = ['xls', 'xlsx', 'csv'];
const DOCUMENT_EXTS = ['doc', 'docx'];
const PRESENTATION_EXTS = ['ppt', 'pptx'];
const ARCHIVE_EXTS = ['zip', 'rar', 'tar', 'gz', '7z'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const TEXT_EXTS = ['txt', 'md'];
const CODE_EXTS = ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'go', 'rb', 'php', 'sh', 'cs', 'swift', 'kt'];
const JSON_EXTS = ['json', 'yml', 'yaml'];


export function getAttachmentInfo(textOrUrl: string): AttachmentInfo | null {
  try {
    // Intentar extraer la extensión de la URL o del texto si es un nombre de archivo
    let ext = '';
    const nameParts = textOrUrl.split('/').pop()?.split(/[?#]/)[0]?.split('.');
    if (nameParts && nameParts.length > 1) {
      ext = nameParts.pop()?.toLowerCase() || '';
    }

    if (!ext) { // Si no se pudo obtener extensión de la URL (ej. URL sin extensión), no podemos determinar tipo
        // Podríamos intentar adivinar por el contenido si tuviéramos el archivo, pero aquí solo tenemos texto/URL
        // Devolver 'other' o null si no hay extensión es una opción. Por ahora, si no hay ext, no es un archivo parseable aquí.
        // O si el `textOrUrl` no parece una URL para nada.
        if (!textOrUrl.includes('/') && !textOrUrl.includes('.')) return null; // No parece ni url ni filename
        // Si es una URL pero sin extensión detectable, la tratamos como 'other' si es una URL válida.
        // Esta heurística es simple, podría mejorarse.
        if (textOrUrl.startsWith('http://') || textOrUrl.startsWith('https://')) {
            const guessedName = textOrUrl.split('/').pop()?.split(/[?#]/)[0] || 'archivo_desconocido';
            return { url: textOrUrl, type: 'other', extension: '', name: guessedName };
        }
        return null; // No se puede determinar la extensión de forma fiable.
    }

    const name = textOrUrl.split('/').pop()?.split(/[?#]/)[0] || `archivo.${ext}`;

    if (IMAGE_EXTS.includes(ext)) return { url: textOrUrl, type: 'image', extension: ext, name };
    if (PDF_EXTS.includes(ext)) return { url: textOrUrl, type: 'pdf', extension: ext, name };
    if (SPREADSHEET_EXTS.includes(ext)) return { url: textOrUrl, type: 'spreadsheet', extension: ext, name };
    if (DOCUMENT_EXTS.includes(ext)) return { url: textOrUrl, type: 'document', extension: ext, name };
    if (PRESENTATION_EXTS.includes(ext)) return { url: textOrUrl, type: 'presentation', extension: ext, name };
    if (ARCHIVE_EXTS.includes(ext)) return { url: textOrUrl, type: 'archive', extension: ext, name };
    if (AUDIO_EXTS.includes(ext)) return { url: textOrUrl, type: 'audio', extension: ext, name };
    if (VIDEO_EXTS.includes(ext)) return { url: textOrUrl, type: 'video', extension: ext, name };
    if (TEXT_EXTS.includes(ext)) return { url: textOrUrl, type: 'text', extension: ext, name };
    if (CODE_EXTS.includes(ext)) return { url: textOrUrl, type: 'code', extension: ext, name };
    if (JSON_EXTS.includes(ext)) return { url: textOrUrl, type: 'json', extension: ext, name };

    return { url: textOrUrl, type: 'other', extension: ext, name };
  } catch (e) {
    console.error("Error en getAttachmentInfo:", e);
    return null;
  }
}
