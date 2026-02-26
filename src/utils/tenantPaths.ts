import { APP_TARGET } from '@/config';
import { TENANT_ROUTE_PREFIXES, TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';

// Re-export constants for backward compatibility if any file still imports from here
export { TENANT_ROUTE_PREFIXES, TENANT_PLACEHOLDER_SLUGS };

function isPlaceholderSlug(slug?: string | null) {
  if (!slug) return false;
  return TENANT_PLACEHOLDER_SLUGS.has(slug.trim().toLowerCase());
}

function hasTenantPrefix(path: string) {
  return TENANT_ROUTE_PREFIXES.some((prefix) => path.startsWith(`/${prefix}/`));
}

function stripTenantPrefix(path: string) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const segments = normalized.split('/');
  const [firstSegment, ...rest] = segments;

  if (!firstSegment) return normalized;

  if (TENANT_ROUTE_PREFIXES.includes(firstSegment.toLowerCase() as (typeof TENANT_ROUTE_PREFIXES)[number])) {
    return rest.join('/');
  }

  return normalized;
}

/**
 * Builds a path that includes the tenant slug as the first segment.
 * e.g. buildTenantPath('/cart', 'municipio') -> '/municipio/cart'
 *
 * It avoids double-prefixing. If the path already has a prefix, it might replace it or leave it
 * depending on logic, but here we prioritize a clean /:slug/:path structure.
 */
export function buildTenantPath(basePath: string, tenantSlug?: string | null) {
  const normalizedSlug = tenantSlug?.trim();
  const safeSlug = normalizedSlug?.toLowerCase();

  const normalizedPath = basePath.startsWith('/') ? basePath.slice(1) : basePath;
  const cleanPath = stripTenantPrefix(normalizedPath);

  if (normalizedSlug && safeSlug && !isPlaceholderSlug(safeSlug)) {
    // If the path already starts with the slug, don't prepend it again.
    // e.g. basePath='municipio/cart', slug='municipio' -> '/municipio/cart'
    if (normalizedPath.startsWith(`${safeSlug}/`)) {
      return `/${normalizedPath}`;
    }

    return `/${encodeURIComponent(normalizedSlug)}/${cleanPath}`;
  }

  // Fallback: if no slug, return original path (maybe root path)
  return `/${normalizedPath}`;
}

export function buildTenantApiPath(basePath: string, tenantSlug?: string | null) {
  const normalized = basePath.startsWith('/') ? basePath.slice(1) : basePath;
  const safeSlug = tenantSlug?.trim();

  if (safeSlug && !isPlaceholderSlug(safeSlug)) {
    // Return /api/:slug/:path
    return `/api/${encodeURIComponent(safeSlug)}/${normalized}`;
  }

  return `/api/${normalized}`;
}

export function buildTenantAwareNavigatePath(
  basePath: string,
  tenantSlug?: string | null,
  fallbackQueryParam = 'tenant_slug',
) {
  if (tenantSlug) {
    return buildTenantPath(basePath, tenantSlug);
  }
  if (fallbackQueryParam) {
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}${fallbackQueryParam}=`;
  }
  return basePath;
}

function applySlugPlaceholder(template: string, tenantSlug?: string | null) {
  const trimmed = template.trim();
  const hasPlaceholder = trimmed.includes(':slug');

  if (hasPlaceholder) {
    if (!tenantSlug) return null;
    const encodedSlug = encodeURIComponent(tenantSlug);
    return trimmed.replace(/:slug/gi, encodedSlug);
  }

  return trimmed;
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function toAbsoluteUrl(raw: string, baseUrl?: string | null) {
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
}

interface BuildTenantNavigationUrlOptions {
  basePath: string;
  tenantSlug?: string | null;
  tenant?: { public_base_url?: string | null } | null;
  preferredUrl?: string | null;
  fallbackQueryParam?: string | null;
}

export function buildTenantNavigationUrl({
  basePath,
  tenantSlug,
  tenant,
  preferredUrl,
  fallbackQueryParam = 'tenant_slug',
}: BuildTenantNavigationUrlOptions) {
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
}
