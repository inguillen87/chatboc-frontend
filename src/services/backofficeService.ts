import { ApiError, apiFetch } from '@/utils/api';
import { privateBackendRead, type PrivateBackendReadLifecycle } from '@/utils/privateBackendRead';
import { panelReadOptions } from '@/utils/panelReadOptions';

export type BackofficeScope = 'municipio' | 'pyme' | 'colegio' | string;
export type BackofficeExportResource = 'tickets' | 'orders' | 'contacts' | 'team';
export type BackofficeExportFormat = 'pdf' | 'csv' | 'xlsx';

export interface BackofficeRecommendedView {
  id?: string;
  label?: string;
  description?: string;
  query?: Record<string, unknown>;
}

export interface BackofficeInboxSummaryResponse {
  [key: string]: unknown;
  contract_version: 'backoffice.inbox_summary.v1';
  request_id?: string;
  tenant_slug?: string;
  scope?: string;
  summary?: {
    total?: number;
    open?: number;
    unread?: number;
    sla_risk?: number;
    sla_breached?: number;
    sla_at_risk?: number;
    sla_known?: number;
    sla_unknown?: number;
    sla_eligible?: number;
    resolved?: number;
    unassigned?: number;
  };
  filters?: {
    channels?: unknown[];
    statuses?: unknown[];
    areas?: unknown[];
    agents?: unknown[];
    priorities?: unknown[];
    sla_statuses?: unknown[];
  };
  recommended_views?: BackofficeRecommendedView[];
}

export interface BackofficeOrdersSummaryResponse {
  [key: string]: unknown;
  contract_version: 'backoffice.orders_summary.v1';
  request_id?: string;
  tenant_slug: string;
  summary?: {
    total?: number;
    active?: number;
    finalized?: number;
    confirmed_revenue?: number;
    pending_revenue?: number;
    unassigned?: number | null;
  };
  statuses?: unknown[];
  active_orders?: unknown[];
  actions_by_status?: Record<string, unknown[]>;
  data_quality_notes?: string[];
}

export interface BackofficeContactsSummaryResponse {
  [key: string]: unknown;
  contract_version: 'backoffice.contacts_summary.v1';
  request_id?: string;
  tenant_slug: string;
  summary?: {
    total?: number;
    with_phone?: number;
    with_email?: number;
    opt_in_marketing?: number;
    possible_duplicates?: number;
    missing_minimum_data?: number;
  };
  main_channels?: unknown[];
  segments?: Record<string, unknown[]>;
  possible_duplicates?: unknown[];
}

export interface BackofficeTeamCoverageSummaryResponse {
  [key: string]: unknown;
  contract_version: 'backoffice.team_coverage_summary.v1';
  request_id?: string;
  tenant_slug: string;
  summary?: {
    active_employees?: number;
    covered_categories?: number;
    uncovered_categories?: number;
    covered_zones?: number;
    covered_channels?: number;
  };
  categories_covered?: unknown[];
  categories_without_owner?: unknown[];
  zones_covered?: unknown[];
  channels_covered?: unknown[];
  workload_by_agent?: unknown[];
  assignment_recommendations?: unknown[];
  editable_scopes?: unknown[];
  permissions?: Record<string, unknown>;
}

export interface BackofficeExportResponse {
  ok: true;
  request_id?: string;
  download_url: string;
  expires_at?: string;
}

