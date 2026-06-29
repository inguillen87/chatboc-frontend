import { apiFetch } from '@/utils/api';

export type FinanceStepState = 'ready' | 'blocked' | 'pending' | 'pending_session' | string;

export interface FinanceWebviewStep {
  id: string;
  label: string;
  state: FinanceStepState;
  detail?: string;
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
  analytics?: Record<string, unknown>;
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
