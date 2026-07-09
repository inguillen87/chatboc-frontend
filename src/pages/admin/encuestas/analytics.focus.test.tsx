import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SurveyAnalyticsPage from './[id]/analytics';

const mocks = vi.hoisted(() => ({
  useSurveyAdmin: vi.fn(),
  useSurveyAnalytics: vi.fn(),
  useAnchor: vi.fn(),
  useSurveyResponses: vi.fn(),
  useSurveySeedResponses: vi.fn(),
  getSurveyForecast: vi.fn(),
  getSurveyAlerts: vi.fn(),
  getSurveyBrief: vi.fn(),
  getSurveySegmentsCompare: vi.fn(),
  getSurveySegmentsSuggestions: vi.fn(),
  getSurveyAnomalies: vi.fn(),
  adminGetSurveyComments: vi.fn(),
  adminModerateSurveyComment: vi.fn(),
  trackEvent: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/hooks/useSurveyAnalytics', () => ({ useSurveyAnalytics: mocks.useSurveyAnalytics }));
vi.mock('@/hooks/useAnchor', () => ({ useAnchor: mocks.useAnchor }));
vi.mock('@/hooks/useSurveyResponses', () => ({ useSurveyResponses: mocks.useSurveyResponses }));
vi.mock('@/hooks/useSurveySeedResponses', () => ({ useSurveySeedResponses: mocks.useSurveySeedResponses }));
vi.mock('@/services/enterpriseService', () => ({ enterpriseService: { trackEvent: mocks.trackEvent } }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/components/surveys/SurveyAnalytics', () => ({
  SurveyAnalytics: () => <div data-testid="mock-survey-analytics">analytics</div>,
}));
vi.mock('@/components/surveys/SurveyLiveResultsPanel', () => ({
  SurveyLiveResultsPanel: () => <div data-testid="mock-survey-live-results">live results</div>,
}));
vi.mock('@/components/surveys/SurveyQrPreview', () => ({
  SurveyQrPreview: () => <div data-testid="mock-survey-qr">qr</div>,
}));
vi.mock('@/components/surveys/SurveyRecentResponses', () => ({
  SurveyRecentResponses: () => <div data-testid="mock-survey-responses">responses</div>,
}));
vi.mock('@/components/surveys/TransparencyTab', () => ({
  TransparencyTab: () => <div data-testid="mock-transparency">transparency</div>,
}));
vi.mock('@/api/encuestas', () => ({
  adminGetSurveyComments: mocks.adminGetSurveyComments,
  adminModerateSurveyComment: mocks.adminModerateSurveyComment,
  getSurveyForecast: mocks.getSurveyForecast,
  getSurveyAlerts: mocks.getSurveyAlerts,
  getSurveyBrief: mocks.getSurveyBrief,
  getSurveySegmentsCompare: mocks.getSurveySegmentsCompare,
  getSurveySegmentsSuggestions: mocks.getSurveySegmentsSuggestions,
  getSurveyAnomalies: mocks.getSurveyAnomalies,
}));

const surveyFixture = {
  id: 3,
  tenant_id: 10,
  tenant_slug: 'junin',
  slug: 'voto-plaza',
  slug_publico: 'voto-plaza-publica',
  canonical_slug: 'voto-plaza-publica',
  titulo: 'Votacion plaza',
  tipo: 'votacion',
  estado: 'publicada',
  es_votacion_envivo: true,
  mostrar_resultados_envivo: true,
  permitir_comentarios: true,
  recursos: {},
};

const dashboardBundleFixture = {
  survey_publication: {
    contract_version: 'survey.publication.v1',
    public_state: 'published',
    is_published: true,
    live_results_enabled: true,
    is_live_vote: true,
    slug_publico: 'voto-plaza-publica',
    links: {
      public_page_path: '/e/voto-plaza-publica',
      copy_url: '/e/voto-plaza-publica',
    },
    actions: [{ id: 'open_live_results', href: '/e/voto-plaza-publica?live=1' }],
  },
  modules: {},
  public_links: {},
};

function renderPage(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/encuestas/:id/analytics" element={<SurveyAnalyticsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SurveyAnalyticsPage operational focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.useSurveyAdmin.mockReturnValue({
      survey: surveyFixture,
      surveys: { data: [surveyFixture] },
      isLoadingSurvey: false,
      isLoadingList: false,
      surveyError: null,
      listError: null,
    });
    mocks.useSurveyAnalytics.mockReturnValue({
      summary: { total_respuestas: 2, demografia: {} },
      timeseries: [],
      heatmap: [],
      heatmapPayload: undefined,
      heatmapMeta: undefined,
      dashboardBundle: dashboardBundleFixture,
      executiveSummary: null,
      isLoading: false,
      exportCsv: vi.fn(),
      isExporting: false,
      filters: {},
      setFilters: vi.fn(),
      error: null,
    });
    mocks.useAnchor.mockReturnValue({
      snapshots: [],
      isLoading: false,
      create: vi.fn(),
      publish: vi.fn(),
      verify: vi.fn(),
      isCreating: false,
      isPublishing: false,
      isVerifying: false,
    });
    mocks.useSurveyResponses.mockReturnValue({
      responses: [],
      meta: {},
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useSurveySeedResponses.mockReturnValue({
      seed: vi.fn(),
      isSeeding: false,
      progress: null,
    });
    mocks.getSurveyForecast.mockResolvedValue({});
    mocks.getSurveyAlerts.mockResolvedValue([]);
    mocks.getSurveyBrief.mockResolvedValue(null);
    mocks.getSurveySegmentsCompare.mockResolvedValue({ buckets: [] });
    mocks.getSurveySegmentsSuggestions.mockResolvedValue({ dimensions: {} });
    mocks.getSurveyAnomalies.mockResolvedValue({ signals: [], risk_score: 0 });
    mocks.adminGetSurveyComments.mockResolvedValue([
      {
        id: 11,
        texto: 'Necesitamos mas horarios de atencion.',
        nombre_autor: 'Vecina Centro',
        fecha: '2026-07-09T12:00:00Z',
        estado: 'revision',
        report_count: 2,
      },
    ]);
    mocks.adminModerateSurveyComment.mockResolvedValue({ id: 11, estado: 'oculto', report_count: 2 });
  });

  it('opens analytics with a live operational focus', async () => {
    renderPage('/admin/encuestas/3/analytics?focus=live');

    expect(await screen.findByTestId('survey-analytics-focus-banner')).toHaveTextContent('Foco operativo: sala live');
    expect(screen.getByTestId('survey-live-results-focus')).toBeInTheDocument();
    expect(screen.getByTestId('mock-survey-live-results')).toBeInTheDocument();
  });

  it('loads and moderates admin comments from the focused analytics view', async () => {
    renderPage('/admin/encuestas/3/analytics?focus=comments');

    expect(await screen.findByTestId('survey-analytics-focus-banner')).toHaveTextContent('comentarios ciudadanos');
    expect(await screen.findByText('Necesitamos mas horarios de atencion.')).toBeInTheDocument();
    expect(mocks.adminGetSurveyComments).toHaveBeenCalledWith(
      3,
      { limit: 50, offset: 0 },
      expect.objectContaining({ tenantSlug: 'junin', sendAnonId: true }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Ocultar/i }));

    await waitFor(() => {
      expect(mocks.adminModerateSurveyComment).toHaveBeenCalledWith(
        11,
        'ocultar',
        expect.objectContaining({ tenantSlug: 'junin', sendAnonId: true }),
      );
    });
  });
});
