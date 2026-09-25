import {normalizeRole} from './roles';
import {TENANT_PLACEHOLDER_SLUGS} from '@/constants/tenant';
import type {PanelLoginResponse} from '@/api/panelLogin';

export class PanelLoginBoundaryError extends Error {
  constructor(public readonly code: 'invalid_response' | 'organization_mismatch' | 'invalid_route') {
    super(code === 'organization_mismatch'
      ? 'Esta cuenta pertenece a otra organización. Ingresá desde el acceso central de ChatBoc.'
      : code === 'invalid_route' ? 'La dirección de acceso no es válida.'
      : 'El servicio no devolvió una sesión verificable. No se cambió la cuenta activa.');
    this.name = 'PanelLoginBoundaryError';
  }
}
const object = (value: unknown): Record<string,unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
export function normalizedLoginTenant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase();
  return slug.length <= 128 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) && !TENANT_PLACEHOLDER_SLUGS.has(slug) ? slug : null;
}
export function validatePanelLoginResponse(raw: unknown, email: string, requestedTenant: string | null): PanelLoginResponse {
  const data=object(raw), user=object(data.user), nested=object(user.tenant);
  const reject=(): never => { throw new PanelLoginBoundaryError('invalid_response'); };
  if (typeof data.token !== 'string' || !data.token.trim() || /\s/.test(data.token) || data.token.length>16384) reject();
  if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id<1) reject();
  if (typeof user.email !== 'string' || user.email.trim().toLowerCase() !== email.trim().toLowerCase()) reject();
  const roles=[user.rol,user.role].filter(value=>value!==undefined&&value!==null);
  if (!roles.length || roles.some(value=>typeof value!=='string'||!normalizeRole(value))) reject();
  if (new Set(roles.map(value=>normalizeRole(value as string))).size!==1) reject();
  const role=normalizeRole(roles[0] as string);
  if (!['tenant_admin','employee','catalog_manager','analytics_viewer','superadmin'].includes(role)) reject();
  const tenants=[user.tenant_slug,user.tenantSlug,nested.slug,nested.tenant_slug,data.tenant_slug]
    .filter(value=>value!==undefined&&value!==null);
  if (tenants.some(value=>!normalizedLoginTenant(value))) reject();
  const slugs=[...new Set(tenants.map(normalizedLoginTenant))];
  if (slugs.length>1 || (role!=='superadmin'&&slugs.length!==1)) reject();
  const slug=slugs[0]||null;
  if (requestedTenant && slug!==requestedTenant) throw new PanelLoginBoundaryError('organization_mismatch');
  if (data.entityToken!=null && (typeof data.entityToken!=='string'||/\s/.test(data.entityToken))) reject();
  return {...data,user:{...user,rol:roles[0],...(slug?{tenant_slug:slug}:{})}} as unknown as PanelLoginResponse;
}
