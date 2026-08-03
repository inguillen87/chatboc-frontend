import { ApiError, apiFetch } from '@/utils/api';

import {
  NOTIFICATION_TEMPLATE_PREVIEW_CONTRACT,
  type NotificationTemplatePreview,
  type NotificationTemplatePreviewFailure,
  type NotificationTemplatePreviewRequest,
} from './notificationTemplatePreviewTypes';

type UnknownRecord = Record<string, unknown>;

const SAFE_REASON_CODE = /^[a-z][a-z0-9_]{1,127}$/;
const SAFE_FIELD = /^[A-Za-z_][A-Za-z0-9_.]{0,127}$/;
const SAFE_VARIABLE_NAME = /^(?:[A-Za-z_][A-Za-z0-9_]{0,63}|[1-9][0-9]{0,2})$/;
const SAFE_PROVIDER_STATUS = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const TEMPLATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATE_CHANNELS = new Set(['email', 'whatsapp', 'push', 'in_app']);
const PROVIDER_LIFECYCLE_STATES = new Set([
  'local_draft',
  'content_created',
  'approval_pending',
  'rejected',
  'stale',
  'approved',
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const contractFailure = () =>
  new NotificationTemplatePreviewError({
    reasonCode: 'notification_template_preview_contract_invalid',
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

const requireNullableString = (value: unknown): string | null => {
  if (value === null) return null;
  return requireString(value, true);
};

const requireNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw contractFailure();
  return value;
};

const requirePositiveInteger = (value: unknown): number => {
  const numeric = requireNumber(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) throw contractFailure();
  return numeric;
};

const requireBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') throw contractFailure();
  return value;
};

const requireStringList = (value: unknown, safeCodes = false): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw contractFailure();
  }
  const values = value as string[];
  if (safeCodes && values.some((item) => !SAFE_REASON_CODE.test(item))) {
    throw contractFailure();
  }
  return values;
};

const requireExact = (value: unknown, expected: true | false | 0) => {
  if (value !== expected) throw contractFailure();
};

const parseProviderTemplate = (
  value: unknown,
): NotificationTemplatePreview['provider_template'] => {
  if (value === null) return null;
  const provider = requireRecord(value);
  requirePositiveInteger(provider.registry_id);
  if (requireString(provider.provider) !== 'twilio') throw contractFailure();
  requireString(provider.name);
  requireString(provider.language);
  requireNullableString(provider.category);
  requireBoolean(provider.content_sid_present);
  requireBoolean(provider.preview_available);
  requireStringList(provider.required_content_variables);
  requireStringList(provider.received_content_variables);
  requireString(provider.rendered_body, true);

  const lifecycle = requireRecord(provider.lifecycle);
  const lifecycleState = requireString(lifecycle.state);
  if (!PROVIDER_LIFECYCLE_STATES.has(lifecycleState)) throw contractFailure();
  const lifecycleReason = requireString(lifecycle.reason);
  if (!SAFE_REASON_CODE.test(lifecycleReason)) throw contractFailure();
  const providerStatus = requireNullableString(lifecycle.provider_status);
  if (providerStatus !== null && !SAFE_PROVIDER_STATUS.test(providerStatus)) {
    throw contractFailure();
  }
  requireBoolean(lifecycle.provider_reference_present);
  requireNullableString(lifecycle.provider_evidence_at);
  requireBoolean(lifecycle.provider_evidence_fresh);
  const productionSendAllowed = requireBoolean(lifecycle.production_send_allowed);
  const blockers = requireStringList(lifecycle.blockers, true);
  if (productionSendAllowed !== (lifecycleState === 'approved')) {
    throw contractFailure();
  }
  if (productionSendAllowed && blockers.length > 0) throw contractFailure();

  return provider as unknown as NotificationTemplatePreview['provider_template'];
};

export class NotificationTemplatePreviewError extends Error {
  readonly reasonCode: string;
  readonly field?: string;
  readonly variableNames?: string[];

  constructor(failure: NotificationTemplatePreviewFailure) {
    super(failure.reasonCode);
    this.name = 'NotificationTemplatePreviewError';
    this.reasonCode = failure.reasonCode;
    this.field = failure.field;
    this.variableNames = failure.variableNames;
    Object.setPrototypeOf(this, NotificationTemplatePreviewError.prototype);
  }
}

