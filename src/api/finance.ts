import { apiFetch } from '@/utils/api';

export type FinanceStepState = 'ready' | 'blocked' | 'pending' | 'pending_session' | string;

export interface FinanceWebviewStep {
  id: string;
  label: string;
  state: FinanceStepState;
  detail?: string;
}

export interface FinanceActionCatalogItem {
  id: string;
  label: string;
  event?: string;
  status?: string;
  next_step?: string;
  enabled: boolean;
  disabled_reason?: string | null;
}

export interface FinanceWebviewResponse {
  contract_version: 'finance.webview.v1';
  request_id?: string;
  generated_at?: string;
  tenant: {
    id?: number | null;
    slug: string;
    nombre: string;
    tipo?: string;
    vertical?: string;
    logo_url?: string | null;
  };
  operation: {
    flow: string;
    code: string;
    title: string;
    description: string;
    status: string;
    amount?: string | null;
    currency?: string | null;
    contact_key?: string | null;
  };
  security_policy: {
    card_data_in_chat_allowed: boolean;
    identity_data_in_chat_allowed: boolean;
    requires_session_token: boolean;
    session_state: string;
    server_to_server_confirmation_required: boolean;
    requires_idempotency_key?: boolean;
    audit_trail_required?: boolean;
    never_request_in_chat?: string[];
    highlights?: string[];
  };
  steps: FinanceWebviewStep[];
  actions: {
    primary?: {
      id: string;
      label: string;
      enabled: boolean;
      disabled_reason?: string | null;
    };
    support?: {
      id: string;
      label: string;
      enabled: boolean;
    };
  };
  experience?: {
    webview_flow_id?: string;
    templates?: string[];
    crm_queue?: {
      id: string;
      label: string;
      sla_minutes?: number;
    };
    user_tasks?: string[];
    service_level?: {
      label?: string;
      sla_minutes?: number;
    };
  };
  compliance?: {
    source_of_truth?: string;
    consent_required?: boolean;
    sensitive_data_policy?: string;
    allowed_chat_inputs?: string[];
    never_request_in_chat?: string[];
  };
  events?: {
    success?: string[];
    analytics?: string[];
  };
  analytics?: Record<string, unknown>;
  action_catalog?: FinanceActionCatalogItem[];
  frontend_contract?: Record<string, unknown>;
}

export interface FinanceWebviewQuery {
  tenantSlug: string;
  flow: string;
  operationCode: string;
  searchParams?: URLSearchParams;
}

export async function fetchFinanceWebview({
  tenantSlug,
  flow,
  operationCode,
  searchParams,
}: FinanceWebviewQuery): Promise<FinanceWebviewResponse> {
  const query = new URLSearchParams(searchParams ?? undefined);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<FinanceWebviewResponse>(
    `/api/public/finance/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(flow)}/${encodeURIComponent(operationCode)}${suffix}`,
    {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitEntityToken: true,
      omitChatSessionId: true,
      omitTenant: true,
      suppressPanel401Redirect: true,
      headers: { 'X-Tenant-Slug': tenantSlug },
    },
  );
}

export interface FinanceActionRequest {
  tenantSlug: string;
  flow: string;
  operationCode: string;
  searchParams?: URLSearchParams;
  actionId: string;
  comment?: string;
  amount?: string | null;
  currency?: string | null;
}

export interface FinanceActionResponse {
  contract_version: 'finance.action.v1';
  status: 'accepted' | 'duplicate' | string;
  request_id?: string;
  ticket?: {
    id: number;
    status?: string;
    category?: string;
    fingerprint?: string;
    crm_queue?: {
      id: string;
      label: string;
      sla_minutes?: number;
    };
  };
  action?: {
    id: string;
    label: string;
    event?: string;
    next_step?: string;
  };
  crm_followup?: {
    queue?: {
      id: string;
      label: string;
      sla_minutes?: number;
    };
    template_candidates?: string[];
    webview_flow_id?: string;
  };
  frontend_contract?: {
    toast?: string;
    refresh_payload_url?: string;
    render_as?: string;
  };
}

export async function sendFinanceAction({
  tenantSlug,
  flow,
  operationCode,
  searchParams,
  actionId,
  comment,
  amount,
  currency,
}: FinanceActionRequest): Promise<FinanceActionResponse> {
  const session = searchParams?.get('session') || searchParams?.get('token') || '';
  const idempotencyBase = [tenantSlug, flow, operationCode, actionId, session || 'public'].join(':');
  return apiFetch<FinanceActionResponse>(
    `/api/public/finance/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(flow)}/${encodeURIComponent(operationCode)}/actions`,
    {
      method: 'POST',
      body: {
        action_id: actionId,
        comment,
        amount,
        currency,
        session,
        idempotency_key: idempotencyBase,
      },
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitEntityToken: true,
      omitChatSessionId: true,
      omitTenant: true,
      suppressPanel401Redirect: true,
      headers: { 'X-Tenant-Slug': tenantSlug },
    },
  );
}
