import { apiFetch } from '@/utils/api';
import { panelReadOptions } from '@/utils/panelReadOptions';

export const META_CREDENTIAL_CONTRACT = 'chatboc.meta_credential_operation.v1' as const;
export const META_CREDENTIAL_TARGETS = ['junin-production', 'tdf-sandbox'] as const;
export type MetaCredentialTarget = typeof META_CREDENTIAL_TARGETS[number];
type RecordValue = Record<string, unknown>;
type RequestScope = { isCurrent: () => boolean; signal?: AbortSignal };

export interface MetaCredentialStatus {
  target: MetaCredentialTarget;
  label: string;
  tenantId: number;
  tenantSlug: string;
  environment: string;
  appId: string;
  wabaId: string;
  phoneNumberId: string;
  phoneNumber: string;
  expectedRevision: number;
  currentRevision: number | null;
  writerEpoch: number | null;
  operationAvailable: boolean;
  lastPlanSha256: string | null;
  expiresAt: number | null;
}

export interface MetaCredentialPlan {
  target: MetaCredentialTarget;
  tenantId: number;
  expectedRevision: number;
  nextRevision: number;
  writerEpoch: number;
  expiresAt: number;
  expirySource: string;
  databaseIdentitySha256: string;
  planSha256: string;
}

export interface MetaCredentialReceipt {
  target: MetaCredentialTarget;
  revision: number;
  expiresAt: number;
  planSha256: string;
}

export interface MetaConnectionInspection {
  checkedAt: number;
  validUntil: number;
  controlIdentified: boolean;
  configurationIncomplete: boolean;
}

export class MetaCredentialClientError extends Error {
  constructor(readonly reasonCode: string, readonly outcomeUnverified = false) {
    super(reasonCode);
    this.name = 'MetaCredentialClientError';
  }
}

const invalid = () => new MetaCredentialClientError('meta_credential_response_invalid');
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as RecordValue;
};
const text = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) throw invalid();
  return value;
};
const integer = (value: unknown, minimum = 0): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw invalid();
  return value;
};
const digest = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw invalid();
  return value;
};
const identifier = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[0-9]{5,32}$/.test(value)) throw invalid();
  return value;
};
const envelope = (value: unknown, target: MetaCredentialTarget): RecordValue => {
  const data = record(value);
  if (data.contract !== META_CREDENTIAL_CONTRACT || data.target !== target) throw invalid();
  return data;
};

export const parseMetaCredentialStatus = (value: unknown, target: MetaCredentialTarget): MetaCredentialStatus => {
  const data = envelope(value, target);
  if (typeof data.operation_available !== 'boolean' || data.provider !== 'meta' ||
      data.channel !== 'whatsapp' || data.writes_performed !== false) throw invalid();
  const lastOperation = data.last_operation == null ? null : record(data.last_operation);
  const phone = text(data.phone_number);
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) throw invalid();
  return {
    target, label: text(data.label), tenantId: integer(data.tenant_id, 1),
    tenantSlug: text(data.tenant_slug), environment: text(data.environment),
    appId: identifier(data.app_id), wabaId: identifier(data.waba_id),
    phoneNumberId: identifier(data.phone_number_id), phoneNumber: phone,
    expectedRevision: integer(data.expected_revision), currentRevision: data.current_revision == null ? null : integer(data.current_revision),
    writerEpoch: data.expected_writer_epoch == null ? null : integer(data.expected_writer_epoch, 1), operationAvailable: data.operation_available,
    lastPlanSha256: lastOperation === null ? null : digest(lastOperation.plan_sha256),
    expiresAt: data.expires_at == null ? null : integer(data.expires_at, 1),
  };
};

