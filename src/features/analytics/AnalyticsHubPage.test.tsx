import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch } from '@/utils/api';
import AnalyticsHubPage from './AnalyticsHubPage';
import { getAnalyticsOverviewV2 } from './analyticsApi';

vi.mock('./usePrivateAnalyticsScope', () => ({
  usePrivateAnalyticsScope: () => ({
    scope: { tenantSlug: 'org-a', scopeKey: 'org-a:operator' },
    pending: false,
    key: 'org-a:operator',
  }),
}));
vi.mock('./OperationsDashboardPanel', () => ({ OperationsDashboardPanel: () => null }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));

const satisfaction = {
  contract_version: 'analytics.ticket_satisfaction.v1',
  basis: 'first_valid_rating_recorded_at',
  scale_verified: false,
  label: 'Casos con calificación',
  detail: 'Cada caso cuenta una vez, en la fecha de su primera calificación válida.',
  state: 'observed',
  rated_ticket_count: 0,
};

const overview = {
  tenant_slug: 'org-a',
  summary: { conversations: 7, survey_responses: 2, csat: 0, nps: null },
  csat_score: 0,
};

const transport = vi.mocked(apiFetch);

function renderHub() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AnalyticsHubPage /></QueryClientProvider>);
}

beforeEach(() => {
  transport.mockReset();
});

describe('ticket satisfaction in the executive hub', () => {
  it('shows a verified count of zero and the server explanation beside the separate survey count', async () => {
    transport.mockResolvedValue({ ...overview, ticket_satisfaction: satisfaction });
    renderHub();

    expect(await screen.findByText(satisfaction.label)).toBeVisible();
    expect(screen.getByText(satisfaction.detail)).toBeVisible();
    expect(screen.getByText('0', { exact: true })).toBeVisible();
    expect(screen.getAllByText('2', { exact: true })).toHaveLength(2);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('CSAT')).not.toBeInTheDocument();
    expect(transport).toHaveBeenCalledWith('/api/v2/analytics/overview', expect.objectContaining({
      tenantSlug: 'org-a',
      headers: { 'X-Tenant-Slug': 'org-a' },
    }));
  });

  it('renders the server explanation when the count is unavailable, even without other indicators', async () => {
    const detail = 'La medición no está disponible para este período.';
    transport.mockResolvedValue({
      tenant_slug: 'org-a',
      ticket_satisfaction: { ...satisfaction, state: 'unavailable', rated_ticket_count: null, detail },
    });
    renderHub();

    expect(await screen.findByText('Sin datos')).toBeVisible();
    expect(screen.getByText(detail)).toBeVisible();
    expect(screen.queryByText('0', { exact: true })).not.toBeInTheDocument();
  });

  it('does not infer a rating count from the legacy overview', async () => {
    transport.mockRejectedValueOnce(new ApiError('Not found', 404)).mockResolvedValueOnce(overview);
    renderHub();

    expect(await screen.findByText('Sin datos')).toBeVisible();
    expect(screen.queryByText('0', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('CSAT')).not.toBeInTheDocument();
    expect(transport).toHaveBeenNthCalledWith(2, '/analytics/overview', expect.anything());
  });

  it('keeps legacy indicators but omits satisfaction without an explicit overview organization', async () => {
    transport.mockResolvedValue({
      summary: overview.summary,
      tenant: { slug: 'org-a' },
      ticket_satisfaction: satisfaction,
    });
    renderHub();

    expect(await screen.findByText('Sin datos')).toBeVisible();
    expect(screen.getAllByText('7', { exact: true })).toHaveLength(2);
    expect(screen.queryByText(satisfaction.label)).not.toBeInTheDocument();
    expect(screen.queryByText(satisfaction.detail)).not.toBeInTheDocument();
    expect(screen.queryByText('0', { exact: true })).not.toBeInTheDocument();
  });

  it('rejects a versioned overview with a foreign organization echo', async () => {
    transport.mockResolvedValue({ ...overview, tenant_slug: 'org-b', ticket_satisfaction: satisfaction });

    await expect(getAnalyticsOverviewV2('org-a')).rejects.toMatchObject({ status: 403 });
  });

  it('omits the count when the caller has no active organization', async () => {
    transport.mockResolvedValue({ ...overview, ticket_satisfaction: satisfaction });

    const data = await getAnalyticsOverviewV2();
    expect(data).toMatchObject({ conversations: 7 });
    expect(data.ticket_satisfaction).toBeUndefined();
  });

  it.each([
    { rated_ticket_count: '0' },
    { rated_ticket_count: -1 },
    { rated_ticket_count: 0.5 },
    { rated_ticket_count: Number.MAX_SAFE_INTEGER + 1 },
    { rated_ticket_count: null },
    { state: 'unavailable' },
    { contract_version: 'analytics.ticket_satisfaction.v2' },
    { basis: 'survey_completion' },
    { scale_verified: true },
    { label: ' ' },
    { label: 'x'.repeat(81) },
    { detail: ' ' },
    { detail: 'x'.repeat(321) },
  ])('omits a malformed satisfaction contract without losing overview metrics (%j)', async (invalid) => {
    transport.mockResolvedValue({ ...overview, ticket_satisfaction: { ...satisfaction, ...invalid } });

    const data = await getAnalyticsOverviewV2('org-a');
    expect(data).toMatchObject({ conversations: 7, survey_responses: 2 });
    expect(data.ticket_satisfaction).toBeUndefined();
    expect(data).not.toHaveProperty('csat');
  });
});
