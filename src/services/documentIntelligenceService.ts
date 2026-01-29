import { apiFetch } from '@/utils/api';

export interface DocumentPreviewOptions {
  hasHeaders: boolean;
  skipRows: number;
  sheetName?: string;
  delimiter?: string;
  useAi?: boolean;
  locale?: string;
  aiProvider?: string;
  fallbackProviders?: string[];
}

export interface DocumentPreviewMetadata {
  sourceType?: string;
  detectedDelimiter?: string;
  sheetNames?: string[];
  pageCount?: number;
  totalRows?: number;
  engine?: string;
  confidence?: number;
  warnings?: string[];
  summary?: string;
}

export interface DocumentPreviewResponse {
  columns: string[];
  records: Array<Record<string, unknown>>;
  summary?: string;
  warnings?: string[];
  metadata?: DocumentPreviewMetadata;
  jobId?: string;
}

export interface DocumentPreviewRequest {
  entityId: string | number;
  entityType?: 'pymes' | 'municipal';
  file: File;
  options: DocumentPreviewOptions;
}

/**
 * Sends a document to the backend so it can run AI-assisted parsing (OpenAI, etc.)
 * and return a normalized preview that the UI can use to suggest column mappings.
 */
export async function requestDocumentPreview({
  entityId,
  entityType = 'pymes',
  file,
  options,
}: DocumentPreviewRequest): Promise<DocumentPreviewResponse> {
  if (!entityId) {
    throw new Error('El identificador de la organización es obligatorio para analizar documentos.');
  }

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('options', JSON.stringify(options));

  return apiFetch<DocumentPreviewResponse>(`/${entityType}/${entityId}/document-intelligence/preview`, {
    method: 'POST',
    body: formData,
  });
}