export const parseMetaCredentialPlan = (value: unknown, status: MetaCredentialStatus): MetaCredentialPlan => {
  const data = record(value);
  const plan = record(data.plan);
  const expiry = record(data.expiry);
  if (data.contract !== META_CREDENTIAL_CONTRACT || data.dry_run !== true ||
      data.writes_performed !== false || data.messages_sent !== false || data.provider_mutations !== false ||
      plan.target !== status.target || plan.tenant_id !== status.tenantId || plan.tenant_slug !== status.tenantSlug ||
      plan.app_id !== status.appId || plan.waba_id !== status.wabaId || plan.phone_number_id !== status.phoneNumberId ||
      plan.phone_number !== status.phoneNumber || plan.environment !== status.environment ||
      plan.provider !== 'meta' || plan.channel !== 'whatsapp' ||
      plan.expected_revision !== status.expectedRevision || plan.expected_writer_epoch !== status.writerEpoch ||
      plan.next_revision !== status.expectedRevision + 1 || expiry.expires_at !== plan.expires_at ||
      !['provider', 'local_policy'].includes(String(expiry.source))) throw invalid();
  const expiresAt = integer(plan.expires_at, 1);
  if (expiresAt <= Math.floor(Date.now() / 1000)) throw invalid();
  return {
    target: status.target, tenantId: status.tenantId,
    expectedRevision: status.expectedRevision, nextRevision: status.expectedRevision + 1,
    writerEpoch: integer(status.writerEpoch, 1), expiresAt,
    expirySource: text(expiry.source),
    databaseIdentitySha256: digest(plan.database_identity_sha256), planSha256: digest(data.plan_sha256),
  };
};

export const parseMetaCredentialReceipt = (value: unknown, plan: MetaCredentialPlan): MetaCredentialReceipt => {
  const data = envelope(value, plan.target);
  if (data.committed !== true || data.writes_performed !== true || data.messages_sent !== false ||
      data.provider_mutations !== false || data.environment_changes !== false ||
      data.tenant_id !== plan.tenantId || data.revision !== plan.nextRevision ||
      data.expires_at !== plan.expiresAt || data.plan_sha256 !== plan.planSha256) throw invalid();
  return { target: plan.target, revision: plan.nextRevision, expiresAt: plan.expiresAt, planSha256: plan.planSha256 };
};

export const metaCredentialsInstalled = (statuses: MetaCredentialStatus[]): boolean =>
  statuses.length === META_CREDENTIAL_TARGETS.length && META_CREDENTIAL_TARGETS.every(target => {
    const matches = statuses.filter(status => status.target === target);
    if (matches.length !== 1) return false;
    const status = matches[0];
    return !status.operationAvailable && status.currentRevision !== null &&
      status.currentRevision >= status.expectedRevision + 1 && status.expiresAt !== null &&
      status.expiresAt > Math.floor(Date.now() / 1000);
  });

