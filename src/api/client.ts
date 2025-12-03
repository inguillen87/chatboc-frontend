import { ApiError, NetworkError, resolveTenantSlug } from '@/utils/api';
import { BASE_API_URL } from '@/config';

const NORMALIZED_BACKEND_URL = (BASE_API_URL || '').replace(/\/$/, '').replace(/\/api$/, '');

export function getTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;

  const slug = (window as any).currentTenantSlug;
  const normalized = typeof slug === 'string' && slug.trim() ? slug.trim() : null;

  return resolveTenantSlug(normalized);
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem('auth_token');
    return token || null;
  } catch {
    return null;
  }
}

const buildUrl = (path: string, tenantSlug: string | null) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = tenantSlug ? `/municipio/${encodeURIComponent(tenantSlug)}` : '';

  const isAbsoluteApiPath = normalizedPath.startsWith('/api/');
  const hasMunicipioPrefix = normalizedPath.startsWith('/municipio/');
  const hasMunicipalPrefix = normalizedPath.startsWith('/municipal/');
  const isPublicPath = normalizedPath.startsWith('/public/');

  const effectivePath = isAbsoluteApiPath
    ? normalizedPath
    : `/api${hasMunicipioPrefix || hasMunicipalPrefix || isPublicPath || !prefix ? normalizedPath : `${prefix}${normalizedPath}`}`;

  const base = NORMALIZED_BACKEND_URL;
  const fullPath = `${effectivePath.replace(/^\/api\/api/, '/api')}`;
  if (!base) {
    return fullPath;
  }

  return `${base}${fullPath}`;
};

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { tenantSlug?: string | null } = {},
): Promise<T> {
  const tenant = resolveTenantSlug(options.tenantSlug ?? getTenantSlug());
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  if (tenant) headers['X-Tenant-Slug'] = tenant;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(buildUrl(path, tenant), {
      credentials: options.credentials ?? 'include',
      ...options,
      headers,
      body:
        options.body && !(options.body instanceof FormData) && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body,
    });

    if (!response.ok) {
      const text = await response.text();
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : text;
      } catch {
        // keep text fallback
      }
      throw new ApiError(text || `HTTP ${response.status}`, response.status, parsed);
    }

    if (response.status === 204) return null as T;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return text as unknown as T;
    }

    return response.json() as Promise<T>;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new NetworkError(error?.message || 'Network request failed', error);
  }
}

export const apiClient = {
  get: <T = any>(path: string, tenantSlug?: string | null) => apiFetch<T>(path, { method: 'GET', tenantSlug }),
  post: <T = any>(path: string, body?: unknown, tenantSlug?: string | null) =>
    apiFetch<T>(path, { method: 'POST', body, tenantSlug }),
  put: <T = any>(path: string, body?: unknown, tenantSlug?: string | null) =>
    apiFetch<T>(path, { method: 'PUT', body, tenantSlug }),
  delete: <T = any>(path: string, tenantSlug?: string | null) =>
    apiFetch<T>(path, { method: 'DELETE', tenantSlug }),
};
