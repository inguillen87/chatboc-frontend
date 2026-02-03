import { apiFetch } from '@/utils/api';
import { PreviewValue } from '@/utils/catalogPreview';

export interface ImportPreview {
  total_detected: number;
  confidence: number;
  warnings: string[];
  items_preview: Array<Record<string, PreviewValue>>;
  columns?: string[];
}

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

    const resolvePreviewRows = (): Array<Record<string, PreviewValue>> => {
      if (Array.isArray(response.items_preview)) {
        return response.items_preview;
      }

      if (Array.isArray(response.records)) {
        return response.records;
      }

      if (!Array.isArray(response.rows)) {
        return [];
      }

      if (Array.isArray(response.columns) && response.columns.length > 0 && Array.isArray(response.rows[0])) {
        return response.rows.map((row: PreviewValue[], rowIndex: number) => {
          const record: Record<string, PreviewValue> = {};
          response.columns.forEach((column: string, columnIndex: number) => {
            const key = column || `col_${columnIndex + 1}`;
            record[key] = row[columnIndex];
          });
          record._rowIndex = rowIndex;
          return record;
        });
      }

      return response.rows;
    };

    const previewRows = resolvePreviewRows();
    const previewColumns = Array.isArray(response.columns)
      ? response.columns
      : previewRows.length > 0
        ? Object.keys(previewRows[0])
        : undefined;

    // Transform backend response to ImportPreview format expected by UI
    return {
        total_detected: response.total_detected || response.totalRows || previewRows.length || 0,
        confidence: response.confidence ?? response.metadata?.confidence ?? 0,
        warnings: response.warnings || response.metadata?.warnings || [],
        items_preview: previewRows,
        columns: previewColumns,
        // We might not get an upload_id here if it's stateless, but if we do, pass it.
        // If stateless, we might need to re-upload in commit step.
        upload_id: response.upload_id || Date.now() // temporary ID if stateless
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
    previewItems?: Array<Record<string, PreviewValue>>
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
