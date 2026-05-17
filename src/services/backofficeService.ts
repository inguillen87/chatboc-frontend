import { ApiError, apiFetch } from '@/utils/api';

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
  contract_version: 'backoffice.inbox_summary.v1';
  request_id?: string;
  tenant_slug?: string;
  scope?: string;
  summary?: {
    total?: number;
    open?: number;
    unread?: number;
    sla_risk?: number;
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
  contract_version?: string;
  request_id?: string;
  tenant_slug?: string;
  totals_by_status?: Record<string, number>;
  active_orders?: number;
  finished_orders?: number;
  confirmed_revenue?: number;
  pending_revenue?: number;
  unassigned_orders?: number;
  allowed_actions_by_status?: Record<string, unknown[]>;
}

export interface BackofficeContactsSummaryResponse {
  contract_version?: string;
  request_id?: string;
  tenant_slug?: string;
  total_contacts?: number;
  with_phone?: number;
  with_email?: number;
  marketing_opt_in?: number;
  main_channels?: unknown[];
  segments?: Record<string, unknown[]>;
  possible_duplicates?: number;
  missing_minimum_data?: number;
}

export interface BackofficeTeamCoverageSummaryResponse {
  contract_version?: string;
  request_id?: string;
  tenant_slug?: string;
  active_employees?: number;
  covered_categories?: unknown[];
  uncovered_categories?: unknown[];
  covered_zones?: unknown[];
  covered_channels?: unknown[];
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
  }): Promise<BackofficeInboxSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/operations/inbox-summary${buildQuery({
      tenant_slug: params.tenantSlug,
      scope: params.scope,
    })}`;
    const response = await apiFetch<unknown>(endpoint, { tenantSlug: params.tenantSlug || undefined });
    return requireContract<BackofficeInboxSummaryResponse>(response, endpoint, 'backoffice.inbox_summary.v1');
  },

  getOrdersSummary: async (tenantSlug?: string | null): Promise<BackofficeOrdersSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/orders/summary${buildQuery({ tenant_slug: tenantSlug })}`;
    const response = await apiFetch<unknown>(endpoint, { tenantSlug: tenantSlug || undefined });
    return asRecordResponse(response, endpoint) as BackofficeOrdersSummaryResponse;
  },

  getContactsSummary: async (tenantSlug?: string | null): Promise<BackofficeContactsSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/contacts/summary${buildQuery({ tenant_slug: tenantSlug })}`;
    const response = await apiFetch<unknown>(endpoint, { tenantSlug: tenantSlug || undefined });
    return asRecordResponse(response, endpoint) as BackofficeContactsSummaryResponse;
  },

  getTeamCoverageSummary: async (tenantSlug?: string | null): Promise<BackofficeTeamCoverageSummaryResponse> => {
    const endpoint = `/api/v2/backoffice/team/coverage-summary${buildQuery({ tenant_slug: tenantSlug })}`;
    const response = await apiFetch<unknown>(endpoint, { tenantSlug: tenantSlug || undefined });
    return asRecordResponse(response, endpoint) as BackofficeTeamCoverageSummaryResponse;
  },

  requestExport: async (payload: {
    tenant_slug?: string | null;
    resource: BackofficeExportResource;
    format: BackofficeExportFormat;
    filters?: Record<string, unknown>;
    include_ai_summary?: boolean;
  }): Promise<BackofficeExportResponse> => {
    const response = await apiFetch<unknown>('/api/v2/backoffice/export', {
      method: 'POST',
      body: payload,
      tenantSlug: payload.tenant_slug || undefined,
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
  }): Promise<BackofficeExecutiveSummaryResponse> => {
    const response = await apiFetch<unknown>('/api/v2/backoffice/executive-summary', {
      method: 'POST',
      body: payload,
      tenantSlug: payload.tenant_slug || undefined,
    });
    return asRecordResponse(response, '/api/v2/backoffice/executive-summary') as BackofficeExecutiveSummaryResponse;
  },
};
