import { ApiError, apiFetch } from '@/utils/api';

import {
  CAMPAIGN_PREPARATION_CONTRACT,
  type CampaignChannel,
  type CampaignNotificationTemplate,
  type CampaignPreparation,
  type CampaignPreparationFailure,
  type CampaignPreparationRequest,
} from './campaignPreparationTypes';

type UnknownRecord = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_REASON_CODE = /^[a-z][a-z0-9_]{1,127}$/;
const SAFE_FIELD = /^(?:[A-Za-z_][A-Za-z0-9_.-]{0,127}|Idempotency-Key)$/;
const CHANNELS = new Set<CampaignChannel>(['whatsapp', 'email']);

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const contractFailure = () =>
  new CampaignPreparationError({
    reasonCode: 'campaign_preparation_contract_invalid',
  });

const requireRecord = (value: unknown): UnknownRecord => {
  if (!isRecord(value)) throw contractFailure();
  return value;
};

const requireString = (value: unknown, allowEmpty = false): string => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw contractFailure();
  }
  return value;
};

const requireUuid = (value: unknown): string => {
  const normalized = requireString(value);
  if (!UUID.test(normalized)) throw contractFailure();
  return normalized;
};

const requireNullableString = (value: unknown): string | null => {
  if (value === null) return null;
  return requireString(value, true);
};

const requireNullableIsoDate = (value: unknown): string | null => {
  const normalized = requireNullableString(value);
  if (normalized !== null && Number.isNaN(Date.parse(normalized))) {
    throw contractFailure();
  }
  return normalized;
};

const requireBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') throw contractFailure();
  return value;
};

const requireNonNegativeInteger = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw contractFailure();
  return Number(value);
};

const requirePositiveInteger = (value: unknown): number => {
  const parsed = requireNonNegativeInteger(value);
  if (parsed < 1) throw contractFailure();
  return parsed;
};

const requireExact = (value: unknown, expected: unknown) => {
  if (value !== expected) throw contractFailure();
};

const requireReasonCodes = (value: unknown): string[] => {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || !SAFE_REASON_CODE.test(item))
  ) {
    throw contractFailure();
  }
  return value as string[];
};

export class CampaignPreparationError extends Error {
  readonly reasonCode: string;
  readonly field?: string;

  constructor(failure: CampaignPreparationFailure) {
    super(failure.reasonCode);
    this.name = 'CampaignPreparationError';
    this.reasonCode = failure.reasonCode;
    this.field = failure.field;
    Object.setPrototypeOf(this, CampaignPreparationError.prototype);
  }
}

