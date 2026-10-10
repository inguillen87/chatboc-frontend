import { apiFetch, ApiError } from '@/utils/api';
import { exactInstitutionSlug } from '@/utils/publishedTenantIdentity';
import { normalizeTenantHostname } from '@/utils/tenantHostBinding';

export interface DomainTenantScope { id: number; slug: string }
export type TenantDomainStatus = 'unconfigured' | 'pending_dns' | 'pending_platform' | 'active' | 'revoked' | 'verification_expired';
export interface TenantDomainDescriptor {
  contract_version: 'organization.domain.v1'; tenant: DomainTenantScope;
  revision: string; version: number; host: string | null; status: TenantDomainStatus;
  active: boolean; can_edit: boolean; can_revoke: boolean; reason_code: string;
  dns_proof: null | { type: 'TXT'; name: string; value: string; expires_at: number };
  valid_until: number | null; save_endpoint: string;
  provider_changes_performed: false; scope_note: string;
}
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const statuses = new Set<TenantDomainStatus>(['unconfigured','pending_dns','pending_platform','active','revoked','verification_expired']);
const reasons = new Set(['ready','maintenance','tenant_admin_required','pro_plan_required']);
const hex = /^[0-9a-f]{64}$/;
const copy = (value: unknown): value is string => typeof value === 'string' && value.length <= 1000 && !/[\p{Cc}\p{Cf}]/u.test(value);
export class TenantDomainContractError extends Error { constructor() { super('No pudimos confirmar la configuración del dominio. Recargá antes de continuar.'); } }
function endpoint(scope: DomainTenantScope) {
  if (!Number.isSafeInteger(scope.id) || scope.id < 1 || exactInstitutionSlug(scope.slug) !== scope.slug) throw new TenantDomainContractError();
  return `/api/admin/tenants/${encodeURIComponent(scope.slug)}/domain`;
}
export function readTenantDomain(payload: unknown, scope: DomainTenantScope): TenantDomainDescriptor {
  const value = object(payload), tenant = object(value.tenant), proof = object(value.dns_proof);
  const path = endpoint(scope), host = value.host === null ? null : normalizeTenantHostname(value.host);
  const status = value.status as TenantDomainStatus;
  if (value.contract_version !== 'organization.domain.v1' || tenant.id !== scope.id || tenant.slug !== scope.slug ||
    !hex.test(value.revision) || !Number.isSafeInteger(value.version) || value.version < 0 || !statuses.has(status) ||
    (status === 'unconfigured' ? value.host !== null : !host || value.host !== host) ||
    typeof value.active !== 'boolean' || value.active !== (status === 'active') ||
    typeof value.can_edit !== 'boolean' || typeof value.can_revoke !== 'boolean' || !reasons.has(value.reason_code) ||
    (value.active ? !Number.isSafeInteger(value.valid_until) || value.valid_until <= Date.now()/1000 : value.valid_until !== null) ||
    value.save_endpoint !== path || value.provider_changes_performed !== false || !copy(value.scope_note)) throw new TenantDomainContractError();
  if (value.dns_proof !== null && (status !== 'pending_dns' || proof.type !== 'TXT' || proof.name !== `_chatboc-verify.${host}` ||
    !/^chatboc-domain-verification=[0-9a-f]{64}$/.test(proof.value) || !Number.isSafeInteger(proof.expires_at))) throw new TenantDomainContractError();
  return { contract_version:'organization.domain.v1', tenant:{...scope}, revision:value.revision, version:value.version, host, status,
    active:value.active,can_edit:value.can_edit,can_revoke:value.can_revoke,reason_code:value.reason_code,
    dns_proof:value.dns_proof === null ? null : {type:'TXT',name:proof.name,value:proof.value,expires_at:proof.expires_at},
    valid_until:value.valid_until,save_endpoint:path,provider_changes_performed:false,scope_note:value.scope_note };
}
const errors: Record<string,string> = {
  domain_forbidden:'Tu cuenta no puede gestionar el dominio de esta organización.',
  domain_pro_required:'Esta función requiere el plan Pro o Full.',
  domain_revision_conflict:'La configuración cambió. Recargá antes de guardar; tu dirección sigue en el formulario.',
  domain_revision_required:'Recargá para confirmar la versión actual antes de guardar.',
  host_in_use:'Ese dominio no está disponible para esta organización.',
  host_invalid:'Ingresá sólo el dominio completo, sin https://, puerto ni ruta.',
  domain_request_invalid:'Revisá la dirección y recargá la configuración antes de continuar.',
  domain_dns_not_verified:'Todavía no pudimos confirmar el TXT. Revisá el registro o esperá su propagación.',
  domain_revoke_required:'Primero desvinculá el dominio actual antes de solicitar otro.',
  domain_dns_unavailable:'No pudimos consultar el DNS. Podés reintentar sin perder la dirección.',
  domain_save_unconfirmed:'No pudimos confirmar el cambio. Recargá para revisar el estado antes de repetirlo.',
};
export function tenantDomainErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = object(error.body), reason = body.reason_code || body.reason || body.error;
    if (typeof reason === 'string' && errors[reason]) return errors[reason];
  }
  return error instanceof TenantDomainContractError ? error.message : 'No pudimos consultar o confirmar el dominio. Reintentá en unos minutos.';
}
function options(scope: DomainTenantScope, isCurrent: () => boolean) {
  return {tenantSlug:scope.slug,persistTenantSlug:false,isWidgetRequest:false,omitEntityToken:true,omitChatSessionId:true,singleAttempt:true,isCurrent};
}
export async function getTenantDomain(scope: DomainTenantScope, isCurrent: () => boolean) {
  const data = await apiFetch<unknown>(endpoint(scope), options(scope,isCurrent));
  if (!isCurrent()) throw new DOMException('Domain scope changed','AbortError');
  return readTenantDomain(data,scope);
}
export async function saveTenantDomain(scope: DomainTenantScope, current: TenantDomainDescriptor,
  operation: 'request' | 'verify_dns' | 'revoke', host: string | undefined, isCurrent: () => boolean) {
  readTenantDomain(current,scope);
  if (!isCurrent() || !hex.test(current.revision)) throw new TenantDomainContractError();
  const normalized = operation === 'request' ? normalizeTenantHostname(host) : null;
  if (operation === 'request' && !normalized) throw new TenantDomainContractError();
  const data = object(await apiFetch<unknown>(endpoint(scope),{...options(scope,isCurrent),method:'PUT',
    body:{expected_revision:current.revision,operation,...(normalized?{host:normalized}:{})}}));
  if (!isCurrent()) throw new DOMException('Domain scope changed','AbortError');
  if (data.contract_version !== 'organization.domain_save.v1' || data.saved !== true) throw new TenantDomainContractError();
  return readTenantDomain(data.domain,scope);
}
