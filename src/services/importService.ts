import { apiFetch } from '@/utils/api';

export interface PreviewColumn {
  key: string;
  label: string;
}

export interface ImportPreview {
  total_detected: number;
  confidence: number;
  warnings: string[];
  errors?: string[];
  error_details?: Array<{ message: string; action?: string; code?: string }>;
  status?: string;
  ui?: {
    engine?: {
      label?: string;
      value?: string;
    };
    sidebar?: {
      title?: string;
      items?: Array<{ label: string; value: string }>;
    };
    summary?: Array<{ label: string; value: string }>;
  };
  items_preview: Array<Record<string, unknown>>;
  columns?: PreviewColumn[];
}

export interface CommitPayload {
  columns: string[];
  rows: Array<Array<unknown>>;
  catalogUploadId?: number;
  rubro?: string;
  replaceCatalog?: boolean;
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
  uploadFile: async (
    tenantId: number | null | undefined,
    file: File,
    processorSlug: string = 'generic',
    tenantSlug?: string,
    rubroSlug?: string,
    catalogUploadId?: number,
    maxPages?: number
  ): Promise<ImportPreview & { upload_id?: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (processorSlug) {
      formData.append('processor', processorSlug);
    }
    if (rubroSlug) {
      formData.append('rubro', rubroSlug);
    }
    if (typeof catalogUploadId === 'number') {
      formData.append('catalogUploadId', String(catalogUploadId));
    }
    if (typeof maxPages === 'number') {
      formData.append('maxPages', String(maxPages));
    }

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

    if (response?.ok === false) {
      const detail =
        response?.detail ||
        response?.error ||
        (Array.isArray(response?.errors) ? response.errors.join(' ') : '');
      throw new Error(detail);
    }

    const errorDetails = Array.isArray(response?.errors)
      ? response.errors
          .map((error: unknown) => {
            if (typeof error === 'string') {
              return { message: error };
            }
            if (error && typeof error === 'object') {
              const record = error as Record<string, unknown>;
              const message = typeof record.message === 'string' ? record.message : '';
              const action = typeof record.action === 'string' ? record.action : undefined;
              const code = typeof record.code === 'string' ? record.code : undefined;
              if (message) {
                return { message, action, code };
              }
            }
            return null;
          })
          .filter((detail): detail is { message: string; action?: string; code?: string } => Boolean(detail))
      : [];
    const normalizedErrors = errorDetails.map((detail) => detail.message);

    const hasAnyData =
      Array.isArray(response?.items_preview) ||
      Array.isArray(response?.records) ||
      Array.isArray(response?.rows);

    if (!hasAnyData && normalizedErrors.length === 0 && response?.status !== 'failed') {
      const detail =
        response?.detail ||
        response?.error ||
        (Array.isArray(response?.errors) ? response.errors.join(' ') : '');
      throw new Error(detail);
    }

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
    const previewRows = hasAnyData ? resolvePreviewRows(previewColumns) : [];

    // Transform backend response to ImportPreview format expected by UI
    return {
      total_detected: response.total_detected || response.totalRows || previewRows.length || 0,
      confidence: response.confidence ?? response.metadata?.confidence ?? 0,
      warnings: response.warnings || response.metadata?.warnings || [],
      errors: normalizedErrors.length > 0 ? normalizedErrors : response.metadata?.errors,
      error_details: errorDetails.length > 0 ? errorDetails : response.metadata?.errors,
      status: response.status,
      ui: response.ui || response.metadata?.ui,
      items_preview: previewRows,
      columns: previewColumns,
      // We might not get an upload_id here if it's stateless, but if we do, pass it.
      // If stateless, we might need to re-upload in commit step.
      upload_id: response.upload_id,
    };
  },

  // Step 2: Confirm & Process (Commit)
  // Guide: POST /api/pymes/{pyme_id}/catalog-upload/subir_catalogo
  // Request Body: file (again?), processor
  // Note: If the backend is stateless (preview didn't save file), we need the file again.
  // The UI (ImportWizard) holds the file, so we can pass it here.
  commitImport: async (
    tenantId: number,
    previewColumns: PreviewColumn[] | undefined,
    previewItems: Array<Record<string, unknown>>,
    tenantSlug?: string,
    catalogUploadId?: number,
    rubro?: string,
    replaceCatalog: boolean = true
  ) => {
    const columns = (previewColumns ?? []).map((column) => column.label);
    const rows = previewItems.map((item) =>
      (previewColumns ?? []).map((column) => item[column.key])
    );

    const payload: CommitPayload = {
      columns,
      rows,
      catalogUploadId,
      rubro,
      replaceCatalog,
    };

    const response = await apiFetch<any>(`/api/pymes/${tenantId}/document-intelligence/commit`, {
      method: 'POST',
      body: JSON.stringify(payload),
      tenantSlug,
      omitEntityToken: true,
    });
    return response;
  },

  // Deprecated/Unused in new stateless flow, kept for compatibility if needed
  getPreview: async (uploadId: number, tenantSlug?: string): Promise<ImportPreview> => {
    return { total_detected: 0, confidence: 0, warnings: [], items_preview: [] };
  }
};
