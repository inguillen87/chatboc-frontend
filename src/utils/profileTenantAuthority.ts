import type { ChannelActivationContract } from '@/api/v2/channelActivation';
import { normalizeOperationalTenantSlug } from '@/utils/tenantIdentity';

const GENERIC_AUTHENTICATED_TENANT_SLUGS = new Set([
  'municipio',
  'municipal',
  'municipios',
  'pyme',
  'pymes',
  'tenant',
]);

export interface ExplicitTenantRequest {
  present: boolean;
  valid: boolean;
  slug: string | null;
}

export const normalizeProfileTenantSlug = (
  value?: string | number | null,
): string | null => {
  const normalized = normalizeOperationalTenantSlug(value);
  if (!normalized || GENERIC_AUTHENTICATED_TENANT_SLUGS.has(normalized)) {
    return null;
  }
  return normalized;
};

export const readExplicitTenantRequest = (
  searchParams: Pick<URLSearchParams, 'has' | 'get'>,
): ExplicitTenantRequest => {
  const hasTenant = searchParams.has('tenant');
  const hasTenantSlug = searchParams.has('tenant_slug');
  const present = hasTenant || hasTenantSlug;

  if (!present) {
    return { present: false, valid: true, slug: null };
  }

  const tenant = hasTenant ? normalizeProfileTenantSlug(searchParams.get('tenant')) : null;
  const tenantSlug = hasTenantSlug
    ? normalizeProfileTenantSlug(searchParams.get('tenant_slug'))
    : null;

  if ((hasTenant && !tenant) || (hasTenantSlug && !tenantSlug)) {
    return { present: true, valid: false, slug: null };
  }

  if (tenant && tenantSlug && tenant !== tenantSlug) {
    return { present: true, valid: false, slug: null };
  }

  return {
    present: true,
    valid: true,
    slug: tenantSlug || tenant,
  };
};

export const activationAuthorizesTenant = (
  activation: ChannelActivationContract | null | undefined,
  requestedTenantSlug: string | null | undefined,
): activation is ChannelActivationContract => {
  const requested = normalizeProfileTenantSlug(requestedTenantSlug);
  const returned = normalizeProfileTenantSlug(activation?.tenant?.slug);
  return Boolean(
    requested &&
      returned &&
      requested === returned &&
      activation?.contract_version === 'tenant.channel_activation.v1',
  );
};

export const getActivationPlan = (
  activation: ChannelActivationContract | null | undefined,
): string | null => {
  const plan = activation?.tenant?.plan || activation?.integration_access?.current_plan;
  if (typeof plan !== 'string' || !plan.trim()) return null;
  return plan.trim().toLowerCase();
};
