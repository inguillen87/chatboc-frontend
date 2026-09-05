import { apiFetch } from '@/utils/api';

export const CHANNEL_ACTIVATION_CONTRACT_VERSION = 'tenant.channel_activation.v1' as const;

export type ChannelActivationStatus = 'ready' | 'needs_attention' | 'locked' | 'action_required' | 'pending' | 'blocked';

export interface ChannelActivationAction {
  id?: string;
  label?: string;
  href?: string;
  kind?: 'link' | 'api' | string;
  primary?: boolean;
}

export interface ChannelActivationChannel {
  id: string;
  label: string;
  status: ChannelActivationStatus | string;
  state?: string;
  ready?: boolean;
  locked?: boolean;
  description?: string;
  evidence?: string[];
  actions?: ChannelActivationAction[];
  reason_code?: string | null;
  required_plan?: string | null;
  progress_hint?: string | null;
}

export interface ChannelActivationContract {
  contract_version: typeof CHANNEL_ACTIVATION_CONTRACT_VERSION;
  generated_at?: string;
  tenant?: {
    id?: number | string | null;
    slug?: string | null;
    nombre?: string | null;
    tipo?: string | null;
    vertical?: string | null;
    subvertical?: string | null;
    plan?: string | null;
    is_active?: boolean;
  } | null;
  status?: string;
  summary?: {
    total?: number;
    ready?: number;
    locked?: number;
    attention?: number;
    progress?: number;
    health_label?: string;
    primary_next_action?: ChannelActivationAction | null;
  };
  preferred_channels?: string[];
  counts?: Record<string, number>;
  channels?: ChannelActivationChannel[];
  blockers?: Array<{ id?: string; label?: string; reason_code?: string | null; required_plan?: string | null }>;
  integration_access?: {
    enabled?: boolean;
    status?: string;
    required_plan?: string;
    current_plan?: string;
    reason_code?: string | null;
    message?: string;
  };
  provisioning?: {
    status?: string | null;
    blocked_reason?: string | null;
    channel_strategy?: string | null;
  };
  endpoints?: Record<string, string>;
  security?: {
    secret_free?: boolean;
    widget_tokens_exposed?: boolean;
    provider_credentials_exposed?: boolean;
  };
}

const normalizeTenantSlug = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isOptionalString = (value: unknown) => value === undefined || value === null || typeof value === 'string';
const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';

const isChannelAction = (value: unknown) => {
  if (!isRecord(value)) return false;
  return isOptionalString(value.id)
    && isOptionalString(value.label)
    && isOptionalString(value.href)
    && isOptionalString(value.kind)
    && isOptionalBoolean(value.primary);
};

const isChannel = (value: unknown) => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim()) return false;
  if (typeof value.label !== 'string' || !value.label.trim()) return false;
  if (typeof value.status !== 'string' || !value.status.trim()) return false;
  if (!isOptionalString(value.state)
    || !isOptionalBoolean(value.ready)
    || !isOptionalBoolean(value.locked)
    || !isOptionalString(value.description)
    || !isOptionalString(value.reason_code)
    || !isOptionalString(value.required_plan)
    || !isOptionalString(value.progress_hint)) {
    return false;
  }
  if (value.evidence !== undefined
    && (!Array.isArray(value.evidence) || value.evidence.some((item) => typeof item !== 'string'))) {
    return false;
  }
  if (value.actions !== undefined
    && (!Array.isArray(value.actions) || value.actions.some((item) => !isChannelAction(item)))) {
    return false;
  }
  return true;
};

export const parseTenantChannelActivation = (
  payload: unknown,
  requestedTenantSlug?: string | null,
): ChannelActivationContract => {
  if (!isRecord(payload) || payload.contract_version !== CHANNEL_ACTIVATION_CONTRACT_VERSION) {
    throw new Error('channel_activation_contract_invalid');
  }

  if (payload.channels !== undefined
    && (!Array.isArray(payload.channels) || payload.channels.some((channel) => !isChannel(channel)))) {
    throw new Error('channel_activation_contract_invalid');
  }

  if (payload.summary !== undefined && !isRecord(payload.summary)) {
    throw new Error('channel_activation_contract_invalid');
  }

  if (payload.tenant !== undefined && payload.tenant !== null && !isRecord(payload.tenant)) {
    throw new Error('channel_activation_contract_invalid');
  }

  const requested = normalizeTenantSlug(requestedTenantSlug);
  if (requested) {
    const tenant = isRecord(payload.tenant) ? payload.tenant : null;
    const returned = normalizeTenantSlug(typeof tenant?.slug === 'string' ? tenant.slug : null);
    if (!returned || returned !== requested) {
      throw new Error('channel_activation_scope_mismatch');
    }
  }

  return payload as unknown as ChannelActivationContract;
};

export const fetchTenantChannelActivation = async (tenantSlug?: string | null) => {
  const normalized = tenantSlug?.trim();
  const path = normalized
    ? `/api/v2/tenants/${encodeURIComponent(normalized)}/activation/channels`
    : '/api/v2/tenant/activation/channels';

  const payload = await apiFetch<unknown>(path, {
    tenantSlug: normalized || null,
    // This contract is also the authorization probe for explicit tenant deep
    // links. Do not persist the requested slug until the backend has returned
    // a matching authorized contract.
    persistTenantSlug: false,
    cache: 'no-store',
  });

  return parseTenantChannelActivation(payload, normalized);
};
