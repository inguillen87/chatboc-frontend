import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AnalyticsPage, { ANALYTICS_RESPONSE_TIMEOUT_MS, ANALYTICS_TOTAL_TIMEOUT_MS } from './AnalyticsPage';
import { analyticsService } from '@/services/analyticsService';
import { enterpriseService } from '@/services/enterpriseService';
import { ApiError } from '@/utils/api';
import { STARTUP_CONTINUITY_BUDGET_MS } from '@/utils/backendRequestContinuity';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const useUserMock = vi.hoisted(() => vi.fn<() => any>());
const useTenantMock = vi.hoisted(() => vi.fn<() => any>());
const readiness = vi.hoisted(() => vi.fn<() => Promise<void>>());

// Exercise navigation rather than the shared no-op useNavigate test stub.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

vi.mock('@/utils/backendBootstrapGate', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: readiness,
}));

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

vi.mock('@/components/analytics/OverviewDashboard', () => ({ default: ({ data, showSla, showConversion }: any) => <div>overview<span data-testid="overview-count">{data.kpis.total_interactions}</span><span data-testid="overview-kind">{showSla ? 'service' : showConversion ? 'commercial' : 'general'}</span></div> }));
vi.mock('@/components/analytics/IdentityCoverageBanner', () => ({ default: () => <div>identity</div> }));
vi.mock('@/components/analytics/HeatmapDashboard', () => ({ default: () => <div>heatmap</div> }));
vi.mock('@/components/analytics/InsightsDashboard', () => ({ default: ({ recommendations, recommendationsLoading }: any) => <div>insights{!recommendationsLoading ? recommendations?.map((text: string) => <p key={text}>{text}</p>) : null}</div> }));
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
    readiness.mockReset().mockResolvedValue(undefined);
    vi.mocked(analyticsService.getHub).mockReset().mockResolvedValue({ sections: {}, navigation: { primary: [] } });
    vi.mocked(analyticsService.getSummary).mockReset().mockResolvedValue({ kpis: { total_interactions: 0, active_users: 0, avg_response_time_s: 0 }, top_categories: [], volume_by_day: [], heatmap_points: [], insights: [] });
    vi.mocked(analyticsService.getRealtimeHub).mockReset().mockResolvedValue({ ui: { labels: {} }, totals: {} });
    window.localStorage.clear();
    useTenantMock.mockReturnValue({ currentSlug: null, tenant: { id: 333, tipo: 'pyme' } });
    useUserMock.mockReturnValue({ user: { id: 4, rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'junin', organization_profile: { tenant: { id: 22, slug: 'junin' } } } });
  });

  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('excludes sales from a verified municipal profile even when the hub exposes both kinds', async () => {
    vi.mocked(analyticsService.getHub).mockResolvedValueOnce({ sections: { general: {}, municipio: {}, ventas: {} } } as any);
    render(<MemoryRouter initialEntries={['/analytics?tenant_profile_id=22&focus=ventas']}><AnalyticsPage /></MemoryRouter>);
    expect(await screen.findByTestId('overview-kind')).toHaveTextContent('service');
    expect(screen.queryByRole('tab', { name: 'Ventas' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Municipio' })).toBeInTheDocument();
    expect(analyticsService.getHub).not.toHaveBeenCalledWith(expect.objectContaining({ context: 'pyme' }), expect.anything());
  });

  it('keeps the no-section fallback specific to a verified commercial organization', async () => {
    useUserMock.mockReturnValue({ user: { id: 99, rol: 'admin', tipo_chat: 'pyme', tenant_slug: 'bodega', organization_profile: { tenant: { id: 333, slug: 'bodega' } } } });
    render(<MemoryRouter initialEntries={['/analytics?tenant_profile_id=333&focus=municipio']}><AnalyticsPage /></MemoryRouter>);
    expect(await screen.findByTestId('overview-kind')).toHaveTextContent('commercial');
    expect(screen.getByRole('tab', { name: 'Ventas' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Municipio' })).not.toBeInTheDocument();
    expect(analyticsService.getHub).not.toHaveBeenCalledWith(expect.objectContaining({ context: 'municipio' }), expect.anything());
  });

  it('resets incompatible active context after a same-tenant verified organization type refresh', async () => {
    const initialUser = useUserMock().user;
    const view = render(<MemoryRouter initialEntries={['/analytics?focus=municipio']}><AnalyticsPage /></MemoryRouter>);
    await waitFor(() => expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ context: 'municipio', scope: 'municipio' }), expect.anything()));
    vi.mocked(analyticsService.getHub).mockClear();
    vi.mocked(analyticsService.getSummary).mockClear();
    useUserMock.mockReturnValue({ user: { ...initialUser, tipo_chat: 'pyme' } });
    view.rerender(<MemoryRouter initialEntries={['/analytics?focus=municipio']}><AnalyticsPage /></MemoryRouter>);
    await waitFor(() => expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ context: 'overview', scope: 'pyme' }), expect.anything()));
    expect(analyticsService.getHub).not.toHaveBeenCalledWith(expect.objectContaining({ context: 'municipio' }), expect.anything());
    expect(analyticsService.getSummary).not.toHaveBeenCalledWith(expect.objectContaining({ context: 'municipio' }), expect.anything());
    expect(screen.queryByRole('tab', { name: 'Municipio' })).not.toBeInTheDocument();
  });

  it('updates canonical focus after deliberate tab navigation without losing summary filters or tenant scope', async () => {
    const LocationProbe = () => <output data-testid="location">{useLocation().search}</output>;
    render(<MemoryRouter initialEntries={['/perfil?tab=analytics&tenant_slug=junin&focus=overview&view=overview&section=overview&range=30d&categoria=luminarias']}><AnalyticsPage /><LocationProbe /></MemoryRouter>);
    await screen.findByTestId('overview-count');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Operaciones' }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('operations')).toBeInTheDocument();
    const params = new URLSearchParams(screen.getByTestId('location').textContent || '');
    expect(params.get('focus')).toBe('operations');
    expect(params.has('view')).toBe(false);
    expect(params.has('section')).toBe(false);
    expect(params.get('tenant_slug')).toBe('junin');
    expect(params.get('range')).toBe('30d');
    expect(params.get('categoria')).toBe('luminarias');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'General' }), { button: 0, ctrlKey: false });
    expect(await screen.findByTestId('overview-count')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    expect(analyticsService.getSummary).toHaveBeenLastCalledWith(expect.objectContaining({ tenant_profile_id: 22, tenantSlug: 'junin', scope: 'municipio', categoria: 'luminarias' }), expect.anything());
  });

  it('keeps Mauricio profile 22 in the explicit namespace and skips platform leads', async () => {
    render(<MemoryRouter initialEntries={['/perfil?tab=analytics']}><AnalyticsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('operations')).toBeInTheDocument());
    expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 22, tenantSlug: 'junin', scope: 'municipio' }), expect.objectContaining({ strictAccess: true }));
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
    expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ tenant_profile_id: 46, tenantSlug: 'tierra-del-fuego' }), expect.objectContaining({ strictAccess: true }));
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
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }), expect.objectContaining({ strictAccess: true }));
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
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }), expect.objectContaining({ strictAccess: true }));
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
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'municipio' }), expect.objectContaining({ strictAccess: true }));
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
      expect(analyticsService.getHub).toHaveBeenCalledWith(expect.objectContaining({ scope: 'pyme', tenantSlug: 'bodega', tenant_profile_id: 333 }), expect.objectContaining({ strictAccess: true }));
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
      expect(screen.getByTestId('overview-count')).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: 'Mapas' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mapas de calor/i }));

    await waitFor(() => {
      expect(screen.getByText('operations')).toBeInTheDocument();
    });
    expect(screen.queryByText('heatmap')).not.toBeInTheDocument();
  });

  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(finish => { resolve = finish; });
    return { promise, resolve };
  };
  const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const openAnalytics = () => render(<MemoryRouter initialEntries={['/analytics?tenant_profile_id=22&range=7d']}><AnalyticsPage /></MemoryRouter>);
  const summary = (count: number) => ({ kpis: { total_interactions: count, active_users: 0, avg_response_time_s: 0 }, top_categories: [], volume_by_day: [], heatmap_points: [], insights: [] });

  it('waits for readiness and a hub response beyond the old 3.5s deadline without requiring retry', async () => {
    vi.useFakeTimers();
    const ready = deferred<void>(), hub = deferred<any>();
    readiness.mockReturnValueOnce(ready.promise);
    vi.mocked(analyticsService.getHub).mockReturnValueOnce(hub.promise);
    openAnalytics();
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(analyticsService.getHub).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    await act(async () => { ready.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(analyticsService.getHub).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    await act(async () => { hub.resolve({ sections: {}, navigation: { primary: [] } }); });
    expect(screen.getByTestId('overview-count')).toHaveTextContent('0');
  });

  it('bounds an attempt when readiness never settles and does not dispatch after late readiness', async () => {
    vi.useFakeTimers();
    const ready = deferred<void>();
    readiness.mockReturnValueOnce(ready.promise);
    openAnalytics();
    await act(async () => { await vi.advanceTimersByTimeAsync(ANALYTICS_TOTAL_TIMEOUT_MS); });
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(analyticsService.getHub).not.toHaveBeenCalled();
    await act(async () => { ready.resolve(); });
    expect(analyticsService.getHub).not.toHaveBeenCalled();
    expect(analyticsService.getSummary).not.toHaveBeenCalled();
    expect(enterpriseService.trackEvent).not.toHaveBeenCalled();
  });

  it('aborts a hung hub and allows one manual retry without accepting its late payload', async () => {
    vi.useFakeTimers();
    const oldHub = deferred<any>();
    vi.mocked(analyticsService.getHub).mockReturnValueOnce(oldHub.promise);
    openAnalytics();
    await flush();
    const oldOptions = vi.mocked(analyticsService.getHub).mock.calls[0][1]!;
    await act(async () => { await vi.advanceTimersByTimeAsync(STARTUP_CONTINUITY_BUDGET_MS + ANALYTICS_RESPONSE_TIMEOUT_MS); });
    expect(oldOptions.signal?.aborted).toBe(true);
    expect(oldOptions.isCurrent?.()).toBe(false);
    expect(analyticsService.getSummary).not.toHaveBeenCalled();
    expect(enterpriseService.trackEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await flush();
    expect(screen.getByTestId('overview-count')).toHaveTextContent('0');
    expect(analyticsService.getHub).toHaveBeenCalledTimes(2);
    expect(analyticsService.getSummary).toHaveBeenCalledTimes(1);
    await act(async () => { oldHub.resolve({ sections: { general: summary(999) } }); });
    expect(analyticsService.getSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('overview-count')).toHaveTextContent('0');
    expect(enterpriseService.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('accepts a successful summary beyond the old 5.5s deadline without retry', async () => {
    vi.useFakeTimers();
    const slowSummary = deferred<any>();
    vi.mocked(analyticsService.getSummary).mockReturnValueOnce(slowSummary.promise);
    openAnalytics();
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    await act(async () => { slowSummary.resolve(summary(7)); });
    expect(screen.getByTestId('overview-count')).toHaveTextContent('7');
    expect(analyticsService.getHub).toHaveBeenCalledTimes(1);
    expect(enterpriseService.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('retires a late summary after a timeout and manual retry', async () => {
    vi.useFakeTimers();
    const oldSummary = deferred<any>();
    vi.mocked(analyticsService.getSummary).mockReturnValueOnce(oldSummary.promise).mockResolvedValueOnce(summary(7));
    openAnalytics();
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(STARTUP_CONTINUITY_BUDGET_MS + ANALYTICS_RESPONSE_TIMEOUT_MS - 8_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await flush();
    expect(screen.getByTestId('overview-count')).toHaveTextContent('7');
    await act(async () => { oldSummary.resolve(summary(999)); });
    expect(screen.getByTestId('overview-count')).toHaveTextContent('7');
    expect(enterpriseService.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch or publish when the session changes during readiness', async () => {
    vi.useFakeTimers();
    const ready = deferred<void>();
    readiness.mockReturnValueOnce(ready.promise);
    const view = openAnalytics();
    advanceChatbocSessionRevision();
    await act(async () => { ready.resolve(); });
    expect(analyticsService.getHub).not.toHaveBeenCalled();
    expect(analyticsService.getSummary).not.toHaveBeenCalled();
    expect(enterpriseService.trackEvent).not.toHaveBeenCalled();
    view.unmount();
  });

  it('does not publish a hub payload after the session is retired', async () => {
    vi.useFakeTimers();
    const hub = deferred<any>();
    vi.mocked(analyticsService.getHub).mockReturnValueOnce(hub.promise);
    const view = openAnalytics();
    await flush();
    advanceChatbocSessionRevision();
    await act(async () => { hub.resolve({ sections: { general: summary(999) } }); });
    expect(analyticsService.getSummary).not.toHaveBeenCalled();
    expect(screen.queryByTestId('overview-count')).not.toBeInTheDocument();
    expect(enterpriseService.trackEvent).not.toHaveBeenCalled();
    view.unmount();
  });

  it('passes only the latest authorized realtime recommendations after a refresh', async () => {
    vi.useFakeTimers();
    const oldRealtime = deferred<any>();
    vi.mocked(analyticsService.getRealtimeHub).mockReturnValueOnce(oldRealtime.promise)
      .mockResolvedValueOnce({ recommendations: ['Acción del servicio actual'] });
    openAnalytics();
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(screen.getByText('Acción del servicio actual')).toBeInTheDocument();
    await act(async () => { oldRealtime.resolve({ recommendations: ['Acción de lectura vencida'] }); });
    expect(screen.queryByText('Acción de lectura vencida')).not.toBeInTheDocument();
    expect(screen.getByText('Acción del servicio actual')).toBeInTheDocument();
  });

  it('retires hub and realtime payloads when a different verified organization replaces the scope', async () => {
    vi.useFakeTimers();
    const oldHub = deferred<any>(), oldRealtime = deferred<any>();
    vi.mocked(analyticsService.getHub).mockReturnValueOnce(oldHub.promise);
    vi.mocked(analyticsService.getRealtimeHub).mockReturnValueOnce(oldRealtime.promise)
      .mockResolvedValueOnce({ recommendations: ['Acción de bodega'] });
    const view = render(<MemoryRouter initialEntries={['/perfil?tab=analytics']}><AnalyticsPage /></MemoryRouter>);
    await flush();
    const oldOptions = vi.mocked(analyticsService.getHub).mock.calls[0][1]!;
    useUserMock.mockReturnValue({ user: { id: 4, rol: 'admin', tipo_chat: 'pyme', tenant_slug: 'bodega', organization_profile: { tenant: { id: 333, slug: 'bodega' } } } });
    view.rerender(<MemoryRouter initialEntries={['/perfil?tab=analytics']}><AnalyticsPage /></MemoryRouter>);
    await flush();
    expect(oldOptions.signal?.aborted).toBe(true);
    expect(analyticsService.getHub).toHaveBeenLastCalledWith(expect.objectContaining({ tenant_profile_id: 333, tenantSlug: 'bodega', scope: 'pyme' }), expect.objectContaining({ strictAccess: true }));
    expect(screen.getByText('Acción de bodega')).toBeInTheDocument();
    await act(async () => {
      oldHub.resolve({ sections: { general: summary(999) } });
      oldRealtime.resolve({ recommendations: ['Acción de junin retirada'] });
    });
    expect(analyticsService.getSummary).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Acción de junin retirada')).not.toBeInTheDocument();
    expect(screen.getByText('Acción de bodega')).toBeInTheDocument();
  });
});
