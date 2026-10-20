import { TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';
import { exactInstitutionSlug, safeInstitutionLogo } from './publishedTenantIdentity';
import { organizationTypeLabel } from './organizationTypeLabel';

export interface VerifiedOrganizationAuthority {
  hasVerifiedSession: boolean;
  profileVerified: boolean;
  loading: boolean;
}

export type VerifiedOrganizationType =
  | 'municipio'
  | 'gobierno'
  | 'colegio'
  | 'empresa'
  | 'pyme'
  | 'organizacion';

export interface VerifiedOrganizationIdentity {
  tenantId: number;
  tenantSlug: string;
  name: string;
  logoUrl: string | null;
  organizationType: VerifiedOrganizationType;
  organizationTypeLabel: string;
  isMunicipal: boolean;
}

const organizationTypes = new Set<VerifiedOrganizationType>([
  'municipio', 'gobierno', 'colegio', 'empresa', 'pyme', 'organizacion',
]);
// Match the generic private scope tokens already rejected by profileTenantAuthority.
const genericSessionSlugs = new Set(['municipio', 'municipal', 'municipios', 'pyme', 'pymes', 'tenant']);
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const own = (value: Record<string, unknown>, field: string) =>
  Object.prototype.hasOwnProperty.call(value, field);
const positiveContractId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const sessionTenantId = (value: unknown): number | null => {
  const id = typeof value === 'number' ? value
    : typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const privateSlug = (value: unknown): string | null => {
  const slug = exactInstitutionSlug(value);
  return slug && !TENANT_PLACEHOLDER_SLUGS.has(slug) && !genericSessionSlugs.has(slug) ? slug : null;
};

/** Explicitly unavailable or malformed contracts also suppress legacy identity fallback. */
export function hasOrganizationIdentityContracts(user: unknown): boolean {
  const actor = record(user);
  // Hydration preserves optional fields as own undefined properties. JSON cannot
  // supply undefined; null or a malformed supplied descriptor remain explicit.
  return Boolean(actor && ['organization_profile', 'organization_workspace']
    .some(field => own(actor, field) && actor[field] !== undefined));
}

/**
 * Presentation from the current authenticated response only. Session freshness is
 * supplied by the caller's existing request/session guards. This does not change
 * the actor, authorization, grants, tenant selection, or profile save contract.
 */
export function readVerifiedOrganizationIdentity(
  user: unknown,
  authority: VerifiedOrganizationAuthority,
): VerifiedOrganizationIdentity | null {
  if (authority?.hasVerifiedSession !== true || authority?.profileVerified !== true || authority?.loading !== false) return null;
  const actor = record(user);
  if (!actor || !own(actor, 'organization_profile') || !own(actor, 'organization_workspace')) return null;
  const profile = record(actor.organization_profile);
  const workspace = record(actor.organization_workspace);
  if (profile?.contract_version !== 'organization.profile_settings.v1'
    || workspace?.contract_version !== 'organization.profile_workspace.v1') return null;
  const profileTenant = record(profile.tenant);
  const workspaceTenant = record(workspace.tenant);
  if (!profileTenant || !workspaceTenant || !positiveContractId(profileTenant.id)
    || !positiveContractId(workspaceTenant.id) || profileTenant.id !== workspaceTenant.id) return null;

  // The anchor comes from session fields, never from the contracts being checked,
  // a selected route, public tenant metadata, catalog URLs, or local storage.
  const sessionTenant = record(actor.tenant);
  if (actor.tenant !== undefined && actor.tenant !== null && !sessionTenant) return null;
  const aliases = [actor.tenant_slug, actor.tenantSlug, sessionTenant?.slug, sessionTenant?.tenant_slug]
    .filter(value => value !== undefined && value !== null);
  const slugs = aliases.map(privateSlug);
  if (!slugs.length || slugs.some(slug => slug === null) || new Set(slugs).size !== 1) return null;
  const tenantSlug = slugs[0]!;
  if (privateSlug(profileTenant.slug) !== tenantSlug || privateSlug(workspaceTenant.slug) !== tenantSlug) return null;
  const suppliedIds = [actor.tenant_id, sessionTenant?.id].filter(value => value !== undefined);
  if (suppliedIds.some(value => sessionTenantId(value) !== profileTenant.id)) return null;

  const values = record(profile.values);
  const rawName = values?.nombre_empresa;
  if (typeof rawName !== 'string' || rawName.length > 240 || /[\p{Cc}\p{Cf}]/u.test(rawName)) return null;
  const name = rawName.trim();
  if (!name) return null;
  const type = workspace.organization_type;
  if (typeof type !== 'string' || !organizationTypes.has(type as VerifiedOrganizationType)) return null;
  const organizationType = type as VerifiedOrganizationType;
  return {
    tenantId: profileTenant.id,
    tenantSlug,
    name,
    logoUrl: safeInstitutionLogo(values?.logo_url),
    organizationType,
    organizationTypeLabel: organizationTypeLabel(organizationType, record(profile.ui)),
    isMunicipal: organizationType === 'municipio' || organizationType === 'gobierno',
  };
}
