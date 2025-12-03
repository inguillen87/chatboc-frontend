import { resolveTenantSlug } from '@/utils/api';

const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://www.chatboc.ar';
const BACKEND_URL = RAW_BACKEND_URL.replace(/\/$/, '').replace(/\/api$/, '');

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
  const isPublicPath = normalizedPath.startsWith('/public/');

  const effectivePath = isAbsoluteApiPath
    ? normalizedPath
    : `/api${hasMunicipioPrefix || isPublicPath || !prefix ? normalizedPath : `${prefix}${normalizedPath}`}`;

  return `${BACKEND_URL}${effectivePath.replace(/^\/api\/api/, '/api')}`;
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
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
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