export interface BackofficeExecutiveSummaryResponse {
  request_id?: string;
  headline?: string;
  risks?: unknown[];
  opportunities?: unknown[];
  recommended_actions?: unknown[];
  confidence?: number | string;
  data_quality_notes?: unknown[];
  source_endpoints?: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asRecordResponse = (value: unknown, endpoint: string): Record<string, unknown> => {
  if (isRecord(value)) return value;
  throw new ApiError(`Respuesta invalida de ${endpoint}.`, 502, value);
};

const requireContract = <T extends Record<string, unknown>>(
  value: unknown,
  endpoint: string,
  contractVersion?: string,
): T => {
  const record = asRecordResponse(value, endpoint);
  if (contractVersion && record.contract_version !== contractVersion) {
    throw new ApiError(`Contrato invalido de ${endpoint}.`, 502, record);
  }
  return record as T;
};

const requireTenantContract = <T extends Record<string, unknown>>(
  value: unknown,
  endpoint: string,
  contractVersion: string,
  tenantSlug?: string | null,
): T => {
  const record = requireContract<T>(value, endpoint, contractVersion);
  if (tenantSlug && record.tenant_slug !== tenantSlug) {
    throw new ApiError(`Organizacion invalida de ${endpoint}.`, 502, record);
  }
  return record;
};

const buildQuery = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const backofficeService = {
  getInboxSummary: async (params: {
    tenantSlug?: string | null;
    scope?: BackofficeScope | null;
  }, lifecycle: PrivateBackendReadLifecycle = {}): Promise<BackofficeInboxSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/operations/inbox-summary${buildQuery({
      tenant_slug: params.tenantSlug,
      scope: params.scope,
    })}`;
    const response = await privateBackendRead(endpoint, params.tenantSlug, lifecycle);
    return requireTenantContract<BackofficeInboxSummaryResponse>(response, endpoint, 'backoffice.inbox_summary.v1', params.tenantSlug);
  },

  getOrdersSummary: async (tenantSlug?: string | null, lifecycle: PrivateBackendReadLifecycle = {}): Promise<BackofficeOrdersSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/orders/summary${buildQuery({ tenant_slug: tenantSlug })}`;
    const response = await privateBackendRead(endpoint, tenantSlug, lifecycle);
    return requireTenantContract<BackofficeOrdersSummaryResponse>(response, endpoint, 'backoffice.orders_summary.v1', tenantSlug);
  },

  getContactsSummary: async (tenantSlug?: string | null, lifecycle: PrivateBackendReadLifecycle = {}): Promise<BackofficeContactsSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/contacts/summary${buildQuery({ tenant_slug: tenantSlug })}`;
    const response = await privateBackendRead(endpoint, tenantSlug, lifecycle);
    return requireTenantContract<BackofficeContactsSummaryResponse>(response, endpoint, 'backoffice.contacts_summary.v1', tenantSlug);
  },

  getTeamCoverageSummary: async (tenantSlug?: string | null, lifecycle: PrivateBackendReadLifecycle = {}): Promise<BackofficeTeamCoverageSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/team/coverage-summary${buildQuery({ tenant_slug: tenantSlug })}`;
    const response = await privateBackendRead(endpoint, tenantSlug, lifecycle);
    return requireTenantContract<BackofficeTeamCoverageSummaryResponse>(response, endpoint, 'backoffice.team_coverage_summary.v1', tenantSlug);
  },

  requestExport: async (payload: {
    tenant_slug?: string | null;
    resource: BackofficeExportResource;
    format: BackofficeExportFormat;
    filters?: Record<string, unknown>;
    include_ai_summary?: boolean;
  }, lifecycle: PrivateBackendReadLifecycle = {}): Promise<BackofficeExportResponse> => {
    const response = await apiFetch<unknown>('/api/v2/backoffice/export', {
      ...panelReadOptions(payload.tenant_slug),
      method: 'POST',
      body: payload,
      singleAttempt: true,
      allowStartupRecovery: false,
      isCurrent: lifecycle.isCurrent,
    });
    const record = asRecordResponse(response, '/api/v2/backoffice/export');
    const downloadUrl = typeof record.download_url === 'string' ? record.download_url.trim() : '';
    if (record.ok !== true || !downloadUrl) {
      throw new ApiError('Respuesta invalida de /api/v2/backoffice/export.', 502, record);
    }
    return record as unknown as BackofficeExportResponse;
  },

  requestExecutiveSummary: async (payload: {
    tenant_slug?: string | null;
    resource?: BackofficeExportResource | 'overview';
    filters?: Record<string, unknown>;
    source_endpoints?: string[];
  }, lifecycle: PrivateBackendReadLifecycle = {}): Promise<BackofficeExecutiveSummaryResponse> => {
    const response = await apiFetch<unknown>('/api/v2/backoffice/executive-summary', {
      ...panelReadOptions(payload.tenant_slug),
      method: 'POST',
      body: payload,
      singleAttempt: true,
      allowStartupRecovery: false,
      isCurrent: lifecycle.isCurrent,
    });
    return asRecordResponse(response, '/api/v2/backoffice/executive-summary') as BackofficeExecutiveSummaryResponse;
  },
};
