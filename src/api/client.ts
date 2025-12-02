import { resolveTenantSlug } from '@/utils/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

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

  if (tenant) headers['X-Tenant'] = tenant;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
