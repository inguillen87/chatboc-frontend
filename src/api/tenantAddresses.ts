import { apiFetch, ApiError } from '@/utils/api';
import { exactInstitutionSlug } from '@/utils/publishedTenantIdentity';
import { normalizeTenantHostname } from '@/utils/tenantHostBinding';

/**
 * Cliente del contrato `organization.addresses.v2`: las tres direcciones de una
 * organización (enlace base, subdominio de la plataforma y dominio propio).
 *
 * Todo lo que la pantalla muestra o habilita sale de la respuesta del servidor:
 * acá no se deduce el plan ni se considera activa una dirección por su nombre.
 */

export interface AddressTenantScope { id: number; slug: string }
export type AddressKind = 'platform' | 'custom';
export type AddressOperation = 'request' | 'verify_dns' | 'revoke';
export type AddressStatus =
  | 'unconfigured' | 'pending_dns' | 'pending_platform' | 'active'
  | 'revoked' | 'verification_expired' | 'suspended';

export interface AddressDnsProof { type: 'TXT'; name: string; value: string; expires_at: number }

export interface AddressSlot {
  kind: AddressKind;
  source: null | 'v2' | 'legacy_v1';
  host: string | null;
  status: AddressStatus;
  active: boolean;
  valid_until: number | null;
  dns_proof: AddressDnsProof | null;
  scope_note: string;
}

export interface AddressSlotCapabilities {
  eligible: boolean;
  can_request: boolean;
  can_verify_dns: boolean;
  can_revoke: boolean;
  reason_code: string;
}

export interface TenantAddresses {
  contract_version: 'organization.addresses.v2';
  tenant: AddressTenantScope;
  revision: string;
  version: number;
  base: { url: string; available: boolean };
  canonical_url: string;
  platform: AddressSlot;
  custom: AddressSlot;
  capabilities: {
    can_manage: boolean;
    writes_blocked: boolean;
    platform: AddressSlotCapabilities;
    custom: AddressSlotCapabilities;
  };
}

/** El servidor todavía no publica este contrato: la pantalla usa la versión anterior. */
export class TenantAddressesUnavailableError extends Error {
  constructor() { super('tenant_addresses_unavailable'); this.name = 'TenantAddressesUnavailableError'; }
}

export class TenantAddressesContractError extends Error {
  constructor() {
    super('No pudimos confirmar las direcciones de la organización. Recargá antes de continuar.');
    this.name = 'TenantAddressesContractError';
  }
}

const STATUSES = new Set<AddressStatus>([
  'unconfigured', 'pending_dns', 'pending_platform', 'active', 'revoked', 'verification_expired', 'suspended',
]);
const SOURCES = new Set([null, 'v2', 'legacy_v1']);
const REVISION = /^[0-9a-f]{64}$/;
const REASON_CODE = /^[a-z][a-z0-9_]{0,63}$/;
const PLATFORM_LABEL = /^[a-z0-9-]{3,40}$/;
export const PLATFORM_SUFFIX = '.chatboc.ar';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const isSafeCopy = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 1000 && !/[\p{Cc}\p{Cf}]/u.test(value);

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};

function endpointFor(scope: AddressTenantScope): string {
  if (!Number.isSafeInteger(scope.id) || scope.id < 1 || exactInstitutionSlug(scope.slug) !== scope.slug) {
    throw new TenantAddressesContractError();
  }
  return `/api/admin/tenants/${encodeURIComponent(scope.slug)}/addresses`;
}

