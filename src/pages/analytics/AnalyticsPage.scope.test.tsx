import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalyticsPage from './AnalyticsPage';
import { analyticsService } from '@/services/analyticsService';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: null,
    tenant: { id: 333, tipo: 'pyme' },
  }),
}));

vi.mock('@/services/enterpriseService', () => ({
  enterpriseService: {
    getLeadInteractions: vi.fn().mockResolvedValue({ items: [] }),
    getExecutiveSummary: vi.fn().mockResolvedValue({ summary: '' }),
    trackEvent: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsService: {
    getHub: vi.fn().mockResolvedValue({ sections: {}, navigation: { primary: [] } }),
    getSummary: vi.fn().mockResolvedValue({
      kpis: {
        total_interactions: 0,
        active_users: 0,
        avg_response_time_s: 0,
      },
      top_categories: [],
      volume_by_day: [],
      heatmap_points: [],
      insights: [],
    }),
    getRealtimeHub: vi.fn().mockResolvedValue({
      ui: { labels: {} },
      totals: { events: 0, survey_responses: 0, survey_comments: 0, live_chat_comments: 0 },
    }),
    exportCsvUrl: vi.fn(() => '/export.csv'),
    exportPdfUrl: vi.fn(() => '/export.pdf'),
  },
}));

vi.mock('@/components/analytics/OverviewDashboard', () => ({ default: () => <div>overview</div> }));
vi.mock('@/components/analytics/IdentityCoverageBanner', () => ({ default: () => <div>identity</div> }));
vi.mock('@/components/analytics/HeatmapDashboard', () => ({ default: () => <div>heatmap</div> }));
vi.mock('@/components/analytics/InsightsDashboard', () => ({ default: () => <div>insights</div> }));
vi.mock('@/components/analytics/MunicipioDashboard', () => ({ default: () => <div>municipio</div> }));
vi.mock('@/components/analytics/PymeDashboard', () => ({ default: () => <div>pyme</div> }));
vi.mock('@/components/analytics/RealtimeHubDashboard', () => ({ default: () => <div>realtime</div> }));
vi.mock('@/components/analytics/EnterpriseAIPanel', () => ({ default: () => <div>enterprise-ai</div> }));
vi.mock('@/features/analytics/OperationsDashboardPanel', () => ({
  OperationsDashboardPanel: () => <div>operations</div>,
}));

describe('AnalyticsPage scope routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the explicit municipio scope from the URL even when the stored tenant type is pyme', async () => {
    render(
      <MemoryRouter initialEntries={['/analytics?tenant_id=333&scope=municipio&range=7d']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }));
    });

    expect(analyticsService.getSummary).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'municipio' }),
      expect.anything(),
    );
    expect(analyticsService.getRealtimeHub).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'municipio' }),
    );
  });
});
