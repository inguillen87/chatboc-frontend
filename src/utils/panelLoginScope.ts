import { TENANT_ROUTE_PREFIXES, readCanonicalTenantSlugFromPath } from './tenantPaths';
import { normalizedLoginTenant } from './panelLoginResponse';

/** Login scope comes from its route, never a previously visited public space. */
export function readPanelLoginScope(pathname: string): { valid: boolean; tenantSlug: string | null } {
  if (/^\/login\/?$/i.test(pathname)) return { valid: true, tenantSlug: null };
  const segments = pathname.replace(/\/$/, '').split('/').slice(1);
  const prefixed = TENANT_ROUTE_PREFIXES.includes(segments[0]?.toLowerCase() as typeof TENANT_ROUTE_PREFIXES[number]);
  if (segments.at(-1)?.toLowerCase() !== 'login' || segments.length !== (prefixed ? 3 : 2)) {
    return { valid: false, tenantSlug: null };
  }
  try {
    const raw = readCanonicalTenantSlugFromPath(pathname) ?? decodeURIComponent(segments[prefixed ? 1 : 0]);
    if (!raw || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(raw)) return { valid: false, tenantSlug: null };
    const tenantSlug = normalizedLoginTenant(raw);
    return { valid: Boolean(tenantSlug), tenantSlug };
  } catch {
    return { valid: false, tenantSlug: null };
  }
}