export const parseNotificationTemplatePreview = (
  value: unknown,
): NotificationTemplatePreview => {
  const response = requireRecord(value);
  if (response.contract_version !== NOTIFICATION_TEMPLATE_PREVIEW_CONTRACT) {
    throw contractFailure();
  }
  requirePositiveInteger(response.tenant_id);

  const template = requireRecord(response.template);
  const templateId = requireString(template.id);
  if (!TEMPLATE_ID.test(templateId)) throw contractFailure();
  requireString(template.key);
  const templateChannel = requireString(template.channel);
  if (!TEMPLATE_CHANNELS.has(templateChannel)) throw contractFailure();
  requireBoolean(template.is_active);
  if (template.message_template_registry_id !== null) {
    requirePositiveInteger(template.message_template_registry_id);
  }

  const rendered = requireRecord(response.rendered);
  requireString(rendered.body);
  requireNullableString(rendered.subject);
  requireStringList(rendered.required_variables);
  requireStringList(rendered.received_variables);
  requireExact(rendered.strict_variable_contract, true);
  requireExact(rendered.contains_unresolved_variables, false);

  const providerTemplate = parseProviderTemplate(response.provider_template);
  if (providerTemplate) {
    if (
      templateChannel !== 'whatsapp' ||
      template.message_template_registry_id !== providerTemplate.registry_id
    ) {
      throw contractFailure();
    }
  } else if (template.message_template_registry_id !== null) {
    throw contractFailure();
  }

  const readiness = requireRecord(response.readiness);
  requireExact(readiness.preview_valid, true);
  const providerApprovalValid = requireBoolean(
    readiness.provider_template_approval_valid,
  );
  const providerTemplateReady = requireBoolean(readiness.provider_template_ready);
  const expectedProviderApproval = Boolean(
    providerTemplate?.lifecycle.production_send_allowed,
  );
  const expectedProviderReady = Boolean(
    expectedProviderApproval &&
      providerTemplate?.content_sid_present &&
      providerTemplate.preview_available,
  );
  if (
    providerApprovalValid !== expectedProviderApproval ||
    providerTemplateReady !== expectedProviderReady
  ) {
    throw contractFailure();
  }
  requireExact(readiness.transport_readiness_checked, false);
  requireExact(readiness.production_send_allowed, false);
  requireStringList(readiness.blockers, true);

  const sideEffects = requireRecord(response.side_effects);
  requireExact(sideEffects.provider_calls_performed, false);
  requireExact(sideEffects.messages_queued, 0);
  requireExact(sideEffects.messages_sent, 0);

  return {
    ...(response as unknown as NotificationTemplatePreview),
    provider_template: providerTemplate,
  };
};

const statusReasonCode = (status: number) => {
  if (status === 401) return 'notification_template_preview_auth_required';
  if (status === 403) return 'notification_template_preview_forbidden';
  if (status === 404) return 'notification_template_not_found';
  if (status >= 500) return 'notification_template_preview_backend_unavailable';
  return 'notification_template_preview_failed';
};

export const toNotificationTemplatePreviewError = (
  error: unknown,
): NotificationTemplatePreviewError => {
  if (error instanceof NotificationTemplatePreviewError) return error;

  const body = error instanceof ApiError && isRecord(error.body) ? error.body : null;
  const rawReason = body?.reason_code ?? body?.error;
  const reasonCode =
    typeof rawReason === 'string' && SAFE_REASON_CODE.test(rawReason)
      ? rawReason
      : error instanceof ApiError
        ? statusReasonCode(error.status)
        : 'notification_template_preview_unavailable';
  const rawField = body?.field;
  const field =
    typeof rawField === 'string' && SAFE_FIELD.test(rawField) ? rawField : undefined;
  const variableNames = Array.isArray(body?.variable_names)
    ? body.variable_names.filter(
        (item): item is string =>
          typeof item === 'string' && SAFE_VARIABLE_NAME.test(item),
      )
    : undefined;

  return new NotificationTemplatePreviewError({
    reasonCode,
    field,
    ...(variableNames?.length ? { variableNames } : {}),
  });
};

export const previewNotificationTemplate = async (
  tenantSlug: string,
  payload: NotificationTemplatePreviewRequest,
): Promise<NotificationTemplatePreview> => {
  const normalizedTenant = tenantSlug.trim();
  if (!normalizedTenant) {
    throw new NotificationTemplatePreviewError({
      reasonCode: 'notification_template_preview_tenant_required',
      field: 'tenant',
    });
  }

  try {
    const response = await apiFetch<unknown>(
      '/api/admin/notifications/templates/preview',
      {
        method: 'POST',
        tenantSlug: normalizedTenant,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: payload,
      },
    );
    return parseNotificationTemplatePreview(response);
  } catch (error) {
    throw toNotificationTemplatePreviewError(error);
  }
};
