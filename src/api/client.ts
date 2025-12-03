import { apiFetch } from '@/utils/api';

/**
 * Lightweight HTTP client wrapper for marketplace endpoints.
 * It delegates URL resolution and tenant detection to the shared apiFetch helper
 * to reuse its proxy detection, CORS fallbacks, and multi-base retry logic.
 */
const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

const withTenant = (path: string, tenantSlug?: string | null) => {
  if (!tenantSlug) return normalizePath(path);

  const normalizedPath = normalizePath(path);
  const tenantPrefix = `/municipio/${encodeURIComponent(tenantSlug)}`;

  if (normalizedPath.startsWith('/api/')) return normalizedPath;
  if (normalizedPath.startsWith('/municipio/')) return normalizedPath;
  if (normalizedPath.startsWith('/public/')) return `/api${normalizedPath}`.replace(/^\/api\/api/, '/api');

  return `/api${tenantPrefix}${normalizedPath}`.replace(/^\/api\/api/, '/api');
};

export const apiClient = {
  get: <T = any>(path: string, tenantSlug?: string | null) =>
    apiFetch<T>(withTenant(path, tenantSlug), { method: 'GET', tenantSlug }),
  post: <T = any>(path: string, body?: unknown, tenantSlug?: string | null) =>
    apiFetch<T>(withTenant(path, tenantSlug), { method: 'POST', body, tenantSlug }),
  put: <T = any>(path: string, body?: unknown, tenantSlug?: string | null) =>
    apiFetch<T>(withTenant(path, tenantSlug), { method: 'PUT', body, tenantSlug }),
  delete: <T = any>(path: string, tenantSlug?: string | null) =>
    apiFetch<T>(withTenant(path, tenantSlug), { method: 'DELETE', tenantSlug }),
};
