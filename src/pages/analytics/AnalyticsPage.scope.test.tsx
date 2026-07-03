import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalyticsPage from './AnalyticsPage';
import { analyticsService } from '@/services/analyticsService';
import { ApiError } from '@/utils/api';

const useUserMock = vi.hoisted(() => vi.fn(() => ({ user: null })));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: null,
    tenant: { id: 333, tipo: 'pyme' },
  }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => useUserMock(),
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
    window.localStorage.clear();
    useUserMock.mockReturnValue({ user: null });
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

  it('prefers the stored panel user type over the default tenant provider type', async () => {
    window.localStorage.setItem(
      'user',
      JSON.stringify({
        id: 7,
        rol: 'admin',
        tipo_chat: 'municipio',
        tenant_slug: 'junin',
      }),
    );

    render(
      <MemoryRouter initialEntries={['/analytics?tenant_id=333&range=7d']}>
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
  });

  it('does not silently fallback a stored municipio user to pyme when summary returns 400', async () => {
    window.localStorage.setItem(
      'user',
      JSON.stringify({
        id: 7,
        rol: 'admin',
        tipo_chat: 'municipio',
        tenant_slug: 'junin',
      }),
    );
    vi.mocked(analyticsService.getSummary).mockRejectedValueOnce(
      new ApiError('Bad municipal scope', 400, { error: 'bad_scope' }),
    );

    render(
      <MemoryRouter initialEntries={['/analytics?tenant_id=333&range=7d']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getSummary).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'municipio' }),
        expect.anything(),
      );
    });

    expect(analyticsService.getSummary).not.toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'pyme' }),
      expect.anything(),
    );
  });

  it('locks embedded profile analytics to the logged municipio user even if the URL has scope pyme', async () => {
    useUserMock.mockReturnValue({
      user: {
        id: 7,
        rol: 'admin',
        tipo_chat: 'municipio',
        tenant_slug: 'junin',
      },
    });

    render(
      <MemoryRouter initialEntries={['/perfil?tab=analytics&tenant_id=333&range=7d&scope=pyme']}>
        <Routes>
          <Route path="/perfil" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }));
    });
  });

  it('prefers the stored municipio panel session over a live pyme user inside the profile CRM', async () => {
    window.localStorage.setItem(
      'user',
      JSON.stringify({
        id: 7,
        rol: 'admin',
        tipo_chat: 'municipio',
        tenant_slug: 'junin',
      }),
    );
    useUserMock.mockReturnValue({
      user: {
        id: 99,
        rol: 'admin',
        tipo_chat: 'pyme',
        tenant_slug: 'bodega',
      },
    });

    render(
      <MemoryRouter initialEntries={['/perfil?tab=analytics&tenant_id=333&range=7d&scope=pyme']}>
        <Routes>
          <Route path="/perfil" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }));
    });
  });

  it('opens the operational cockpit first inside the profile CRM', async () => {
    render(
      <MemoryRouter initialEntries={['/perfil?tab=analytics&tenant_id=333&range=7d']}>
        <Routes>
          <Route path="/perfil" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('operations')).toBeInTheDocument();
    });
  });

  it('routes maps, heatmaps and surveys focus links to the operational cockpit', async () => {
    render(
      <MemoryRouter initialEntries={['/analytics?tenant_id=333&focus=heatmap&range=7d']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('operations')).toBeInTheDocument();
    });
  });

  it('keeps heatmap navigation on the premium operations cockpit instead of the legacy geo tab', async () => {
    render(
      <MemoryRouter initialEntries={['/analytics?tenant_id=333&range=7d']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('overview')).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: 'Mapas' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mapas de calor/i }));

    await waitFor(() => {
      expect(screen.getByText('operations')).toBeInTheDocument();
    });
    expect(screen.queryByText('heatmap')).not.toBeInTheDocument();
  });
});
