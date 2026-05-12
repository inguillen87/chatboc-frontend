import { ApiError, apiFetch } from '@/utils/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface V2RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  tenantSlug?: string | null;
  skipAuth?: boolean;
  omitCredentials?: boolean;
  isWidgetRequest?: boolean;
  legacyFallbackPath?: string;
  baseUrlOverride?: string | null;
}

const withTenantHeader = (headers: Record<string, string> | undefined, tenantSlug?: string | null) => {
  if (!tenantSlug) return headers;
  return {
    ...(headers ?? {}),
    'X-Tenant-Slug': tenantSlug,
  };
};

const shouldRunLegacyFallback = (error: unknown) => {
  if (!(error instanceof ApiError)) return false;
  return [404, 405, 501].includes(error.status);
};

const requestV2 = async <T>(path: string, options: V2RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, headers, tenantSlug, skipAuth, omitCredentials, isWidgetRequest, legacyFallbackPath, baseUrlOverride } = options;

  const sharedOptions = {
    method,
    body,
    skipAuth,
    omitCredentials,
    isWidgetRequest,
    tenantSlug,
    headers: withTenantHeader(headers, tenantSlug),
    omitTenant: !tenantSlug,
    baseUrlOverride,
  };

  try {
    return await apiFetch<T>(path, sharedOptions);
  } catch (error) {
    if (!legacyFallbackPath || !shouldRunLegacyFallback(error)) throw error;
    return apiFetch<T>(legacyFallbackPath, sharedOptions);
  }
};

const makeApi = (defaults: Partial<V2RequestOptions> = {}) => ({
  get: <T>(path: string, options?: Omit<V2RequestOptions, 'method' | 'body'>) =>
    requestV2<T>(path, { ...defaults, ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<V2RequestOptions, 'method' | 'body'>) =>
    requestV2<T>(path, { ...defaults, ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<V2RequestOptions, 'method' | 'body'>) =>
    requestV2<T>(path, { ...defaults, ...options, method: 'PATCH', body }),
});

export const panelApi = makeApi();
export const publicApi = makeApi({ skipAuth: true, omitCredentials: true });
export const widgetApi = makeApi({ skipAuth: true, isWidgetRequest: true, omitCredentials: true });
export const demoApi = makeApi({ skipAuth: true, omitCredentials: true });