export const parseCampaignPreparation = (value: unknown): CampaignPreparation => {
  const response = requireRecord(value);
  requireExact(response.contract_version, CAMPAIGN_PREPARATION_CONTRACT);

  const campaign = requireRecord(response.campaign);
  requireUuid(campaign.id);
  requireExact(campaign.status, 'draft');
  const channel = requireString(campaign.channel) as CampaignChannel;
  if (!CHANNELS.has(channel)) throw contractFailure();
  const template = requireRecord(campaign.template);
  requireUuid(template.id);
  requireString(template.key);
  if (template.message_template_registry_id !== null) {
    requirePositiveInteger(template.message_template_registry_id);
  }
  requireNullableIsoDate(campaign.scheduled_for_utc);
  requireNullableIsoDate(campaign.created_at);
  const idempotentReplay = requireBoolean(campaign.idempotent_replay);

  const preview = requireRecord(response.preview);
  requireNullableString(preview.subject);
  requireString(preview.body);
  requireExact(preview.strict_variable_contract, true);
  requireExact(preview.contains_unresolved_variables, false);

  const audience = requireRecord(response.audience);
  const requested = requireNonNegativeInteger(audience.requested);
  const uniqueRequested = requireNonNegativeInteger(audience.unique_requested);
  const resolved = requireNonNegativeInteger(audience.resolved);
  const eligible = requireNonNegativeInteger(audience.eligible);
  const excluded = requireNonNegativeInteger(audience.excluded);
  const unresolved = requireNonNegativeInteger(audience.unresolved);
  const duplicates = requireNonNegativeInteger(audience.duplicates_ignored);
  if (
    requested !== uniqueRequested + duplicates ||
    uniqueRequested !== resolved + unresolved ||
    resolved !== eligible + excluded
  ) {
    throw contractFailure();
  }
  const exclusionCounts = requireRecord(audience.exclusion_counts);
  const optOut = requireNonNegativeInteger(exclusionCounts.opt_out);
  const consentMissing = requireNonNegativeInteger(exclusionCounts.consent_missing);
  const missingWhatsapp = requireNonNegativeInteger(exclusionCounts.missing_whatsapp);
  const missingEmail = requireNonNegativeInteger(exclusionCounts.missing_email);
  const frequencyWindow = requireNonNegativeInteger(exclusionCounts.frequency_window);
  if (
    excluded !==
    optOut + consentMissing + missingWhatsapp + missingEmail + frequencyWindow
  ) {
    throw contractFailure();
  }
  const rateLimitPolicy = requireRecord(audience.rate_limit_policy);
  requirePositiveInteger(rateLimitPolicy.max_per_week);
  requirePositiveInteger(rateLimitPolicy.min_interval_hours);
  requireExact(rateLimitPolicy.legacy_records_are_conservative_guards_only, true);
  const consentPolicy = requireRecord(audience.consent_policy);
  requireExact(consentPolicy.purpose, 'marketing');
  requireExact(consentPolicy.explicit_opt_in_required, true);

  const readiness = requireRecord(response.readiness);
  requireExact(readiness.preview_valid, true);
  requireExact(readiness.audience_evaluated, true);
  requireExact(readiness.consent_evaluated, true);
  requireExact(readiness.rate_limit_evaluated, true);
  requireBoolean(readiness.provider_template_approval_valid);
  requireBoolean(readiness.provider_template_ready);
  requireExact(readiness.transport_readiness_checked, false);
  requireExact(readiness.production_send_allowed, false);
  const blockers = requireReasonCodes(readiness.blockers);
  if (!blockers.includes('campaign_dispatch_not_authorized')) {
    throw contractFailure();
  }

  const queue = requireRecord(response.queue);
  requireExact(queue.state, 'held');
  requireExact(queue.dispatch_authorized, false);
  if (!Array.isArray(queue.receipts) || queue.receipts.length !== resolved) {
    throw contractFailure();
  }
  const seenIntents = new Set<string>();
  let heldCount = 0;
  let excludedCount = 0;
  for (const rawReceipt of queue.receipts) {
    const receipt = requireRecord(rawReceipt);
    const intentId = requireUuid(receipt.intent_id);
    if (seenIntents.has(intentId)) throw contractFailure();
    seenIntents.add(intentId);
    requireString(receipt.contact_id);
    if (receipt.queue_status === 'held') {
      heldCount += 1;
      requireExact(receipt.exclusion_reason, null);
    } else if (receipt.queue_status === 'excluded') {
      excludedCount += 1;
      const reason = requireString(receipt.exclusion_reason);
      if (!SAFE_REASON_CODE.test(reason)) throw contractFailure();
    } else {
      throw contractFailure();
    }
    requireExact(receipt.transport_status, 'not_attempted');
    requireExact(receipt.attempt_count, 0);
    requireExact(receipt.provider_receipt_present, false);
  }
  if (heldCount !== eligible || excludedCount !== excluded) throw contractFailure();

  const outcomes = requireRecord(queue.transport_outcomes);
  requireExact(outcomes.not_attempted, resolved);
  for (const key of ['unknown', 'accepted', 'sent', 'delivered', 'read', 'failed']) {
    requireExact(outcomes[key], 0);
  }

  const sideEffects = requireRecord(response.side_effects);
  requireExact(sideEffects.campaigns_created, idempotentReplay ? 0 : 1);
  requireExact(
    sideEffects.queue_receipts_created,
    idempotentReplay ? 0 : resolved,
  );
  requireExact(sideEffects.notifications_queued, 0);
  requireExact(sideEffects.provider_calls_performed, false);
  requireExact(sideEffects.messages_sent, 0);

  return response as unknown as CampaignPreparation;
};

