import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/constants/tenant';

const CANONICAL_PREFIX = 't';

const LEGACY_PREFIXES = TENANT_ROUTE_PREFIXES.filter((prefix) => prefix !== CANONICAL_PREFIX);

const normalizePath = (pathname: string) => {
  if (!pathname || pathname === '/') return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
};

const hasTenantSlugSegment = (segments: string[]) => {
  if (segments.length < 2) return false;
  const candidate = decodeURIComponent(segments[1] || '').trim().toLowerCase();
  if (!candidate) return false;
  return !TENANT_PLACEHOLDER_SLUGS.has(candidate);
};

/**
 * Redirects legacy prefixed routes (`/market/:slug/*`, `/tenant/:slug/*`, etc.)
 * to the canonical route shape (`/t/:slug/*`).
 */
export const toCanonicalTenantPath = (pathname: string): string | null => {
  const normalizedPath = normalizePath(pathname);
  const segments = normalizedPath.split('/').filter(Boolean);
  const firstSegment = (segments[0] || '').toLowerCase();

  if (!LEGACY_PREFIXES.includes(firstSegment as (typeof LEGACY_PREFIXES)[number])) {
    return null;
  }

  if (!hasTenantSlugSegment(segments)) {
    return null;
  }

  const canonicalSegments = [...segments];
  canonicalSegments[0] = CANONICAL_PREFIX;
  return `/${canonicalSegments.join('/')}`;
};

