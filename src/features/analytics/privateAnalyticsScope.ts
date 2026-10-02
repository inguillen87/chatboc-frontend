import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/constants/tenant';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { exactInstitutionSlug } from '@/utils/publishedTenantIdentity';
import { readAuthenticatedPrivateTenantSlug } from '@/utils/privateWorkspaceIdentity';
import { isBackofficeRole, normalizeRole } from '@/utils/roles';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const positiveId = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
export interface PrivateAnalyticsScope { tenantSlug: string; tenantId: number | null; kind: 'municipio' | 'pyme' | null; scopeKey: string }
/** A URL selects a scope, but never establishes authority. Public context is metadata only. */
export function resolvePrivateAnalyticsScope(input: { user: unknown; verified: boolean; profileVerified: boolean; pathname: string; search: string; tenant?: unknown; tenantPending?: boolean; tenantError?: unknown }): PrivateAnalyticsScope | null {
  const user = record(input.user), role = typeof user.rol === 'string' ? user.rol : typeof user.role === 'string' ? user.role : '';
  if (!input.verified || !input.profileVerified || !isBackofficeRole(role)) return null;
  let segments: string[];
  try { segments = input.pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some(value => /[\p{Cc}\p{Cf}\\/]/u.test(value))) return null;
  const pathSelection = TENANT_ROUTE_PREFIXES.includes(segments[0]?.toLowerCase() as typeof TENANT_ROUTE_PREFIXES[number]) ? segments[1] : undefined;
  const query = new URLSearchParams(input.search);
  const supplied = [pathSelection, ...['tenant', 'tenant_slug', 'tenantSlug', 'endpoint'].flatMap(key => query.getAll(key))].filter(value => value !== undefined);
  const selections = supplied.map(exactInstitutionSlug);
  if (selections.some(slug => !slug || TENANT_PLACEHOLDER_SLUGS.has(slug)) || new Set(selections).size > 1) return null;
  const explicit = selections[0] || null, platform = normalizeRole(role) === 'superadmin';
  const actorTenant = readAuthenticatedPrivateTenantSlug(user);
  const tenantSlug = platform ? explicit : actorTenant;
  if (!tenantSlug || (!platform && explicit && explicit !== actorTenant)) return null;
  const tenant = record(input.tenant), matchingMetadata = exactInstitutionSlug(tenant.slug) === tenantSlug;
  if (platform && (input.tenantPending || input.tenantError || !matchingMetadata)) return null;
  const profile = record(user.organization_profile), profileTenant = record(profile.tenant), activationTenant = record(record(user.channel_activation).tenant);
  const privateIds = [record(user.tenant).id, user.tenant_id,
    ...(exactInstitutionSlug(profileTenant.slug) === tenantSlug ? [profileTenant.id] : []),
    ...(exactInstitutionSlug(activationTenant.slug) === tenantSlug ? [activationTenant.id] : [])].filter(value => value !== undefined && value !== null);
  const ids = (platform ? [] : privateIds).map(positiveId);
  if (ids.some(id => id === null) || new Set(ids).size > 1) return null;
  const tenantId = ids[0] ?? (matchingMetadata ? positiveId(tenant.id) : null);
  if (query.getAll('tenant_id').some(value => positiveId(value) === null || positiveId(value) !== tenantId)) return null;
  const rawKind = platform ? tenant.tipo : user.tipo_chat;
  const kind = rawKind === 'municipio' || rawKind === 'municipal' ? 'municipio' : rawKind === 'pyme' ? 'pyme' : null;
  const scopeKey = buildVerifiedSessionScopeKey({ hasVerifiedSession: true, tenantSlug, user });
  return scopeKey ? { tenantSlug, tenantId, kind, scopeKey } : null;
}
