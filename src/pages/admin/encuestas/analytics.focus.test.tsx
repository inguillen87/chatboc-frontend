import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  SurveyQrPreview: ({ slug, tenantSlug }: { slug: string; tenantSlug?: string | null }) => (
    <div data-testid="mock-survey-qr" data-slug={slug} data-tenant-slug={tenantSlug ?? ''}>
      qr
    </div>
  ),
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
  admin_operations: {
    contract_version: 'surveys.operations.v2',
    survey_id: 3,
    public_token: 'voto-plaza-publica',
    tenant_slug: 'junin',
    admin_surface: {
      id: 'survey_live_ops',
      label: 'Centro operativo de encuesta',
      href: '/admin/encuestas/3/analytics?focus=live_results&survey_slug=voto-plaza-publica&tenant_slug=junin',
      actions: [
        {
          id: 'open_live_results_admin',
          label: 'Monitorear en vivo',
          href: '/admin/encuestas/3/analytics?focus=live_results&survey_slug=voto-plaza-publica&tenant_slug=junin',
          enabled: true,
        },
        {
          id: 'open_heatmap_admin',
          label: 'Mapa operativo',
          href: '/admin/encuestas/3/analytics?focus=heatmap&include_heatmap=1&survey_slug=voto-plaza-publica&tenant_slug=junin',
          enabled: true,
        },
        {
          id: 'moderate_comments',
          label: 'Moderar comentarios',
          href: '/admin/encuestas/3/analytics?focus=moderation&survey_slug=voto-plaza-publica&tenant_slug=junin',
          enabled: true,
        },
        {
          id: 'share_whatsapp_qr',
          label: 'Compartir QR por WhatsApp',
          href: '/api/public/encuestas/v1/voto-plaza-publica/qr?tenant_slug=junin&size=320',
          enabled: true,
        },
      ],
    },
    analytics_surface: {
      heatmap_route: '/admin/encuestas/3/analytics?focus=heatmap&include_heatmap=1&survey_slug=voto-plaza-publica&tenant_slug=junin',
      moderation_route: '/admin/encuestas/3/analytics?focus=moderation&survey_slug=voto-plaza-publica&tenant_slug=junin',
    },
  },
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

  it('does not query or present public live results for an unpublished draft', async () => {
    const draftSurvey = {
      ...surveyFixture,
      estado: 'borrador',
      slug: 'borrador-otra-jurisdiccion',
      slug_publico: undefined,
      canonical_slug: undefined,
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'voting',
        phase: 'draft',
        persisted_state: 'borrador',
        accepts_responses: false,
        capabilities: {
          can_publish: false,
          can_close: false,
          can_delete: true,
          can_share: false,
          can_view_results: true,
        },
      },
    };
    mocks.useSurveyAdmin.mockReturnValue({
      survey: draftSurvey,
      surveys: { data: [draftSurvey] },
      isLoadingSurvey: false,
      isLoadingList: false,
      surveyError: null,
      listError: null,
    });
    mocks.useSurveyAnalytics.mockReturnValue({
      summary: { total_respuestas: 0, demografia: {} },
      timeseries: [],
      heatmap: [],
      heatmapPayload: undefined,
      heatmapMeta: undefined,
      dashboardBundle: { modules: {} },
      executiveSummary: null,
      isLoading: false,
      exportCsv: vi.fn(),
      isExporting: false,
      filters: {},
      setFilters: vi.fn(),
      error: null,
    });

    renderPage('/admin/encuestas/3/analytics?focus=live');

    expect(await screen.findByTestId('survey-live-results-publication-blocked')).toHaveTextContent(
      'No consultamos el endpoint público',
    );
    expect(screen.queryByTestId('mock-survey-live-results')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-survey-qr')).not.toBeInTheDocument();
  });

  it('does not expose synthetic response generation outside local development', async () => {
    renderPage('/admin/encuestas/3/analytics');

    expect(await screen.findByText('Centro de acciones de analytics')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /respuestas sintéticas|100 demo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Exportá y difundí los resultados/i)).toBeInTheDocument();
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

  it('renders backend admin operations and supports heatmap focus links', async () => {
    renderPage('/admin/encuestas/3/analytics?focus=heatmap&include_heatmap=1');

    expect(await screen.findByTestId('survey-analytics-focus-banner')).toHaveTextContent('mapa de calor');
    expect(screen.getByTestId('survey-analytics-visuals-focus')).toBeInTheDocument();

    const operationsCard = screen.getByTestId('survey-admin-operations-card');
    expect(operationsCard).toHaveTextContent('surveys.operations.v2');
    expect(operationsCard).toHaveTextContent('survey_live_ops');
    expect(operationsCard).toHaveTextContent('Monitorear en vivo');
    expect(operationsCard).toHaveTextContent('Mapa operativo');
    expect(operationsCard).toHaveTextContent('Moderar comentarios');
    expect(operationsCard).toHaveTextContent('Compartir por WhatsApp');
    expect(screen.getByTestId('mock-survey-qr')).toHaveAttribute(
      'data-slug',
      'voto-plaza-publica',
    );
    expect(screen.getByTestId('mock-survey-qr')).toHaveAttribute(
      'data-tenant-slug',
      'junin',
    );

    const operationLinks = within(operationsCard).getAllByRole('link', { name: /Abrir/i });
    expect(operationLinks.some((link) => link.getAttribute('href')?.includes('focus=heatmap'))).toBe(true);
    expect(operationLinks.some((link) => link.getAttribute('href')?.includes('focus=moderation'))).toBe(true);
    expect(
      operationLinks.some((link) => {
        const href = link.getAttribute('href') || '';
        return href.startsWith('https://wa.me/?text=') &&
          decodeURIComponent(href).includes('tenant_slug=junin');
      }),
    ).toBe(true);
  });
});
