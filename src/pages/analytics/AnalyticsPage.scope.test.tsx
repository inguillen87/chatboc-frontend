import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalyticsPage from './AnalyticsPage';
import { analyticsService } from '@/services/analyticsService';
import { enterpriseService } from '@/services/enterpriseService';
import { ApiError } from '@/utils/api';

const useUserMock = vi.hoisted(() => vi.fn<() => any>());
const useTenantMock = vi.hoisted(() => vi.fn<() => any>());

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ loading: false, hasVerifiedSession: true, organizationProfileVerified: true, ...useUserMock() }),
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
    useTenantMock.mockReturnValue({ currentSlug: null, tenant: { id: 333, tipo: 'pyme' } });
    useUserMock.mockReturnValue({ user: { id: 4, rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'junin', organization_profile: { tenant: { id: 22, slug: 'junin' } } } });
  });

  it('keeps Mauricio profile 22 in the explicit namespace and skips platform leads', async () => {
    render(<MemoryRouter initialEntries={['/perfil?tab=analytics']}><AnalyticsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('operations')).toBeInTheDocument());
    expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 22, tenantSlug: 'junin', scope: 'municipio' }), { strictAccess: true });
    expect(analyticsService.getSummary).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 22 }), expect.anything());
    expect(analyticsService.getRealtimeHub).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 22, tenantSlug: 'junin' }));
    expect(vi.mocked(analyticsService.getHub).mock.calls[0][0]).not.toHaveProperty('tenant_id');
    expect(enterpriseService.getLeadInteractions).not.toHaveBeenCalled();
    expect(enterpriseService.trackEvent).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 22 }), 'junin');
    fireEvent.click(screen.getByRole('button', { name: 'Resumen ejecutivo IA' }));
    await waitFor(() => expect(enterpriseService.getExecutiveSummary).toHaveBeenCalled());
    expect(vi.mocked(enterpriseService.getExecutiveSummary).mock.calls[0][0]).not.toHaveProperty('tenant_id');
    expect(vi.mocked(enterpriseService.getExecutiveSummary).mock.calls[0][1]).toBe('junin');
  });

  it.each(['?tab=analytics&tenant_slug=foreign', '?tab=analytics&tenant_profile_id=46', '?tab=analytics&tenant_id=4'])('rejects a foreign or owner-valued profile selection %s before reads', async (search) => {
    render(<MemoryRouter initialEntries={[`/perfil${search}`]}><AnalyticsPage /></MemoryRouter>);
    expect(await screen.findByText('Seleccioná una organización')).toBeInTheDocument();
    expect(analyticsService.getHub).not.toHaveBeenCalled();
    expect(enterpriseService.getLeadInteractions).not.toHaveBeenCalled();
  });

  it('retains platform reads only with verified actor and explicit organization selection', async () => {
    useUserMock.mockReturnValue({ user: { id: 5, rol: 'super_admin' } });
    useTenantMock.mockReturnValue({ tenant: { id: 46, slug: 'tierra-del-fuego', tipo: 'municipio' } });
    render(<MemoryRouter initialEntries={['/analytics?tenant_slug=tierra-del-fuego']}><AnalyticsPage /></MemoryRouter>);
    await waitFor(() => expect(enterpriseService.getLeadInteractions).toHaveBeenCalled());
    expect(enterpriseService.getLeadInteractions).toHaveBeenCalledWith(expect.not.objectContaining({ tenant_id: expect.anything() }), 'tierra-del-fuego');
    expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 46, tenantSlug: 'tierra-del-fuego' }), { strictAccess: true });
  });

  it.each([new ApiError('denied', 401), new ApiError('denied', 403), new DOMException('session changed', 'AbortError')])('does not request summary after hub rejection $name/$status', async (error) => {
    vi.mocked(analyticsService.getHub).mockRejectedValueOnce(error);
    render(<MemoryRouter initialEntries={['/analytics?tenant_id=22&range=7d']}><AnalyticsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument());
    expect(analyticsService.getSummary).not.toHaveBeenCalled();
  });

  it('keeps the explicit municipio scope from the URL even when the stored tenant type is pyme', async () => {
    render(
      <MemoryRouter initialEntries={['/analytics?tenant_id=22&scope=municipio&range=7d']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }), { strictAccess: true });
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
      <MemoryRouter initialEntries={['/analytics?tenant_id=22&range=7d']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }), { strictAccess: true });
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
      <MemoryRouter initialEntries={['/analytics?tenant_id=22&range=7d']}>
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
        organization_profile: { tenant: { id: 22, slug: 'junin' } },
      },
    });

    render(
      <MemoryRouter initialEntries={['/perfil?tab=analytics&tenant_id=22&range=7d&scope=pyme']}>
        <Routes>
          <Route path="/perfil" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }), { strictAccess: true });
    });
  });

  it('uses the verified live company profile despite an older stored municipal session', async () => {
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
        organization_profile: { tenant: { id: 333, slug: 'bodega' } },
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
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'pyme', tenantSlug: 'bodega', tenant_profile_id: 333 }), { strictAccess: true });
    });
  });

  it('opens the operational cockpit first inside the profile CRM', async () => {
    render(
      <MemoryRouter initialEntries={['/perfil?tab=analytics&tenant_id=22&range=7d']}>
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
      <MemoryRouter initialEntries={['/analytics?tenant_id=22&focus=heatmap&range=7d']}>
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
      <MemoryRouter initialEntries={['/analytics?tenant_id=22&range=7d']}>
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
