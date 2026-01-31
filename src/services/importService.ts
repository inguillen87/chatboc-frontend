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
    const response = await apiFetch<any>('/api/catalog/import/upload', {
      method: 'POST',
      body: formData,
      tenantSlug
      // Note: Do NOT set Content-Type header for FormData, browser does it with boundary.
    });
    return response; // Returns { upload_id, status }
  },

  getPreview: async (uploadId: number, tenantSlug?: string): Promise<ImportPreview> => {
    const response = await apiFetch<ImportPreview>(`/api/catalog/import/${uploadId}/preview`, {
        tenantSlug
    });
    return response;
  },

  commitImport: async (uploadId: number, overrides: any = {}, tenantSlug?: string) => {
    const response = await apiFetch<any>(`/api/catalog/import/${uploadId}/commit`, {
      method: 'POST',
      body: { overrides },
      tenantSlug
    });
    return response; // { created_count, status }
  }
};
