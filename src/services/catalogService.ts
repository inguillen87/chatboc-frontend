import { apiFetch } from '@/utils/api';

export interface CatalogVectorSyncPayload {
  pymeId: string | number;
  mappingId: string | number;
  sourceFileName?: string;
  metadata?: Record<string, unknown>;
}

export interface CatalogVectorSyncStatus {
  status: 'pending' | 'processing' | 'ready' | 'error';
  lastSyncedAt: string | null;
  lastSourceFileName: string | null;
  documentCount: number;
  message?: string;
}

export async function triggerCatalogVectorSync({
  pymeId,
  mappingId,
  sourceFileName,
  metadata,
}: CatalogVectorSyncPayload): Promise<CatalogVectorSyncStatus> {
  return apiFetch<CatalogVectorSyncStatus>(`/pymes/${pymeId}/catalog-vector-sync`, {
    method: 'POST',
    body: {
      mappingId,
      sourceFileName,
      metadata,
    },
  });
}

export async function fetchCatalogVectorSyncStatus(pymeId: string | number): Promise<CatalogVectorSyncStatus> {
  return apiFetch<CatalogVectorSyncStatus>(`/pymes/${pymeId}/catalog-vector-sync/status`, {
    method: 'GET',
  });
}
