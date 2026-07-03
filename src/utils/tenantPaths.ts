import { APP_TARGET } from '@/config';
import { TENANT_ROUTE_PREFIXES, TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';
import type { TenantPublicNavigationItem } from '@/types/tenant';

// Re-export constants for backward compatibility if any file still imports from here
export { TENANT_ROUTE_PREFIXES, TENANT_PLACEHOLDER_SLUGS };

const isPlaceholderSlug = (slug?: string | null) => {
  if (!slug) return false;
  return TENANT_PLACEHOLDER_SLUGS.has(slug.trim().toLowerCase());
};

export const readCanonicalTenantSlugFromPath = (pathname?: string | null) => {
  if (!pathname) return null;
  const canonicalMatch = pathname.match(/^\/t\/([^/]+)/i);
  const portalMatch = pathname.match(/^\/portal\/([^/]+)/i);
  const rawSlug = canonicalMatch?.[1] || portalMatch?.[1] || null;
  if (!rawSlug) return null;
  try {
    const decoded = decodeURIComponent(rawSlug);
    return isPlaceholderSlug(decoded) ? null : decoded;
  } catch {
    return isPlaceholderSlug(rawSlug) ? null : rawSlug;
  }
};

const hasTenantPrefix = (path: string) =>
  TENANT_ROUTE_PREFIXES.some((prefix) => path.startsWith(`/${prefix}/`));

const stripTenantPrefix = (path: string) => {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const segments = normalized.split('/');
  const [firstSegment, ...rest] = segments;

  if (!firstSegment) return normalized;

  if (TENANT_ROUTE_PREFIXES.includes(firstSegment.toLowerCase() as (typeof TENANT_ROUTE_PREFIXES)[number])) {
    return rest.join('/');
  }

  return normalized;
};

/**
 * Builds a path that includes the tenant slug as the first segment.
 * e.g. buildTenantPath('/cart', 'municipio') -> '/municipio/cart'
 *
 * It avoids double-prefixing. If the path already has a prefix, it might replace it or leave it
 * depending on logic, but here we prioritize a clean /:slug/:path structure.
 */
export const buildTenantPath = (basePath: string, tenantSlug?: string | null) => {
  const normalizedSlug = tenantSlug?.trim();
  const safeSlug = normalizedSlug?.toLowerCase();

  const normalizedPath = basePath.startsWith('/') ? basePath.slice(1) : basePath;
  const cleanPath = stripTenantPrefix(normalizedPath);

  if (normalizedSlug && safeSlug && !isPlaceholderSlug(safeSlug)) {
    const canonicalSlugPrefix = `t/${safeSlug}`;
    if (normalizedPath.toLowerCase() === canonicalSlugPrefix || normalizedPath.toLowerCase().startsWith(`${canonicalSlugPrefix}/`)) {
      return `/${normalizedPath}`;
    }

    const pathWithoutCurrentSlug =
      normalizedPath.toLowerCase() === safeSlug
        ? ''
        : normalizedPath.toLowerCase().startsWith(`${safeSlug}/`)
          ? normalizedPath.slice(safeSlug.length + 1)
          : cleanPath;

    const suffix = pathWithoutCurrentSlug ? `/${pathWithoutCurrentSlug}` : '';
    return `/t/${encodeURIComponent(normalizedSlug)}${suffix}`;
  }

  // Fallback: if no slug, return original path (maybe root path)
  return `/${normalizedPath}`;
};

export const buildTenantApiPath = (basePath: string, tenantSlug?: string | null) => {
  const normalized = basePath.startsWith('/') ? basePath.slice(1) : basePath;
  const safeSlug = tenantSlug?.trim();

  if (safeSlug && !isPlaceholderSlug(safeSlug)) {
    // Return /api/:slug/:path
    return `/api/${encodeURIComponent(safeSlug)}/${normalized}`;
  }

  return `/api/${normalized}`;
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

export const isAbsoluteUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

export const isPrivateTenantBackofficeRoute = (value?: string | null) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '');
  const pathOnly = normalized.split(/[?#]/)[0].replace(/\/+$/, '');

  return (
    pathOnly === 'tickets' ||
    pathOnly === 'reclamos' ||
    pathOnly === 'inbox' ||
    pathOnly.startsWith('tickets/') ||
    pathOnly.startsWith('reclamos/') ||
    pathOnly.startsWith('inbox/')
  );
};

const stripBasePathFromTenantRoute = (route: string, basePath: string) => {
  const trimmedRoute = route.trim();
  const normalizedBase = basePath.replace(/\/+$/, '');
  if (!normalizedBase) return trimmedRoute.replace(/^\/+/, '');

  const normalizedRouteLower = trimmedRoute.toLowerCase();
  const normalizedBaseLower = normalizedBase.toLowerCase();
  if (
    normalizedRouteLower === normalizedBaseLower ||
    normalizedRouteLower.startsWith(`${normalizedBaseLower}/`) ||
    normalizedRouteLower.startsWith(`${normalizedBaseLower}?`)
  ) {
    return trimmedRoute.slice(normalizedBase.length).replace(/^\/+/, '');
  }

  return trimmedRoute.replace(/^\/+/, '');
};

export const resolveTenantPublicNavigationTarget = (
  item: Pick<TenantPublicNavigationItem, 'route' | 'href'> & { path?: unknown } | null | undefined,
  basePath: string,
  fallbackSuffix?: string | null,
) => {
  const itemRoute =
    item?.route ||
    item?.href ||
    (typeof item?.path === 'string' ? item.path : null) ||
    fallbackSuffix ||
    '';
  if (!itemRoute) return basePath;
  if (isAbsoluteUrl(itemRoute)) return itemRoute;

  const routeForPrivacyCheck = stripBasePathFromTenantRoute(itemRoute, basePath);
  if (isPrivateTenantBackofficeRoute(routeForPrivacyCheck)) {
    return `${basePath.replace(/\/+$/, '')}/reclamos/nuevo`;
  }

  if (itemRoute.startsWith('/')) return itemRoute;
  return `${basePath.replace(/\/+$/, '')}/${itemRoute.replace(/^\/+/, '')}`;
};

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
