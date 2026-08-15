import { TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';

const DEPLOYMENT_PLATFORM_SUFFIXES = ['vercel.app'] as const;
const PLATFORM_APEX_HOSTNAMES = new Set(['chatboc.ar']);

const normalizeHostname = (hostname?: string | null): string =>
  String(hostname || '').trim().toLowerCase().replace(/\.$/, '');

const isIpAddress = (hostname: string): boolean =>
  hostname === '::1' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

const hostnameMatchesSuffix = (hostname: string, suffix: string): boolean =>
  hostname === suffix || hostname.endsWith(`.${suffix}`);

export const isDeploymentPlatformHostname = (hostname?: string | null): boolean => {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return false;

  return DEPLOYMENT_PLATFORM_SUFFIXES.some((suffix) =>
    hostnameMatchesSuffix(normalizedHostname, suffix),
  );
};

const readHostnameFirstLabel = (hostname?: string | null): string | null => {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname || isIpAddress(normalizedHostname)) return null;

  const [firstLabel, ...rest] = normalizedHostname.split('.');
  return firstLabel && rest.length > 0 ? firstLabel : null;
};

/**
 * Returns a tenant only for hostnames that can legitimately represent a custom
 * tenant subdomain. Deployment platform aliases must stay unscoped because
 * their first label identifies a build, branch or project, not an organization.
 */
export const readTenantSlugFromHostname = (hostname?: string | null): string | null => {
  const normalizedHostname = normalizeHostname(hostname);
  if (
    !normalizedHostname ||
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost') ||
    PLATFORM_APEX_HOSTNAMES.has(normalizedHostname) ||
    isIpAddress(normalizedHostname) ||
    isDeploymentPlatformHostname(normalizedHostname)
  ) {
    return null;
  }

  const candidate = readHostnameFirstLabel(normalizedHostname);
  if (
    !candidate ||
    /^\d+$/.test(candidate) ||
    TENANT_PLACEHOLDER_SLUGS.has(candidate)
  ) {
    return null;
  }

  return candidate;
};

/**
 * Detects the stale value produced by the former hostname inference on Vercel.
 * This is intentionally limited to ambient stored state; explicit URL/session
 * tenant scopes remain authoritative even if their text happens to be similar.
 */
export const isTenantSlugDeploymentHostnameMirror = (
  tenantSlug?: string | null,
  hostname?: string | null,
): boolean => {
  if (!isDeploymentPlatformHostname(hostname)) return false;

  const normalizedTenantSlug = String(tenantSlug || '').trim().toLowerCase();
  const firstLabel = readHostnameFirstLabel(hostname);
  return Boolean(normalizedTenantSlug && firstLabel && normalizedTenantSlug === firstLabel);
};
