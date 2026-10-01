import { ApiError, apiFetch } from '@/utils/api';
import { panelReadOptions } from '@/utils/panelReadOptions';
import { hasRequiredRole } from '@/utils/roles';

export interface NativeAdminTenant { id: number; slug: string; nombre?: string }
export interface NativeAdminLegacyMembership {
  contract_version: 'native_admin.legacy_membership.v1';
  tenant: NativeAdminTenant;
  target: { id: number; name: string; email: string; role: string; tipo_chat: string; tenant_id: number; tenant_slug: string; auth_provider: 'native' };
  state: 'needs_normalization' | 'already_consistent' | 'blocked';
  can_apply: boolean;
  reason_code: string;
  relation: { field: 'municipio_id'; current_owner_reference: number | null; expected_owner_reference: number | null; is_tenant_owner: boolean };
  expected_revision: string;
  permissions: { can_read: true; can_normalize_legacy_reference: boolean; credentials_change_allowed: false; membership_change_allowed: false };
  credentials_changed: false;
  provider_calls_performed: false;
}
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const optionalReference = (value: unknown) => value === null || positiveId(value);
const revision = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid4 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const invalid = () => new ApiError('No pudimos verificar la vinculación de este administrador.', 502);
const pathFor = (tenant: NativeAdminTenant) => {
  if (!positiveId(tenant.id) || !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(tenant.slug)) throw invalid();
  return `/api/admin/tenants/${encodeURIComponent(tenant.slug)}/native-admin-users`;
};
const matchesTenant = (value: unknown, tenant: NativeAdminTenant) => {
  const raw = record(value);
  return raw.id === tenant.id && raw.slug === tenant.slug;
};

export const readNativeAdminLegacyMembership = (value: unknown, tenant: NativeAdminTenant, userId?: number): NativeAdminLegacyMembership => {
  const raw = record(value), target = record(raw.target), relation = record(raw.relation), permissions = record(raw.permissions);
  const knownState = ['needs_normalization', 'already_consistent', 'blocked'].includes(String(raw.state));
  if (raw.contract_version !== 'native_admin.legacy_membership.v1' || !matchesTenant(raw.tenant, tenant) ||
    !positiveId(target.id) || (userId !== undefined && target.id !== userId) ||
    target.tenant_id !== tenant.id || target.tenant_slug !== tenant.slug || target.auth_provider !== 'native' ||
    typeof target.name !== 'string' || typeof target.email !== 'string' || typeof target.role !== 'string' ||
    !hasRequiredRole(target.role, ['tenant_admin']) || target.tipo_chat !== 'municipio' ||
    !knownState || typeof raw.can_apply !== 'boolean' || typeof raw.reason_code !== 'string' || !revision(raw.expected_revision) ||
    relation.field !== 'municipio_id' || !optionalReference(relation.current_owner_reference) || !optionalReference(relation.expected_owner_reference) ||
    typeof relation.is_tenant_owner !== 'boolean' || permissions.can_read !== true ||
    permissions.can_normalize_legacy_reference !== raw.can_apply || permissions.credentials_change_allowed !== false || permissions.membership_change_allowed !== false ||
    raw.credentials_changed !== false || raw.provider_calls_performed !== false) throw invalid();
  if (raw.can_apply && (raw.state !== 'needs_normalization' || permissions.can_normalize_legacy_reference !== true ||
    relation.is_tenant_owner !== false || !positiveId(relation.expected_owner_reference) || relation.current_owner_reference !== target.id ||
    relation.current_owner_reference === relation.expected_owner_reference)) throw invalid();
  if (raw.state === 'already_consistent' && (raw.can_apply || relation.current_owner_reference !== relation.expected_owner_reference)) throw invalid();
  return raw as unknown as NativeAdminLegacyMembership;
};

export const listNativeAdminLegacyMemberships = async (tenant: NativeAdminTenant, isCurrent: () => boolean) => {
  const raw = record(await apiFetch<unknown>(`${pathFor(tenant)}/legacy-membership`, { ...panelReadOptions(tenant.slug), isCurrent }));
  const permissions = record(raw.permissions);
  if (raw.contract_version !== 'native_admin.legacy_membership_list.v1' || !matchesTenant(raw.tenant, tenant) || !Array.isArray(raw.items) ||
    permissions.can_read !== true || permissions.credentials_change_allowed !== false || permissions.membership_change_allowed !== false ||
    raw.credentials_changed !== false || raw.provider_calls_performed !== false) throw invalid();
  const items = raw.items.map(item => readNativeAdminLegacyMembership(item, tenant));
  if (items.some(item => item.relation.is_tenant_owner) || new Set(items.map(item => item.target.id)).size !== items.length) throw invalid();
  return items;
};
export const getNativeAdminLegacyMembership = async (tenant: NativeAdminTenant, userId: number, isCurrent: () => boolean) => {
  if (!positiveId(userId)) throw invalid();
  const raw = await apiFetch<unknown>(`${pathFor(tenant)}/${userId}/legacy-membership`, { ...panelReadOptions(tenant.slug), isCurrent });
  return readNativeAdminLegacyMembership(raw, tenant, userId);
};
export const applyNativeAdminLegacyMembership = async (review: NativeAdminLegacyMembership, requestId: string, isCurrent: () => boolean) => {
  const checked = readNativeAdminLegacyMembership(review, review.tenant, review.target.id);
  if (!checked.can_apply || !uuid4(requestId)) throw new ApiError('Esta vinculación no está habilitada para corregirse.', 409);
  const raw = record(await apiFetch<unknown>(`${pathFor(review.tenant)}/${review.target.id}/legacy-membership`, {
    ...panelReadOptions(review.tenant.slug), allowStartupRecovery: false, method: 'PUT',
    body: { expected_revision: review.expected_revision, request_id: requestId }, isCurrent,
  }));
  const updated = readNativeAdminLegacyMembership(raw, review.tenant, review.target.id), receipt = record(raw.action_receipt);
  if (updated.state !== 'already_consistent' || updated.can_apply || updated.target.role !== review.target.role ||
    updated.relation.current_owner_reference !== review.relation.expected_owner_reference ||
    updated.relation.expected_owner_reference !== review.relation.expected_owner_reference ||
    receipt.request_id !== requestId || receipt.target_user_id !== review.target.id || receipt.tenant_id !== review.tenant.id ||
    receipt.old_reference !== review.relation.current_owner_reference || receipt.new_reference !== review.relation.expected_owner_reference ||
    receipt.applied !== true || receipt.revision !== updated.expected_revision) throw invalid();
  return updated;
};