// This projection can confirm access only. No raw Graph value, URL, digest,
// provider ID or server message survives into the component's result state.
export const parseMetaConnectionInspection = (value: unknown, statuses: MetaCredentialStatus[]): MetaConnectionInspection => {
  const data = record(value);
  if (!metaCredentialsInstalled(statuses) || data.contract !== 'chatboc.meta_phone_webhook_inspection.v1' ||
      data.target !== 'junin-production' || data.inspection_complete !== false || data.write_ready !== false ||
      data.writes_performed !== false || data.provider_mutations !== false || data.messages_sent !== false ||
      !Array.isArray(data.credentials) || data.credentials.length !== 2 ||
      !Array.isArray(data.resources) || data.resources.length !== 3 ||
      !Array.isArray(data.blockers) || data.blockers.some(code => typeof code !== 'string' ||
        !/^meta_inspection_[a-z_]{1,80}$/.test(code))) throw invalid();
  for (const code of ['meta_inspection_readback_contract_unverified', 'meta_inspection_rollback_contract_unverified',
    'meta_inspection_mutation_not_implemented']) if (!data.blockers.includes(code)) throw invalid();
  digest(data.database_identity_sha256);
  const observedAt = integer(data.observed_at, 1);
  const checkedAt = integer(data.checked_at, 1);
  const validUntil = integer(data.valid_until, 1);
  const now = Math.floor(Date.now() / 1000);
  if (observedAt > checkedAt || checkedAt > now + 5 || checkedAt >= validUntil ||
      validUntil <= now || validUntil > checkedAt + 60) throw invalid();
  const credentials = data.credentials.map(record);
  const resources = data.resources.map(record);
  if (new Set(resources.map(row => row.resource)).size !== 3 ||
      resources.some(row => !['junin', 'inmovar', 'tdf'].includes(String(row.resource)))) throw invalid();
  for (const status of statuses) {
    const matches = credentials.filter(row => row.target === status.target);
    if (matches.length !== 1) throw invalid();
    const credential = matches[0];
    if (credential.tenant_id !== status.tenantId || credential.environment !== status.environment ||
        credential.revision !== status.currentRevision || credential.expires_at !== status.expiresAt ||
        credential.authority_verified !== true || credential.inventory_complete !== true ||
        typeof credential.graph_version !== 'string' || !/^v[1-9][0-9]{0,2}\.0$/.test(credential.graph_version) ||
        validUntil > status.expiresAt!) throw invalid();
    integer(credential.connection_id, 1); integer(credential.sender_id, 1);
    digest(credential.inventory_sha256); digest(credential.subscriptions_sha256);
    const resource = resources.find(row => row.resource === (status.target === 'junin-production' ? 'junin' : 'tdf'))!;
    if (resource.phone_number_id !== status.phoneNumberId || resource.phone_number !== status.phoneNumber ||
        resource.waba_id !== status.wabaId || resource.graph_version !== credential.graph_version) throw invalid();
  }
  const control = resources.find(row => row.resource === 'inmovar')!;
  const primary = resources.find(row => row.resource === 'junin')!;
  if (control.waba_id !== primary.waba_id || control.graph_version !== primary.graph_version ||
      typeof control.phone_number !== 'string' || !/^\+[1-9][0-9]{7,14}$/.test(control.phone_number)) throw invalid();
  if (control.phone_number_id !== null) identifier(control.phone_number_id);
  const observedIds = resources.map(resource => resource.phone_number_id).filter(id => id !== null);
  if (new Set(observedIds).size !== observedIds.length || control.phone_number === primary.phone_number) throw invalid();
  let configurationIncomplete = false;
  for (const resource of resources) {
    const config = record(resource.configuration);
    const state = config.state;
    if (config.schema_verified !== false || !['candidate_shape', 'unknown_shape', 'missing', 'unavailable', 'not_requested'].includes(String(state))) throw invalid();
    if (state === 'not_requested' && (resource.resource !== 'inmovar' || resource.phone_number_id !== null)) throw invalid();
    if (resource.phone_number_id === null && state !== 'not_requested') throw invalid();
    if (state === 'candidate_shape' || state === 'unknown_shape') {
      digest(config.configuration_sha256);
      if (!['null', 'string', 'object', 'array', 'boolean', 'number', 'unknown'].includes(String(config.value_type))) throw invalid();
      if (config.value_type === 'object') integer(config.unknown_field_count);
    }
    else if (config.configuration_sha256 !== null) throw invalid();
    const fields = record(config.known_fields);
    if (Object.keys(fields).some(key => !['application', 'whatsapp_business_account', 'phone_number'].includes(key))) throw invalid();
    for (const field of Object.values(fields).map(record)) {
      if (!['null', 'string', 'object', 'array', 'boolean', 'number', 'unknown'].includes(String(field.value_type)) ||
          typeof field.matches_expected_callback !== 'boolean' ||
          (field.public_callback !== null && typeof field.public_callback !== 'string')) throw invalid();
      digest(field.value_sha256);
    }
    if (state === 'candidate_shape' && (config.value_type !== 'object' || config.unknown_field_count !== 0 ||
      Object.keys(fields).length === 0 || Object.values(fields).some(field => record(field).value_type !== 'string'))) throw invalid();
    if (!['candidate_shape', 'unknown_shape'].includes(String(state)) && Object.keys(fields).length !== 0) throw invalid();
    configurationIncomplete ||= state !== 'candidate_shape';
  }
  return { checkedAt, validUntil, controlIdentified: control.phone_number_id !== null, configurationIncomplete };
};

// Keep private credentials on the panel's existing HTTPS proxy and cookie/Bearer
// authority. A preview, third-party origin or HTTP page cannot dispatch them.
export const metaCredentialApiBase = (): string => {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  if (origin !== 'https://chatboc.ar' && origin !== 'https://www.chatboc.ar') {
    throw new MetaCredentialClientError('meta_credentials_production_panel_required');
  }
  return `${origin}/api`;
};

