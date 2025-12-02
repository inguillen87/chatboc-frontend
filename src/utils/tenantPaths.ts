import { APP_TARGET } from '@/config';

export const TENANT_ROUTE_PREFIXES = ['m', 'market', 't', 'tenant', 'municipio', 'pyme'] as const;

const hasTenantPrefix = (path: string) =>
  TENANT_ROUTE_PREFIXES.some((prefix) => path.startsWith(`/${prefix}/`));

const resolveTenantPrefix = () => {
  if (APP_TARGET === 'municipio') return 'municipio';
  if (APP_TARGET === 'pyme') return 'pyme';

  if (typeof window !== 'undefined') {
    const pathname = window.location?.pathname?.toLowerCase?.() || '';
    if (pathname.includes('/municipio') || pathname.includes('/municipal')) {
      return 'municipio';
    }
  }

  return TENANT_ROUTE_PREFIXES[0];
};

export const buildTenantPath = (basePath: string, tenantSlug?: string | null) => {
  const normalizedSlug = tenantSlug?.trim();
  const safeSlug = normalizedSlug?.toLowerCase();

  if (
    normalizedSlug &&
    safeSlug &&
    !['iframe', 'embed', 'widget'].includes(safeSlug) &&
    !hasTenantPrefix(basePath)
  ) {
    // NOTE: This is a temporary fix to redirect to the new market cart page.
    if (basePath === '/cart') {
      return `/market/${encodeURIComponent(normalizedSlug)}/cart`;
    }
    const normalized = basePath.startsWith('/') ? basePath.slice(1) : basePath;
    const prefix = resolveTenantPrefix();
    return `/${prefix}/${encodeURIComponent(normalizedSlug)}/${normalized}`;
  }

  return basePath;
};

export const buildTenantAwareNavigatePath = (
  basePath: string,
  tenantSlug?: string | null,
  fallbackQueryParam = 'tenant_slug',
) => {
  if (tenantSlug) {
    return buildTenantPath(basePath, tenantSlug);
  }
  if (fallbackQueryParam) {
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}${fallbackQueryParam}=`;
  }
  return basePath;
};

const applySlugPlaceholder = (template: string, tenantSlug?: string | null) => {
  const trimmed = template.trim();
  const hasPlaceholder = trimmed.includes(':slug');

  if (hasPlaceholder) {
    if (!tenantSlug) return null;
    const encodedSlug = encodeURIComponent(tenantSlug);
    return trimmed.replace(/:slug/gi, encodedSlug);
  }

  return trimmed;
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const toAbsoluteUrl = (raw: string, baseUrl?: string | null) => {
  const candidateBase = baseUrl?.trim();
  try {
    if (isAbsoluteUrl(raw)) {
      return new URL(raw).toString();
    }
    if (candidateBase) {
      return new URL(raw, candidateBase.endsWith('/') ? candidateBase : `${candidateBase}/`).toString();
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(raw, window.location.origin).toString();
    }
    return new URL(raw, 'http://localhost').toString();
  } catch (error) {
    console.warn('[tenantPaths] No se pudo construir URL absoluta', { raw, baseUrl, error });
    return null;
  }
};

interface BuildTenantNavigationUrlOptions {
  basePath: string;
  tenantSlug?: string | null;
  tenant?: { public_base_url?: string | null } | null;
  preferredUrl?: string | null;
  fallbackQueryParam?: string | null;
}

export const buildTenantNavigationUrl = ({
  basePath,
  tenantSlug,
  tenant,
  preferredUrl,
  fallbackQueryParam = 'tenant_slug',
}: BuildTenantNavigationUrlOptions) => {
  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const safeSlug = tenantSlug?.trim() || null;
  const publicBase = tenant?.public_base_url ?? null;

  const preferredWithSlug = preferredUrl ? applySlugPlaceholder(preferredUrl, safeSlug) : null;
  const preferredAbsolute = preferredWithSlug ? toAbsoluteUrl(preferredWithSlug, publicBase) : null;
  if (preferredAbsolute) {
    return preferredAbsolute;
  }

  if (publicBase) {
    const tenantPath = buildTenantPath(normalizedPath, safeSlug);
    const absolutePublicPath = toAbsoluteUrl(tenantPath, publicBase);
    if (absolutePublicPath) {
      return absolutePublicPath;
    }
  }

  const fallback = buildTenantAwareNavigatePath(normalizedPath, safeSlug, fallbackQueryParam || undefined);
  return toAbsoluteUrl(fallback, typeof window !== 'undefined' ? window.location?.origin : undefined) ?? fallback;
};
