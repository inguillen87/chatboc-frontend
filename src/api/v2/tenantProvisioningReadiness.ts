import { apiFetch } from '@/utils/api';

export const TENANT_PROVISIONING_READINESS_CONTRACT = 'tenant.provisioning_readiness.v1' as const;

export type TenantProvisioningStage =
  | 'tenant_created'
  | 'configuration_in_progress'
  | 'configuration_blocked'
  | 'configuration_complete'
  | 'tenant_inactive';

export type TenantProvisioningStatus = 'ready' | 'configuration_required' | 'blocked';

export type TenantProvisioningNextAction =
  | 'activate_tenant'
  | 'repair_base_configuration'
  | 'configure_branding'
  | 'configure_operator_team'
  | 'publish_service_content'
  | 'verify_tenant_channel'
  | 'review_activation'
  | 'review_configuration';

export interface TenantProvisioningReadiness {
  contract_version: typeof TENANT_PROVISIONING_READINESS_CONTRACT;
  readiness_scope: 'tenant_configuration';
  generated_at: string;
  tenant: {
    id: number;
    slug: string;
    tipo: string;
  };
  template_key: string | null;
  evaluated_stage: TenantProvisioningStage;
  requires_revalidation: boolean;
  status: TenantProvisioningStatus;
  ready: boolean;
  production_ready: boolean;
  checks: {
    base_configuration_valid: boolean;
    branding_configuration_complete: boolean;
    operator_configuration_complete: boolean;
    service_content_configured: boolean;
    channel_verification_complete: boolean;
    provider_activation_performed: boolean;
  };
  configured_keys: string[];
  missing: string[];
  next_action: TenantProvisioningNextAction;
  evidence: {
    base_configuration: {
      required_keys: string[];
      configured_keys: string[];
      missing_keys: string[];
    };
    branding: {
      logo_configured: boolean;
      palette_configured: boolean;
    };
    operator_team: {
      members: number;
      ticket_categories: number;
      routed_members: number;
    };
    service_content: {
      catalog_items: number;
      menu_items: number;
    };
    channels: {
      selected: string[];
      verified: string[];
      missing: string[];
      complete: boolean;
      provider_activation_performed: boolean;
    };
  };
  safety: {
    server_derived: true;
    side_effects_performed: false;
    provider_calls_performed: false;
    production_cutover_assessed: boolean;
  };
}

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const STAGES = new Set<TenantProvisioningStage>([
  'tenant_created',
  'configuration_in_progress',
  'configuration_blocked',
  'configuration_complete',
  'tenant_inactive',
]);
const STATUSES = new Set<TenantProvisioningStatus>(['ready', 'configuration_required', 'blocked']);
const NEXT_ACTIONS = new Set<TenantProvisioningNextAction>([
  'activate_tenant',
  'repair_base_configuration',
  'configure_branding',
  'configure_operator_team',
  'publish_service_content',
  'verify_tenant_channel',
  'review_activation',
  'review_configuration',
]);

const invalidContract = (): never => {
  throw new Error('tenant_provisioning_readiness_contract_invalid');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());

