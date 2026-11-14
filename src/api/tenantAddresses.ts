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
    activation?: AddressActivationCapabilities;
  };
  operator_ui?: AddressOperatorUI;
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

const isUnixTimestamp = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number.isFinite(new Date((value as number) * 1000).getTime());

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
    ? !isUnixTimestamp(slot.valid_until) || slot.valid_until <= nowSeconds
    : slot.valid_until !== null) {
    throw new TenantAddressesContractError();
  }

  let dnsProof: AddressDnsProof | null = null;
  if (slot.dns_proof !== null) {
    const proof = asRecord(slot.dns_proof);
    // El subdominio de la plataforma nunca pide un TXT al cliente.
    if (kind !== 'custom' || !host || proof.type !== 'TXT' || proof.name !== `_chatboc-verify.${host}` ||
      typeof proof.value !== 'string' || !/^chatboc-domain-verification=[0-9a-f]{64}$/.test(proof.value) ||
      !isUnixTimestamp(proof.expires_at)) {
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
  const activation = readActivationCapabilities(capabilities.activation);
  const operatorUI = readOperatorUI(value.operator_ui);

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
      ...(activation ? { activation } : {}),
    },
    ...(operatorUI ? { operator_ui: operatorUI } : {}),
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
  address_host_invalid: 'Revisá la dirección: sin https://, puerto ni ruta.',
  address_host_in_use: 'Esa dirección ya está en uso. Probá con otra.',
  address_pro_required: 'Esta dirección requiere el plan Pro o Full.',
  address_full_required: 'El dominio propio requiere el plan Full.',
  address_not_configured: 'La dirección no está configurada. Actualizá el estado antes de continuar.',
  address_dns_not_applicable: 'Esta dirección no requiere comprobar un registro TXT.',
  address_dns_request_expired: 'El plazo del registro TXT venció. Actualizá el estado antes de continuar.',
  address_not_found: 'No pudimos encontrar las direcciones de esta organización.',
  address_maintenance: 'Los cambios de direcciones están en pausa por mantenimiento. Probá más tarde.',
  address_rate_limited: 'Se hicieron varias solicitudes seguidas. Esperá antes de volver a intentarlo.',
  address_rate_storage_unavailable: 'No pudimos comprobar la disponibilidad para guardar. Actualizá el estado antes de continuar.',
  address_storage_invalid: 'No pudimos confirmar la configuración guardada. Actualizá el estado antes de continuar.',
  address_storage_conflict: 'La configuración necesita revisión. Actualizá el estado antes de continuar.',
  address_runtime_unavailable: 'La gestión de direcciones no está disponible por ahora. Actualizá el estado más tarde.',
  platform_alias_unavailable: 'Este alias no está disponible para la organización.',
};

/** Only an explicit v2 rejection proves that a failed PUT did not write. */
export function addressSaveRequiresStatusCheck(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  const body = asRecord(error.body);
  return body.contract_version !== 'organization.addresses_error.v2' || body.writes_performed !== false ||
    typeof body.reason_code !== 'string' || !REASON_CODE.test(body.reason_code) ||
    (body.requires_status_check !== undefined && body.requires_status_check !== false) || body.reason_code === 'address_save_unconfirmed' ||
    body.reason_code === 'address_revision_conflict' || body.reason_code === 'address_revision_required';
}

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
    if (!isCurrent()) throw new DOMException('Address scope changed', 'AbortError');
    const body = error instanceof ApiError ? asRecord(error.body) : {};
    if (error instanceof ApiError && error.status === 404 &&
      body.contract_version === 'shared.error.v1' && body.reason_code === 'not_found') {
      throw new TenantAddressesUnavailableError();
    }
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