const readPrivateJson = async (response: Response): Promise<unknown> => {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw invalid();
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 32_768) throw invalid();
  const body = await response.text();
  if (body.length > 32_768) throw invalid();
  try { return JSON.parse(body); } catch { throw invalid(); }
};

const privatePost = async (action: 'status' | 'plan' | 'apply' | 'inspect-junin-webhook', body: RecordValue, scope: RequestScope): Promise<unknown> => {
  let received: Response | undefined;
  try {
    const response = await apiFetch(`/api/internal/meta-credentials/${action}`, {
      ...panelReadOptions(), method: 'POST', body, baseUrlOverride: metaCredentialApiBase(),
      singleAttempt: true, allowStartupRecovery: false, cache: 'no-store', responseType: 'response',
      suppressPanel401Redirect: true, sendAnonId: false, signal: scope.signal, isCurrent: scope.isCurrent,
      onResponse: response => { received = response; },
    });
    const result = await readPrivateJson(response);
    if (!scope.isCurrent()) throw new DOMException('Request retired', 'AbortError');
    return result;
  } catch (error) {
    if (!scope.isCurrent() || (error as Error)?.name === 'AbortError') throw new DOMException('Request retired', 'AbortError');
    if (error instanceof MetaCredentialClientError) throw error;
    // The shared client never decodes/logs these response bodies. Project only
    // a fixed reason code here; no raw response or exception reaches the UI.
    let reason = 'meta_credentials_request_failed';
    if (received) {
      try {
        const data = record(await readPrivateJson(received));
        if (typeof data.reason_code === 'string' && /^[a-z][a-z0-9_]{1,100}$/.test(data.reason_code)) reason = data.reason_code;
      } catch { /* Keep the fixed safe fallback. */ }
    }
    throw new MetaCredentialClientError(reason, action === 'apply');
  }
};

const requireToken = (token: string): void => {
  if (!/^[A-Za-z0-9._~-]{16,4096}$/.test(token)) throw new MetaCredentialClientError('meta_operation_token_input_invalid');
};

export const metaCredentialApi = {
  inspectConnection: async (statuses: MetaCredentialStatus[], scope: RequestScope) => {
    if (!scope.isCurrent()) throw new DOMException('Request retired', 'AbortError');
    if (!metaCredentialsInstalled(statuses)) throw new MetaCredentialClientError('meta_inspection_credentials_required');
    return parseMetaConnectionInspection(await privatePost('inspect-junin-webhook', { target: 'junin-production' }, scope), statuses);
  },
  status: async (target: MetaCredentialTarget, scope: RequestScope) =>
    parseMetaCredentialStatus(await privatePost('status', { target }, scope), target),
  plan: async (status: MetaCredentialStatus, accessToken: string, scope: RequestScope) => {
    if (!status.operationAvailable || status.writerEpoch === null) throw new MetaCredentialClientError('meta_credentials_operation_unavailable');
    requireToken(accessToken);
    return parseMetaCredentialPlan(await privatePost('plan', {
      target: status.target, access_token: accessToken, expected_revision: status.expectedRevision,
      expected_writer_epoch: status.writerEpoch,
    }, scope), status);
  },
  apply: async (plan: MetaCredentialPlan, accessToken: string, scope: RequestScope) => {
    requireToken(accessToken);
    try {
      return parseMetaCredentialReceipt(await privatePost('apply', {
        target: plan.target, access_token: accessToken, expires_at: plan.expiresAt,
        expected_revision: plan.expectedRevision, expected_writer_epoch: plan.writerEpoch,
        approved_plan_sha256: plan.planSha256, expected_database_identity_sha256: plan.databaseIdentitySha256,
      }, scope), plan);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      // HTTP 200 can still carry an unreadable or mismatched acknowledgement.
      // Once dispatch was attempted, only status may resolve the outcome.
      throw new MetaCredentialClientError(error instanceof MetaCredentialClientError
        ? error.reasonCode : 'meta_credentials_request_failed', true);
    }
  },
};
