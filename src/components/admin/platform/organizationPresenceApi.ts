import {apiFetch} from '@/utils/api';
import {assertPresenceIdentity, assertPresenceScope, parseOrganizationPresence, type PresenceIdentity} from './organizationPresence';
export async function readOrganizationPresence(identity: PresenceIdentity, current: () => boolean) {
  assertPresenceIdentity(identity);
  const ensureCurrent = () => { if (!current()) throw new Error('La consulta ya no pertenece al espacio activo.'); };
  ensureCurrent();
  const config = await apiFetch<unknown>(`/api/admin/tenants/${encodeURIComponent(identity.slug)}/config`, {
    tenantSlug: identity.slug, persistTenantSlug: false, preserveAuthOn401: true, suppressPanel401Redirect: true,
    omitEntityToken: true, omitChatSessionId: true,
  });
  ensureCurrent();
  const envelope = config && typeof config === 'object' && !Array.isArray(config) ? config as Record<string,unknown> : {};
  assertPresenceScope(envelope, identity);
  assertPresenceScope(envelope.tenant, identity, true);
  const published = await apiFetch<unknown>('/public/tenant', {
    tenantSlug: identity.slug, persistTenantSlug: false, skipAuth: true, omitCredentials: true,
    omitEntityToken: true, omitChatSessionId: true,
  });
  ensureCurrent();
  return parseOrganizationPresence(config, published, identity);
}
