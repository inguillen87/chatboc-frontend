import { apiFetch } from '@/utils/api';

export interface ImportPreview {
  total_detected: number;
  confidence: number;
  warnings: string[];
  items_preview: any[];
}

export const importService = {
  uploadFile: async (tenantId: number, file: File, processorSlug: string = 'generic', tenantSlug?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenant_id', tenantId.toString());
    formData.append('processor', processorSlug);

    // Using apiFetch which usually handles headers, but for FormData sometimes we need to be careful.
    // apiFetch typically expects JSON unless body is FormData.
    // Updated endpoint to match backend guide: POST /api/admin/catalog/import
    const response = await apiFetch<any>('/api/admin/catalog/import', {
      method: 'POST',
      body: formData,
      tenantSlug
      // Note: Do NOT set Content-Type header for FormData, browser does it with boundary.
    });
    return response; // Returns { upload_id, status }
  },

  getPreview: async (uploadId: number, tenantSlug?: string): Promise<ImportPreview> => {
    // Updated endpoint: GET /api/admin/catalog/import/{id} (implied or /preview suffix)
    // Guide says: GET /api/admin/catalog/import/{session_id} returns preview
    const response = await apiFetch<ImportPreview>(`/api/admin/catalog/import/${uploadId}`, {
        tenantSlug
    });
    return response;
  },

  commitImport: async (uploadId: number, overrides: any = {}, tenantSlug?: string) => {
    // Updated endpoint: POST /api/admin/catalog/import/{session_id}/commit
    const response = await apiFetch<any>(`/api/admin/catalog/import/${uploadId}/commit`, {
      method: 'POST',
      body: { overrides },
      tenantSlug
    });
    return response; // { created_count, status }
  }
};