const isNullableString = (value: unknown): value is string | null =>
  value === null || isNonEmptyString(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isBooleanRecord = (value: Record<string, unknown>, keys: readonly string[]) =>
  keys.every((key) => typeof value[key] === 'boolean');

const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const assertTenantSlug = (value: string) => {
  const normalized = normalizeTenantSlug(value);
  if (!TENANT_SLUG_PATTERN.test(normalized)) invalidContract();
  return normalized;
};

/**
 * This parser intentionally fails closed. The screen must never reconstruct a
 * readiness result from partial counts or a tenant snapshot from another scope.
 */
export const parseTenantProvisioningReadiness = (
  payload: unknown,
  requestedTenantSlug: string,
): TenantProvisioningReadiness => {
  const requested = assertTenantSlug(requestedTenantSlug);
  if (
    !isRecord(payload)
    || payload.contract_version !== TENANT_PROVISIONING_READINESS_CONTRACT
    || payload.readiness_scope !== 'tenant_configuration'
    || !isNonEmptyString(payload.generated_at)
    || Number.isNaN(Date.parse(payload.generated_at))
    || !isRecord(payload.tenant)
    || !isCount(payload.tenant.id)
    || payload.tenant.id <= 0
    || !isNonEmptyString(payload.tenant.slug)
    || normalizeTenantSlug(payload.tenant.slug) !== requested
    || !isNonEmptyString(payload.tenant.tipo)
    || !isNullableString(payload.template_key)
    || !STAGES.has(payload.evaluated_stage as TenantProvisioningStage)
    || typeof payload.requires_revalidation !== 'boolean'
    || !STATUSES.has(payload.status as TenantProvisioningStatus)
    || typeof payload.ready !== 'boolean'
    || typeof payload.production_ready !== 'boolean'
    || !isRecord(payload.checks)
    || !isBooleanRecord(payload.checks, [
      'base_configuration_valid',
      'branding_configuration_complete',
      'operator_configuration_complete',
      'service_content_configured',
      'channel_verification_complete',
      'provider_activation_performed',
    ])
    || !isStringArray(payload.configured_keys)
    || !isStringArray(payload.missing)
    || !NEXT_ACTIONS.has(payload.next_action as TenantProvisioningNextAction)
    || !isRecord(payload.evidence)
    || !isRecord(payload.evidence.base_configuration)
    || !isStringArray(payload.evidence.base_configuration.required_keys)
    || !isStringArray(payload.evidence.base_configuration.configured_keys)
    || !isStringArray(payload.evidence.base_configuration.missing_keys)
    || !isRecord(payload.evidence.branding)
    || typeof payload.evidence.branding.logo_configured !== 'boolean'
    || typeof payload.evidence.branding.palette_configured !== 'boolean'
    || !isRecord(payload.evidence.operator_team)
    || !isCount(payload.evidence.operator_team.members)
    || !isCount(payload.evidence.operator_team.ticket_categories)
    || !isCount(payload.evidence.operator_team.routed_members)
    || !isRecord(payload.evidence.service_content)
    || !isCount(payload.evidence.service_content.catalog_items)
    || !isCount(payload.evidence.service_content.menu_items)
    || !isRecord(payload.evidence.channels)
    || !isStringArray(payload.evidence.channels.selected)
    || !isStringArray(payload.evidence.channels.verified)
    || !isStringArray(payload.evidence.channels.missing)
    || typeof payload.evidence.channels.complete !== 'boolean'
    || typeof payload.evidence.channels.provider_activation_performed !== 'boolean'
    || !isRecord(payload.safety)
    || payload.safety.server_derived !== true
    || payload.safety.side_effects_performed !== false
    || payload.safety.provider_calls_performed !== false
    || typeof payload.safety.production_cutover_assessed !== 'boolean'
  ) {
    return invalidContract();
  }

  const checks = payload.checks;
  const base = payload.evidence.base_configuration;
  const branding = payload.evidence.branding;
  const team = payload.evidence.operator_team;
  const content = payload.evidence.service_content;
  const channels = payload.evidence.channels;
  const requiredChecksReady = [
    checks.base_configuration_valid,
    checks.branding_configuration_complete,
    checks.operator_configuration_complete,
    checks.service_content_configured,
    checks.channel_verification_complete,
  ].every(Boolean);
  const selectedChannelsReady = channels.selected.length > 0 && channels.missing.length === 0;

  if (
    checks.base_configuration_valid !== (base.missing_keys.length === 0)
    || !arraysEqual(payload.configured_keys, base.configured_keys)
    || checks.branding_configuration_complete !== (
      branding.logo_configured && branding.palette_configured
    )
    || checks.operator_configuration_complete !== (team.members > 0 && team.routed_members > 0)
    || team.routed_members > team.members
    || checks.service_content_configured !== (content.catalog_items > 0 || content.menu_items > 0)
    || checks.channel_verification_complete !== channels.complete
    || channels.complete !== selectedChannelsReady
    || checks.provider_activation_performed !== channels.provider_activation_performed
    || (payload.ready && !requiredChecksReady)
    || payload.requires_revalidation === payload.ready
    || (payload.ready && payload.status !== 'ready')
    || (!payload.ready && payload.status === 'ready')
    || (payload.production_ready && (!payload.ready || payload.safety.production_cutover_assessed !== true))
  ) {
    return invalidContract();
  }

  return payload as unknown as TenantProvisioningReadiness;
};

export const fetchTenantProvisioningReadiness = async (tenantSlug: string) => {
  const normalized = assertTenantSlug(tenantSlug);
  const payload = await apiFetch<unknown>(
    `/api/admin/tenants/${encodeURIComponent(normalized)}/provisioning-readiness`,
    {
      tenantSlug: normalized,
      persistTenantSlug: false,
      cache: 'no-store',
    },
  );
  return parseTenantProvisioningReadiness(payload, normalized);
};