export interface AddressActivationCapabilities {
  mode: 'platform_operator'; available: boolean; can_plan: boolean; can_activate: boolean;
  reason_code: string; provider_changes_supported: false;
}
export const ADDRESS_OPERATOR_LABELS = [
  'title', 'description', 'kind', 'platform', 'custom', 'advanced_title', 'advanced_description',
  'deployment', 'source', 'routes', 'reviewed_version', 'refresh', 'plan', 'review_title', 'tenant',
  'host', 'revision', 'digest', 'observed', 'expires', 'backend_source', 'confirm_title',
  'confirm_description', 'confirm', 'cancel', 'loading', 'planning', 'activating', 'active', 'plan_ready',
] as const;
export const ADDRESS_OPERATOR_MESSAGES = [
  'not_ready', 'descriptor_error', 'plan_error', 'activation_error', 'uncertain', 'expired',
  'input_invalid', 'descriptor_changed', 'platform_admin_required', 'operator_runtime_unavailable',
  'maintenance', 'not_pending', 'success',
] as const;
export interface AddressOperatorUI {
  contract_version: 'organization.address_operator_ui.v1';
  labels: Record<typeof ADDRESS_OPERATOR_LABELS[number], string>;
  messages: Record<typeof ADDRESS_OPERATOR_MESSAGES[number], string>;
}
export interface AddressActivationCandidate {
  frontend_deployment: string; frontend_source: string; routes_sha256: string;
}
export interface AddressActivationRequest extends AddressActivationCandidate {
  kind: AddressKind; expected_revision: string;
}
export interface AddressActivationPlan {
  contract_version: 'organization.address_activation_plan.v2';
  plan: {
    host: string; tenant_id: number; tenant_slug: string; kind: AddressKind; revision: string;
    valid_until: number; frontend_deployment: string; frontend_source: string; backend_source: string;
    routes_sha256: string; allowed_aliases: string[]; project_id: string;
  };
  plan_sha256: string; observed_at: number; valid_until: number;
  writes_performed: false; provider_changes_performed: false; auth_e2e_verified: false;
}
const SOURCE_REVISION = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;

