import { normalizeProfileTenantSlug } from './profileTenantAuthority';

export const PROFILE_SECTION_IDS = ['general','identity','location','hours','channels','plan-security'] as const;
export type ProfileSectionId = typeof PROFILE_SECTION_IDS[number];
export interface OrganizationWorkspace {
  contract_version: 'organization.profile_workspace.v1';
  tenant: { id: number; slug: string };
  organization_type: string; organization_label: string; heading: string; description: string;
  sections: { id: ProfileSectionId; label: string; description: string }[];
  continuity: { preserve_existing_account: true; whatsapp_registration_present: boolean; note: string };
  domain_note: string;
}
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 320): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Read-only presentation. Never infer plan or editing permission from these fields. */
export function readOrganizationWorkspace(value: unknown, tenantSlug?: string | null): OrganizationWorkspace | null {
  const scope = normalizeProfileTenantSlug(tenantSlug);
  if (!scope || !record(value) || value.contract_version !== 'organization.profile_workspace.v1'
    || !record(value.tenant) || normalizeProfileTenantSlug(value.tenant.slug) !== scope
    || !Number.isSafeInteger(value.tenant.id) || value.tenant.id < 1
    || value.writes_performed !== false || value.provider_calls_performed !== false) return null;
  if (!['municipio','gobierno','colegio','empresa','pyme','organizacion'].includes(value.organization_type)
    || !text(value.organization_label,80) || !text(value.heading,120) || !text(value.description)
    || !text(value.domain_note)) return null;
  const c = value.continuity;
  if (!record(c) || c.preserve_existing_account !== true || typeof c.whatsapp_registration_present !== 'boolean' || !text(c.note)) return null;
  if (!Array.isArray(value.sections) || value.sections.length !== PROFILE_SECTION_IDS.length
    || value.sections.some((s: unknown) => !record(s) || !PROFILE_SECTION_IDS.includes(s.id)
      || !text(s.label,100) || !text(s.description))) return null;
  if (new Set(value.sections.map(s => s.id)).size !== PROFILE_SECTION_IDS.length) return null;
  // Project only fields used by the UI. Ignore any injected role/plan/write metadata.
  return {
    contract_version: 'organization.profile_workspace.v1', tenant: {id:value.tenant.id,slug:scope},
    organization_type:value.organization_type,organization_label:value.organization_label,
    heading:value.heading, description:value.description, domain_note:value.domain_note,
    continuity: {preserve_existing_account:true,whatsapp_registration_present:c.whatsapp_registration_present,note:c.note},
    sections:value.sections.map(s => ({id:s.id,label:s.label,description:s.description})),
  };
}