const statusReasonCode = (status: number) => {
  if (status === 401) return 'campaign_preparation_auth_required';
  if (status === 403) return 'campaign_preparation_forbidden';
  if (status === 404) return 'campaign_template_not_found';
  if (status === 409) return 'campaign_idempotency_conflict';
  if (status >= 500) return 'campaign_preparation_backend_unavailable';
  return 'campaign_preparation_failed';
};

export const toCampaignPreparationError = (
  error: unknown,
): CampaignPreparationError => {
  if (error instanceof CampaignPreparationError) return error;
  const body = error instanceof ApiError && isRecord(error.body) ? error.body : null;
  const rawReason = body?.reason_code ?? body?.error;
  const reasonCode =
    typeof rawReason === 'string' && SAFE_REASON_CODE.test(rawReason)
      ? rawReason
      : error instanceof ApiError
        ? statusReasonCode(error.status)
        : 'campaign_preparation_unavailable';
  const rawField = body?.field;
  const field =
    typeof rawField === 'string' && SAFE_FIELD.test(rawField)
      ? rawField
      : undefined;
  return new CampaignPreparationError({ reasonCode, field });
};

export const createCampaignIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new CampaignPreparationError({
      reasonCode: 'secure_random_unavailable',
    });
  }
  return `crm:${Date.now().toString(36)}:${globalThis.crypto.randomUUID()}`;
};

export const prepareCampaign = async (
  tenantSlug: string,
  payload: CampaignPreparationRequest,
  idempotencyKey: string,
): Promise<CampaignPreparation> => {
  const normalizedTenant = tenantSlug.trim();
  if (!normalizedTenant) {
    throw new CampaignPreparationError({
      reasonCode: 'campaign_tenant_required',
      field: 'tenant',
    });
  }
  if (!idempotencyKey.trim()) {
    throw new CampaignPreparationError({
      reasonCode: 'idempotency_key_required',
      field: 'Idempotency-Key',
    });
  }
  try {
    const response = await apiFetch<unknown>(
      `/api/admin/tenants/${encodeURIComponent(normalizedTenant)}/campaigns/prepare`,
      {
        method: 'POST',
        tenantSlug: normalizedTenant,
        cache: 'no-store',
        headers: {
          'Idempotency-Key': idempotencyKey,
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: payload,
      },
    );
    return parseCampaignPreparation(response);
  } catch (error) {
    throw toCampaignPreparationError(error);
  }
};

export const listCampaignNotificationTemplates = async (
  tenantSlug: string,
  channel: CampaignChannel,
): Promise<CampaignNotificationTemplate[]> => {
  const normalizedTenant = tenantSlug.trim();
  if (!normalizedTenant) return [];
  const response = await apiFetch<unknown>(
    `/api/admin/notifications/templates?channel=${encodeURIComponent(channel)}`,
    {
      tenantSlug: normalizedTenant,
      cache: 'no-store',
    },
  );
  if (!Array.isArray(response)) throw contractFailure();
  return response.map((raw) => {
    const template = requireRecord(raw);
    const parsedChannel = requireString(template.channel) as CampaignChannel;
    if (!CHANNELS.has(parsedChannel)) throw contractFailure();
    if (template.message_template_registry_id !== null) {
      requirePositiveInteger(template.message_template_registry_id);
    }
    return {
      id: requireUuid(template.id),
      key: requireString(template.key),
      channel: parsedChannel,
      subject_template: requireNullableString(template.subject_template),
      body_template: requireString(template.body_template),
      message_template_registry_id: template.message_template_registry_id as number | null,
      is_active: requireBoolean(template.is_active),
    };
  });
};
