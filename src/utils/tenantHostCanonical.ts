import type { TenantHostBinding } from '@/types/tenantHost';
import { readTenantCanonicalOrigin } from './tenantHostBinding';

const currentLease = (binding: TenantHostBinding, nowSeconds: number): boolean =>
  binding.binding.status === 'active' && binding.binding.verified === true &&
  Number.isSafeInteger(binding.binding.valid_until) && binding.binding.valid_until > nowSeconds;

/** Only the unambiguous public root may move origins; never carry URL state. */
export function tenantHostCanonicalLookup(
  binding: TenantHostBinding, href: string, nowSeconds = Date.now() / 1000,
): string | null {
  if (!currentLease(binding, nowSeconds) || binding.canonical_redirect_required !== true ||
    href !== `${binding.origin}/`) return null;
  const origin = readTenantCanonicalOrigin(binding.canonical_origin);
  return origin && origin !== binding.origin ? new URL(origin).hostname : null;
}

/** Both identities come from separate exact-host reads through the local proxy. */
export function tenantHostCanonicalDestination(
  source: TenantHostBinding, destination: TenantHostBinding, href: string,
  nowSeconds = Date.now() / 1000,
): string | null {
  const host = tenantHostCanonicalLookup(source, href, nowSeconds);
  if (!host || !currentLease(destination, nowSeconds) || destination.host !== host ||
    destination.origin !== source.canonical_origin ||
    destination.tenant.id !== source.tenant.id || destination.tenant.slug !== source.tenant.slug ||
    destination.canonical_redirect_required !== false || destination.canonical_origin !== destination.origin) return null;
  return `${destination.origin}/`;
}