function readActivationCapabilities(raw: unknown): AddressActivationCapabilities | undefined {
  const value = asRecord(raw);
  if (value.mode !== 'platform_operator' || value.provider_changes_supported !== false ||
    [value.available, value.can_plan, value.can_activate].some(flag => typeof flag !== 'boolean') ||
    typeof value.reason_code !== 'string' || !REASON_CODE.test(value.reason_code) ||
    (value.available === false && (value.can_plan === true || value.can_activate === true))) return undefined;
  return { mode: 'platform_operator', available: value.available as boolean,
    can_plan: value.can_plan as boolean, can_activate: value.can_activate as boolean,
    reason_code: value.reason_code, provider_changes_supported: false };
}
function readOperatorUI(raw: unknown): AddressOperatorUI | undefined {
  const value = asRecord(raw), labels = asRecord(value.labels), messages = asRecord(value.messages);
  if (value.contract_version !== 'organization.address_operator_ui.v1' ||
    !ADDRESS_OPERATOR_LABELS.every(key => isSafeCopy(labels[key]) && (labels[key] as string).trim()) ||
    !ADDRESS_OPERATOR_MESSAGES.every(key => isSafeCopy(messages[key]) && (messages[key] as string).trim())) return undefined;
  return { contract_version: 'organization.address_operator_ui.v1',
    labels: Object.fromEntries(ADDRESS_OPERATOR_LABELS.map(key => [key, labels[key]])) as AddressOperatorUI['labels'],
    messages: Object.fromEntries(ADDRESS_OPERATOR_MESSAGES.map(key => [key, messages[key]])) as AddressOperatorUI['messages'] };
}
export function normalizeAddressActivationCandidate(value: AddressActivationCandidate): AddressActivationCandidate | null {
  if (!value || typeof value.frontend_deployment !== 'string' || typeof value.frontend_source !== 'string' ||
    typeof value.routes_sha256 !== 'string') return null;
  const candidate = { frontend_deployment: value.frontend_deployment.trim(),
    frontend_source: value.frontend_source.trim(), routes_sha256: value.routes_sha256.trim() };
  return DEPLOYMENT_ID.test(candidate.frontend_deployment) && SOURCE_REVISION.test(candidate.frontend_source) &&
    REVISION.test(candidate.routes_sha256) ? candidate : null;
}
function activationRequest(scope: AddressTenantScope, current: TenantAddresses, kind: AddressKind,
  candidate: AddressActivationCandidate, action: 'plan' | 'activate', isCurrent: () => boolean): AddressActivationRequest {
  endpointFor(scope);
  const capability = current.capabilities.activation, normalized = normalizeAddressActivationCandidate(candidate);
  if ((kind !== 'platform' && kind !== 'custom') || !isCurrent() || current.tenant.id !== scope.id || current.tenant.slug !== scope.slug ||
    !REVISION.test(current.revision) || !normalized || current.capabilities.writes_blocked ||
    !capability?.available || capability.mode !== 'platform_operator' ||
    !(action === 'plan' ? capability.can_plan : capability.can_activate) ||
    current[kind]?.kind !== kind || current[kind].status !== 'pending_platform' || !current[kind].host ||
    !current.capabilities[kind].eligible) throw new TenantAddressesContractError();
  return { kind, expected_revision: current.revision, ...normalized };
}
export function readAddressActivationPlan(payload: unknown, scope: AddressTenantScope, current: TenantAddresses,
  request: AddressActivationRequest, nowSeconds = Date.now() / 1000): AddressActivationPlan {
  const value = asRecord(payload), plan = asRecord(value.plan);
  const slot = current[request.kind];
  if (value.contract_version !== 'organization.address_activation_plan.v2' ||
    value.writes_performed !== false || value.provider_changes_performed !== false || value.auth_e2e_verified !== false ||
    typeof value.plan_sha256 !== 'string' || !REVISION.test(value.plan_sha256) ||
    !isUnixTimestamp(value.observed_at) || !isUnixTimestamp(value.valid_until) ||
    value.observed_at >= value.valid_until || value.valid_until <= nowSeconds ||
    plan.tenant_id !== scope.id || plan.tenant_slug !== scope.slug || plan.kind !== request.kind ||
    current.tenant.id !== scope.id || current.tenant.slug !== scope.slug ||
    plan.revision !== current.revision || plan.revision !== request.expected_revision ||
    typeof plan.host !== 'string' || plan.host !== slot.host || normalizeTenantHostname(plan.host) !== plan.host ||
    !isUnixTimestamp(plan.valid_until) || plan.valid_until < value.valid_until ||
    plan.frontend_deployment !== request.frontend_deployment || plan.frontend_source !== request.frontend_source ||
    plan.routes_sha256 !== request.routes_sha256 || typeof plan.backend_source !== 'string' || !SOURCE_REVISION.test(plan.backend_source) ||
    typeof plan.project_id !== 'string' || !/^prj_[A-Za-z0-9]{8,128}$/.test(plan.project_id) ||
    !Array.isArray(plan.allowed_aliases) || plan.allowed_aliases.length > 32 ||
    plan.allowed_aliases.some(host => typeof host !== 'string' || normalizeTenantHostname(host) !== host)) {
    throw new TenantAddressesContractError();
  }
  return { contract_version: 'organization.address_activation_plan.v2',
    plan: { host: plan.host, tenant_id: scope.id, tenant_slug: scope.slug, kind: request.kind,
      revision: request.expected_revision, valid_until: plan.valid_until as number,
      ...normalizeAddressActivationCandidate(request)!, backend_source: plan.backend_source,
      project_id: plan.project_id, allowed_aliases: [...plan.allowed_aliases] as string[] },
    plan_sha256: value.plan_sha256, observed_at: value.observed_at as number, valid_until: value.valid_until as number,
    writes_performed: false, provider_changes_performed: false, auth_e2e_verified: false };
}
export async function planTenantAddressActivation(scope: AddressTenantScope, current: TenantAddresses,
  kind: AddressKind, candidate: AddressActivationCandidate, isCurrent: () => boolean): Promise<AddressActivationPlan> {
  const body = activationRequest(scope, current, kind, candidate, 'plan', isCurrent);
  const payload: unknown = await apiFetch<unknown>(endpointFor(scope) + '/activation-plan', {
    ...requestOptions(scope, isCurrent), sendEntityToken: false, method: 'POST', body,
  });
  if (!isCurrent()) throw new DOMException('Address scope changed', 'AbortError');
  return readAddressActivationPlan(payload, scope, current, body);
}
export async function activateTenantAddress(scope: AddressTenantScope, current: TenantAddresses,
  kind: AddressKind, candidate: AddressActivationCandidate, review: AddressActivationPlan,
  isCurrent: () => boolean): Promise<TenantAddresses> {
  const body = activationRequest(scope, current, kind, candidate, 'activate', isCurrent);
  const approved = readAddressActivationPlan(review, scope, current, body);
  const payload = asRecord(await apiFetch<unknown>(endpointFor(scope) + '/activate', {
    ...requestOptions(scope, isCurrent), sendEntityToken: false, method: 'POST',
    body: { ...body, approved_plan_sha256: approved.plan_sha256 },
  }));
  if (!isCurrent()) throw new DOMException('Address scope changed', 'AbortError');
  if (payload.contract_version !== 'organization.addresses_save.v2' || payload.saved !== true || payload.committed !== true ||
    payload.writes_performed !== true || payload.provider_changes_performed !== false ||
    payload.approved_plan_sha256 !== approved.plan_sha256) throw new TenantAddressesContractError();
  const addresses = readTenantAddresses(payload.addresses, scope);
  if (!addresses[kind].active || addresses[kind].status !== 'active' || addresses[kind].host !== approved.plan.host ||
    addresses.revision === current.revision) throw new TenantAddressesContractError();
  return addresses;
}

/** Reused generic recovery action already displayed by TenantAddressesSettings. */
export const TENANT_ADDRESSES_REFRESH_LABEL = 'Actualizar estado';
