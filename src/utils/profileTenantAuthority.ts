import type { ChannelActivationContract } from '@/api/v2/channelActivation';
import { TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';

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
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  // Private resolution is an exact backend slug lookup, not a display-name
  // normalizer: preserve separators and reject invalid identities. Admin slug
  // resolution already compares case-insensitively in the backend.
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(normalized) ||
    TENANT_PLACEHOLDER_SLUGS.has(normalized) || GENERIC_AUTHENTICATED_TENANT_SLUGS.has(normalized)) {
    return null;
  }
  return normalized;
};

export const readExplicitTenantRequest = (
  searchParams: Pick<URLSearchParams, 'has' | 'getAll'>,
): ExplicitTenantRequest => {
  const hasTenant = searchParams.has('tenant');
  const hasTenantSlug = searchParams.has('tenant_slug');
  const present = hasTenant || hasTenantSlug;

  if (!present) {
    return { present: false, valid: true, slug: null };
  }

  const values = [...searchParams.getAll('tenant'), ...searchParams.getAll('tenant_slug')]
    .map(normalizeProfileTenantSlug);
  if (!values.length || values.some(value => !value) || new Set(values).size !== 1) {
    return { present: true, valid: false, slug: null };
  }

  return {
    present: true,
    valid: true,
    slug: values[0],
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
