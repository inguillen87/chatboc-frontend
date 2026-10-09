import type { NativeAdminLegacyMembership, NativeAdminTenant } from '@/components/admin/platform/nativeAdminLegacyMembership';

export const syntheticMembershipTenant: NativeAdminTenant = { id: 22, slug: 'synthetic-municipality', nombre: 'Organización de prueba' };
export const syntheticMembershipRequestId = '12345678-1234-4567-89ab-123456789abc';

export const syntheticMembership = (tenant = syntheticMembershipTenant): NativeAdminLegacyMembership => ({
  contract_version: 'native_admin.legacy_membership.v1',
  tenant,
  target: { id: 77, name: 'Administrador de prueba', email: 'admin@example.invalid', role: 'admin_municipio',
    tipo_chat: 'municipio', tenant_id: tenant.id, tenant_slug: tenant.slug, auth_provider: 'native' },
  state: 'needs_normalization', can_apply: true, reason_code: 'ready',
  relation: { field: 'municipio_id', current_owner_reference: 77, expected_owner_reference: 20, is_tenant_owner: false },
  expected_revision: 'a'.repeat(64),
  permissions: { can_read: true, can_normalize_legacy_reference: true, credentials_change_allowed: false, membership_change_allowed: false },
  credentials_changed: false, provider_calls_performed: false,
});

export const syntheticMembershipList = (tenant = syntheticMembershipTenant) => ({
  contract_version: 'native_admin.legacy_membership_list.v1', tenant, items: [syntheticMembership(tenant)],
  permissions: { can_read: true, credentials_change_allowed: false, membership_change_allowed: false },
  credentials_changed: false, provider_calls_performed: false,
});

export const syntheticMembershipApplied = (review = syntheticMembership(), requestId = syntheticMembershipRequestId) => ({
  ...review, state: 'already_consistent' as const, can_apply: false, reason_code: 'already_consistent', expected_revision: 'b'.repeat(64),
  relation: { ...review.relation, current_owner_reference: review.relation.expected_owner_reference },
  permissions: { ...review.permissions, can_normalize_legacy_reference: false },
  action_receipt: { request_id: requestId, target_user_id: review.target.id, tenant_id: review.tenant.id,
    old_reference: review.relation.current_owner_reference, new_reference: review.relation.expected_owner_reference,
    applied: true, revision: 'b'.repeat(64) },
});
