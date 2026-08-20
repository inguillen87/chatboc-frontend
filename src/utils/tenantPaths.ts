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

const PUBLIC_NAVIGATION_BASE_URL = 'https://internal-navigation.invalid';
const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ENCODED_SEPARATOR_OR_CONTROL_PATTERN = /%(?:25)*(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i;
const SAFE_PUBLIC_PATH_SEGMENT_PATTERN = /^[\p{L}\p{N}._~-]+$/u;

const hasUnsafePublicNavigationShape = (value: string) => {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    URI_SCHEME_PATTERN.test(value)
  ) {
    return true;
  }

  const pathOnly = value.split(/[?#]/, 1)[0];
  if (pathOnly.includes('//')) return true;

  const segments = pathOnly.split('/').slice(1);
  return segments.some((segment) => segment === '.' || segment === '..');
};

/**
 * Accepts only canonical, same-origin, root-relative paths for public
 * navigation contracts. Public API values must never be interpreted as
 * external links merely because they look URL-like.
 */
export const sanitizePublicInternalNavigationPath = (value?: unknown): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized ||
    hasUnsafePublicNavigationShape(normalized) ||
    ENCODED_SEPARATOR_OR_CONTROL_PATTERN.test(normalized)
  ) {
    return null;
  }

  let decoded = normalized;
  for (let depth = 0; depth < 3; depth += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }

    if (hasUnsafePublicNavigationShape(next)) return null;
    if (next === decoded) break;
    decoded = next;
  }

  let decodedPath = normalized.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 3; depth += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decodedPath);
    } catch {
      return null;
    }
    if (hasUnsafePublicNavigationShape(next)) return null;
    if (next === decodedPath) break;
    decodedPath = next;
  }

  const decodedSegments = decodedPath === '/' ? [] : decodedPath.split('/').slice(1);
  if (
    decodedSegments.some(
      (segment) => !segment || !SAFE_PUBLIC_PATH_SEGMENT_PATTERN.test(segment),
    )
  ) {
    return null;
  }

  try {
    const parsed = new URL(normalized, PUBLIC_NAVIGATION_BASE_URL);
    if (parsed.origin !== PUBLIC_NAVIGATION_BASE_URL) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

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
  item: TenantPublicNavigationItem | null | undefined,
  basePath: string,
) => {
  const safeBasePath = sanitizePublicInternalNavigationPath(basePath);
  if (!safeBasePath) return null;

  const itemRoute = typeof item?.route === 'string' ? item.route.trim() : '';
  // tenant.public_navigation.v1 defines `route` as a required internal path.
  // It does not define `href`, `url` or `path` aliases, and a missing/invalid
  // contract item must never be converted into an inferred fallback.
  if (!item || !itemRoute) return null;

  const safeTarget = sanitizePublicInternalNavigationPath(itemRoute);
  if (!safeTarget) return null;

  const basePathname = new URL(safeBasePath, PUBLIC_NAVIGATION_BASE_URL).pathname.replace(/\/+$/, '');
  const targetPathname = new URL(safeTarget, PUBLIC_NAVIGATION_BASE_URL).pathname;
  if (targetPathname !== basePathname && !targetPathname.startsWith(`${basePathname}/`)) {
    return null;
  }

  const routeForPrivacyCheck = stripBasePathFromTenantRoute(safeTarget, safeBasePath);
  if (isPrivateTenantBackofficeRoute(routeForPrivacyCheck)) {
    return `${safeBasePath.replace(/\/+$/, '')}/reclamos/nuevo`;
  }

  return safeTarget;
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
