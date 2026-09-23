import { readOrganizationProfile } from './organizationProfileSettings';
import { readOrganizationWorkspace } from './organizationWorkspace';
import { normalizeProfileTenantSlug, readExplicitTenantRequest } from './profileTenantAuthority';
import { isBackofficeRole } from './roles';
import { TENANT_ROUTE_PREFIXES } from './tenantPaths';

export interface AdminOrganizationIdentity { tenantId: number; tenantSlug: string; name: string; label: string; logoUrl: string | null }
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const plainText = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 500 && !/[\p{Cc}\p{Cf}]/u.test(value);
const workspacePath = /^\/(?:perfil|implementacion|tickets|reclamos|inbox|pedidos|usuarios|empleados|notificaciones|analytics|estadisticas|enterprise|bot-settings|chatcrm|integracion|logs|surveys|catalog-mappings|crm|municipal)(?:\/|$)|^\/admin\/(?:encuestas|catalog|pyme)(?:\/|$)|^\/pyme\/(?:catalog|metrics)(?:\/|$)/i;

function safeLogo(value: string): string | null {
  if (!value || /[\p{Cc}\p{Cf}\\]/u.test(value) || value.startsWith('//')) return null;
  try {
    const url = new URL(value, 'https://local.invalid');
    return (url.protocol === 'https:' && !url.username && !url.password && (value.startsWith('/') || /^https:\/\//i.test(value))) ? value : null;
  } catch { return null; }
}

/** Display identity only on private workspaces and only for matching authenticated contracts. */
export function readAdminOrganizationIdentity(user: unknown, tenantSlug: string | null | undefined,
  pathname: string, search: string, verified: boolean): AdminOrganizationIdentity | null {
  if (!verified || !record(user) || !isBackofficeRole(user.rol || user.role)) return null;
  const sessionSlug = normalizeProfileTenantSlug(user.tenant_slug || user.tenantSlug || user.tenant?.slug);
  if (!sessionSlug || normalizeProfileTenantSlug(tenantSlug) !== sessionSlug) return null;
  const explicit = readExplicitTenantRequest(new URLSearchParams(search));
  if (!explicit.valid || (explicit.present && explicit.slug !== sessionSlug)) return null;
  let path = pathname;
  const segments = pathname.split('/').filter(Boolean);
  if (TENANT_ROUTE_PREFIXES.includes(segments[0]?.toLowerCase() as typeof TENANT_ROUTE_PREFIXES[number]) && segments.length > 2) {
    // /pyme/catalog and municipal tools are global workspaces, not tenant prefixes.
    if (segments[0] !== 'pyme' || !['catalog', 'metrics'].includes(segments[1])) {
      let routeSlug: string;
      try { routeSlug = decodeURIComponent(segments[1]); } catch { return null; }
      if (routeSlug.toLowerCase() !== sessionSlug) return null;
      path = `/${segments.slice(2).join('/')}`;
    }
  }
  if (!workspacePath.test(path) || /^\/reclamos\/nuevo\/?$/i.test(path)) return null;
  const profile = readOrganizationProfile(user.organization_profile, sessionSlug);
  const workspace = readOrganizationWorkspace(user.organization_workspace, sessionSlug);
  if (!profile || !workspace || profile.tenant.id !== workspace.tenant.id || !plainText(profile.values.nombre_empresa) || !plainText(workspace.organization_label)) return null;
  return { tenantId: profile.tenant.id, tenantSlug: sessionSlug, name: profile.values.nombre_empresa,
    label: workspace.organization_label, logoUrl: safeLogo(profile.values.logo_url) };
}
