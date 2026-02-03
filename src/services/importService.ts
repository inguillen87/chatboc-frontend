import { apiFetch } from '@/utils/api';

export interface PreviewColumn {
  key: string;
  label: string;
}

export interface ImportPreview {
  total_detected: number;
  confidence: number;
  warnings: string[];
  items_preview: Array<Record<string, unknown>>;
  columns?: PreviewColumn[];
}

const resolveColumnKey = (column: unknown, index: number): string => {
  if (typeof column === 'string' && column.trim().length > 0) {
    return column;
  }
  if (column && typeof column === 'object') {
    const record = column as Record<string, unknown>;
    const candidate = record.key ?? record.name ?? record.label;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return `col_${index + 1}`;
};

const resolveColumnLabel = (column: unknown, index: number, key: string): string => {
  if (column && typeof column === 'object') {
    const record = column as Record<string, unknown>;
    const candidate = record.name ?? record.label ?? record.key;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return key || `Col ${index + 1}`;
};

export const importService = {
  // Step 1: Upload & Preview (Document Intelligence)
  uploadFile: async (tenantId: number | null | undefined, file: File, processorSlug: string = 'generic', tenantSlug?: string): Promise<ImportPreview & { upload_id?: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    // Use generic ID 0 if tenantId is not resolved (e.g. initial setup) as per backend v2 specs
    const effectiveId = tenantId || 0;

    // Guide: POST /api/pymes/{pyme_id}/document-intelligence/preview
    // Response: { columns: [], rows: [], ... } which maps to ImportPreview
    const response = await apiFetch<any>(`/api/pymes/${effectiveId}/document-intelligence/preview`, {
      method: 'POST',
      body: formData,
      tenantSlug,
      omitEntityToken: true,
    });

    const resolvePreviewRows = (columns?: PreviewColumn[]): Array<Record<string, unknown>> => {
      if (Array.isArray(response.items_preview)) {
        return response.items_preview;
      }

      if (Array.isArray(response.records)) {
        return response.records;
      }

      if (!Array.isArray(response.rows)) {
        return [];
      }

      if (Array.isArray(response.columns) && response.columns.length > 0 && columns && columns.length > 0) {
        return response.rows.map((row: unknown) => {
          if (!Array.isArray(row)) {
            return row as Record<string, unknown>;
          }
          return columns.reduce<Record<string, unknown>>((acc, column: PreviewColumn, index: number) => {
            const key = column.key || resolveColumnKey(column, index);
            acc[key] = row[index];
            return acc;
          }, {});
        });
      }

      return response.rows as Array<Record<string, unknown>>;
    };

    const previewColumns = Array.isArray(response.columns)
      ? response.columns.map((column: unknown, index: number) => {
          const key = resolveColumnKey(column, index);
          return {
            key,
            label: resolveColumnLabel(column, index, key),
          };
        })
      : undefined;
    const previewRows = resolvePreviewRows(previewColumns);

    // Transform backend response to ImportPreview format expected by UI
    return {
        total_detected: response.total_detected || response.totalRows || previewRows.length || 0,
        confidence: response.confidence ?? response.metadata?.confidence ?? 0,
        warnings: response.warnings || response.metadata?.warnings || [],
        items_preview: previewRows,
        columns: previewColumns,
        // We might not get an upload_id here if it's stateless, but if we do, pass it.
        // If stateless, we might need to re-upload in commit step.
        upload_id: response.upload_id
    };
  },

  // Step 2: Confirm & Process (Commit)
  // Guide: POST /api/pymes/{pyme_id}/catalog-upload/subir_catalogo
  // Request Body: file (again?), processor
  // Note: If the backend is stateless (preview didn't save file), we need the file again.
  // The UI (ImportWizard) holds the file, so we can pass it here.
  commitImport: async (
    tenantId: number,
    file: File,
    processorSlug: string = 'generic',
    tenantSlug?: string,
    previewItems?: Array<Record<string, unknown>>
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('processor', processorSlug);
    if (previewItems && previewItems.length > 0) {
      formData.append('items_preview', JSON.stringify(previewItems));
    }

    const response = await apiFetch<any>(`/api/pymes/${tenantId}/catalog-upload/subir_catalogo`, {
      method: 'POST',
      body: formData,
      tenantSlug,
      omitEntityToken: true,
    });
    return response; // { message, items_count, upload_id }
  },

  // Deprecated/Unused in new stateless flow, kept for compatibility if needed
  getPreview: async (uploadId: number, tenantSlug?: string): Promise<ImportPreview> => {
     return { total_detected: 0, confidence: 0, warnings: [], items_preview: [] };
  }
};
