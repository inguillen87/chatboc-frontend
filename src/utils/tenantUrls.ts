import { BASE_API_URL } from '@/config';

const TENANT_AWARE_PATHS = [
  '/productos',
  '/cart',
  '/checkout-productos',
  '/checkout',
  '/portal/catalogo',
  '/portal/beneficios',
];

const PLACEHOLDER_SLUGS = new Set(['iframe', 'embed', 'widget']);

const getAppOrigin = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  try {
    if (BASE_API_URL) {
      const parsed = new URL(BASE_API_URL);
      return parsed.origin;
    }
  } catch (error) {
    console.warn('[tenantUrls] No se pudo obtener el origin desde BASE_API_URL', error);
  }

  return 'https://app.chatboc.ar';
};

const shouldAttachTenant = (pathname: string): boolean => {
  if (!pathname) return false;
  return TENANT_AWARE_PATHS.some((path) => pathname.startsWith(path));
};

export const buildTenantAwareUrl = (rawUrl: string, tenantSlug?: string | null): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const slug = tenantSlug?.trim();
  if (slug && PLACEHOLDER_SLUGS.has(slug.toLowerCase())) {
    return rawUrl.trim();
  }
  const trimmed = rawUrl.trim();
  if (!slug) return trimmed;

  const appOrigin = getAppOrigin();

  try {
    const parsed = new URL(trimmed, appOrigin);

    if (!shouldAttachTenant(parsed.pathname)) {
      return trimmed;
    }

    const target = new URL(parsed.toString());
    target.protocol = new URL(appOrigin).protocol;
    target.host = new URL(appOrigin).host;

    if (!target.searchParams.has('tenant_slug')) {
      target.searchParams.set('tenant_slug', slug);
    }

    if (!target.searchParams.has('tenant')) {
      target.searchParams.set('tenant', slug);
    }

    parsed.searchParams.forEach((value, key) => {
      if (key !== 'tenant') {
        target.searchParams.set(key, value);
      }
    });

    return target.toString();
  } catch (error) {
    console.warn('[tenantUrls] No se pudo normalizar la URL del botón', error);
    return trimmed;
  }
};

export default buildTenantAwareUrl;
