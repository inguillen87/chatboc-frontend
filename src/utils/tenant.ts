import { resolveTenantSlug } from '@/utils/api';

type TenantContext = {
  /** Prefer an explicit tenant (e.g., from route params or query). */
  explicitTenant?: string | null;
  /** Tenant stored in the authenticated user profile. */
  userTenant?: string | null;
  /** Optional path to help resolve a tenant from a URL. */
  fallbackPath?: string | null;
};

/**
 * Central helper to resolve the active tenant.
 * It prioritizes an explicit slug, then the authenticated user, and finally
 * falls back to the current URL/search parameters handled by `resolveTenantSlug`.
 */
export function getTenant(context: TenantContext = {}): string | null {
  const { explicitTenant, userTenant, fallbackPath } = context;

  const preferred = explicitTenant ?? userTenant ?? null;
  const pathFallback =
    fallbackPath ??
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : null);

  return resolveTenantSlug(preferred, pathFallback);
}
