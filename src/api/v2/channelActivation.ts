import { apiFetch } from '@/utils/api';

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
  contract_version: 'tenant.channel_activation.v1';
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

export const fetchTenantChannelActivation = (tenantSlug?: string | null) => {
  const normalized = tenantSlug?.trim();
  const path = normalized
    ? `/api/v2/tenants/${encodeURIComponent(normalized)}/activation/channels`
    : '/api/v2/tenant/activation/channels';

  return apiFetch<ChannelActivationContract>(path, {
    tenantSlug: normalized || null,
  });
};
