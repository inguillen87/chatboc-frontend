import { apiFetch } from '@/utils/api';

export interface V2RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  tenantSlug?: string | null;
  skipAuth?: boolean;
  legacyFallbackPath?: string;
}

const requestV2 = async <T>(path: string, options: V2RequestOptions = {}): Promise<T> => {
  const {
    method = 'GET',
    body,
    headers,
    tenantSlug,
    skipAuth,
    legacyFallbackPath,
  } = options;

  try {
    return await apiFetch<T>(path, {
      method,
      body,
      headers,
      tenantSlug,
      skipAuth,
      omitTenant: !tenantSlug,
    });
  } catch (error) {
    if (!legacyFallbackPath) throw error;
    return apiFetch<T>(legacyFallbackPath, {
      method,
      body,
      headers,
      tenantSlug,
      skipAuth,
      omitTenant: !tenantSlug,
    });
  }
};

export const panelApi = {
  get: <T>(path: string, options?: Omit<V2RequestOptions, 'method'>) => requestV2<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<V2RequestOptions, 'method' | 'body'>) =>
    requestV2<T>(path, { ...options, method: 'POST', body }),
};

export const publicApi = {
  get: <T>(path: string, options?: Omit<V2RequestOptions, 'method'>) => requestV2<T>(path, { ...options, method: 'GET', skipAuth: true }),
};

export const widgetApi = {
  post: <T>(path: string, body?: unknown, options?: Omit<V2RequestOptions, 'method' | 'body'>) =>
    requestV2<T>(path, { ...options, method: 'POST', body, skipAuth: true }),
};

export const demoApi = {
  get: <T>(path: string, options?: Omit<V2RequestOptions, 'method'>) => requestV2<T>(path, { ...options, method: 'GET', skipAuth: true }),
  post: <T>(path: string, body?: unknown, options?: Omit<V2RequestOptions, 'method' | 'body'>) =>
    requestV2<T>(path, { ...options, method: 'POST', body, skipAuth: true }),
};