function readSlot(raw: unknown, kind: AddressKind, nowSeconds: number): AddressSlot {
  const slot = asRecord(raw);
  const status = slot.status as AddressStatus;
  const source = slot.source as AddressSlot['source'];
  const host = slot.host === null ? null : normalizeTenantHostname(slot.host);

  if (slot.kind !== kind || !STATUSES.has(status) || !SOURCES.has(source) || !isSafeCopy(slot.scope_note)) {
    throw new TenantAddressesContractError();
  }
  // Sin configurar no trae dirección; cualquier otro estado trae una, ya normalizada.
  if (status === 'unconfigured' ? slot.host !== null : !host || slot.host !== host) {
    throw new TenantAddressesContractError();
  }
  // "Activa" sólo vale si el estado lo dice y la vigencia informada no venció.
  if (typeof slot.active !== 'boolean' || (slot.active && status !== 'active')) {
    throw new TenantAddressesContractError();
  }
  if (slot.active
    ? !Number.isSafeInteger(slot.valid_until) || (slot.valid_until as number) <= nowSeconds
    : slot.valid_until !== null) {
    throw new TenantAddressesContractError();
  }

  let dnsProof: AddressDnsProof | null = null;
  if (slot.dns_proof !== null) {
    const proof = asRecord(slot.dns_proof);
    // El subdominio de la plataforma nunca pide un TXT al cliente.
    if (kind !== 'custom' || !host || proof.type !== 'TXT' || proof.name !== `_chatboc-verify.${host}` ||
      typeof proof.value !== 'string' || !/^chatboc-domain-verification=[0-9a-f]{64}$/.test(proof.value) ||
      !Number.isSafeInteger(proof.expires_at)) {
      throw new TenantAddressesContractError();
    }
    dnsProof = { type: 'TXT', name: proof.name, value: proof.value, expires_at: proof.expires_at as number };
  }

  return {
    kind, source, host, status, active: slot.active,
    valid_until: slot.valid_until as number | null,
    dns_proof: dnsProof, scope_note: slot.scope_note,
  };
}

function readSlotCapabilities(raw: unknown): AddressSlotCapabilities {
  const value = asRecord(raw);
  const flags = [value.eligible, value.can_request, value.can_verify_dns, value.can_revoke];
  if (flags.some(flag => typeof flag !== 'boolean') || typeof value.reason_code !== 'string' || !REASON_CODE.test(value.reason_code)) {
    throw new TenantAddressesContractError();
  }
  return {
    eligible: value.eligible as boolean,
    can_request: value.can_request as boolean,
    can_verify_dns: value.can_verify_dns as boolean,
    can_revoke: value.can_revoke as boolean,
    reason_code: value.reason_code,
  };
}

export function readTenantAddresses(payload: unknown, scope: AddressTenantScope, nowSeconds = Date.now() / 1000): TenantAddresses {
  const value = asRecord(payload);
  const tenant = asRecord(value.tenant);
  const base = asRecord(value.base);
  const capabilities = asRecord(value.capabilities);
  const path = endpointFor(scope);

  if (value.contract_version !== 'organization.addresses.v2' || tenant.id !== scope.id || tenant.slug !== scope.slug ||
    typeof value.revision !== 'string' || !REVISION.test(value.revision) ||
    !Number.isSafeInteger(value.version) || (value.version as number) < 0 ||
    !isHttpsUrl(base.url) || typeof base.available !== 'boolean' || !isHttpsUrl(value.canonical_url) ||
    typeof capabilities.can_manage !== 'boolean' || typeof capabilities.writes_blocked !== 'boolean' ||
    value.save_endpoint !== path || value.provider_changes_performed !== false) {
    throw new TenantAddressesContractError();
  }

  return {
    contract_version: 'organization.addresses.v2',
    tenant: { ...scope },
    revision: value.revision,
    version: value.version as number,
    base: { url: base.url, available: base.available },
    canonical_url: value.canonical_url,
    platform: readSlot(value.platform, 'platform', nowSeconds),
    custom: readSlot(value.custom, 'custom', nowSeconds),
    capabilities: {
      can_manage: capabilities.can_manage,
      writes_blocked: capabilities.writes_blocked,
      platform: readSlotCapabilities(capabilities.platform),
      custom: readSlotCapabilities(capabilities.custom),
    },
  };
}

/** Convierte lo que escribe la persona en la dirección exacta que se envía. */
export function normalizeAddressDraft(kind: AddressKind, draft: string): string | null {
  const text = draft.trim().toLowerCase();
  if (kind === 'platform') {
    const label = text.endsWith(PLATFORM_SUFFIX) ? text.slice(0, -PLATFORM_SUFFIX.length) : text;
    if (!PLATFORM_LABEL.test(label) || label.startsWith('-') || label.endsWith('-')) return null;
    return `${label}${PLATFORM_SUFFIX}`;
  }
  const host = normalizeTenantHostname(text);
  // Un dominio propio no puede ser una dirección de la plataforma.
  if (!host || host === PLATFORM_SUFFIX.slice(1) || host.endsWith(PLATFORM_SUFFIX)) return null;
  return host;
}

const ERROR_MESSAGES: Record<string, string> = {
  address_forbidden: 'Tu cuenta no puede gestionar las direcciones de esta organización.',
  tenant_admin_required: 'Sólo un administrador de la organización puede cambiar las direcciones.',
  plan_required: 'El plan actual de la organización no incluye esta dirección.',
  pro_plan_required: 'Esta dirección requiere el plan Pro o Full.',
  full_plan_required: 'El dominio propio requiere el plan Full.',
  maintenance: 'Los cambios de direcciones están en pausa por mantenimiento. Probá más tarde.',
  writes_blocked: 'Los cambios de direcciones están en pausa. Probá más tarde.',
  address_revision_conflict: 'Las direcciones cambiaron mientras editabas. Recargá antes de guardar; lo que escribiste sigue en el formulario.',
  address_revision_required: 'Recargá para confirmar el estado actual antes de guardar.',
  host_in_use: 'Esa dirección ya está en uso. Probá con otra.',
  host_reserved: 'Ese nombre está reservado. Probá con otro.',
  host_invalid: 'Revisá la dirección: sin https://, puerto ni ruta.',
  address_request_invalid: 'Revisá la dirección y recargá antes de continuar.',
  address_dns_not_verified: 'Todavía no pudimos confirmar el registro TXT. Revisalo o esperá a que se propague.',
  address_dns_unavailable: 'No pudimos consultar el DNS. Podés reintentar sin perder la dirección.',
  address_revoke_required: 'Primero desvinculá la dirección actual antes de pedir otra.',
  address_save_unconfirmed: 'No pudimos confirmar el cambio. Recargá para revisar el estado antes de repetirlo.',
};

export function tenantAddressesErrorMessage(error: unknown): string {
  if (error instanceof TenantAddressesContractError) return error.message;
  if (error instanceof ApiError) {
    const reason = asRecord(error.body).reason_code;
    if (typeof reason === 'string' && ERROR_MESSAGES[reason]) return ERROR_MESSAGES[reason];
  }
  return 'No pudimos consultar o confirmar las direcciones. Reintentá en unos minutos.';
}

/** Texto para una dirección que el servidor no deja pedir. Nunca inventa el motivo. */
export function addressUnavailableReason(capabilities: AddressSlotCapabilities): string {
  return ERROR_MESSAGES[capabilities.reason_code] ?? 'Esta dirección no está disponible para la organización por ahora.';
}

function requestOptions(scope: AddressTenantScope, isCurrent: () => boolean) {
  // El contrato identifica a la organización por la ruta y rechaza parámetros
  // de consulta: se mantiene el transporte autenticado del panel sin alias.
  return {
    tenantSlug: scope.slug, omitTenant: true,
    headers: { 'X-Tenant': scope.slug, 'X-Tenant-Slug': scope.slug },
    persistTenantSlug: false, isWidgetRequest: false, omitEntityToken: true,
    omitChatSessionId: true, singleAttempt: true, isCurrent,
  };
}

export async function getTenantAddresses(scope: AddressTenantScope, isCurrent: () => boolean): Promise<TenantAddresses> {
  let data: unknown;
  try {
    data = await apiFetch<unknown>(endpointFor(scope), requestOptions(scope, isCurrent));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new TenantAddressesUnavailableError();
    throw error;
  }
  if (!isCurrent()) throw new DOMException('Address scope changed', 'AbortError');
  return readTenantAddresses(data, scope);
}

export async function saveTenantAddress(
  scope: AddressTenantScope,
  current: TenantAddresses,
  kind: AddressKind,
  operation: AddressOperation,
  draft: string | undefined,
  isCurrent: () => boolean,
): Promise<TenantAddresses> {
  if (!isCurrent() || current.tenant.id !== scope.id || current.tenant.slug !== scope.slug || !REVISION.test(current.revision)) {
    throw new TenantAddressesContractError();
  }
  if (operation === 'verify_dns' && kind !== 'custom') throw new TenantAddressesContractError();
  const host = operation === 'request' ? normalizeAddressDraft(kind, draft ?? '') : null;
  if (operation === 'request' && !host) throw new TenantAddressesContractError();

  const response = asRecord(await apiFetch<unknown>(endpointFor(scope), {
    ...requestOptions(scope, isCurrent),
    method: 'PUT',
    body: { expected_revision: current.revision, kind, operation, ...(host ? { host } : {}) },
  }));
  if (!isCurrent()) throw new DOMException('Address scope changed', 'AbortError');
  if (response.contract_version !== 'organization.addresses_save.v2' || response.saved !== true ||
    response.provider_changes_performed !== false) {
    throw new TenantAddressesContractError();
  }
  return readTenantAddresses(response.addresses, scope);
}
