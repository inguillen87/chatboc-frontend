import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SurveyAnalyticsPage from './[id]/analytics';
import segmentFixtures from '../../../../tests/fixtures/survey-segment-compare.json';

const mocks = vi.hoisted(() => ({
  currentSlug: null as string | null,
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
  adminListSurveyGovernanceReleases: vi.fn(),
  adminModerateSurveyComment: vi.fn(),
  trackEvent: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: mocks.currentSlug }) }));
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
  adminListSurveyGovernanceReleases: mocks.adminListSurveyGovernanceReleases,
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
    </QueryClientProvider>
  );
}

describe('SurveyAnalyticsPage operational focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentSlug = null;
    mocks.trackEvent.mockResolvedValue(undefined);
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
      provenance: { source: 'backend', synthetic: false, affected_modules: [] },
      isLoading: false,
      refresh: vi.fn(),
      isRefreshing: false,
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
    mocks.adminListSurveyGovernanceReleases.mockResolvedValue({
      ok: true,
      contract_version: 'surveys.governance_releases.v1',
      tenant: { id: 10, slug: 'junin' },
      survey_id: 3,
      survey_state: 'publicada',
      active_release_id: null,
      latest_release_id: null,
      capabilities: {
        read: true,
        manage: true,
        plan_allows_write: true,
        create_release: false,
        required_for_mutation: 'survey.governance.manage',
      },
      items: [],
      total: 0,
    });
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

  it('offers current backend territory series as a usable neighborhood filter', async () => {
    const state = mocks.useSurveyAnalytics.getMockImplementation()!();
    mocks.useSurveyAnalytics.mockReturnValue({ ...state,
      summary: { ...state.summary, demografia: { territorio: [
        { key: 'barrios', label: 'Barrios', series: [{ label: 'Centro QA', value: 4 }] },
      ] } },
    });
    renderPage('/admin/encuestas/3/analytics');
    const neighborhood = await screen.findByRole('combobox', { name: 'Barrio' });
    expect(neighborhood).not.toBeDisabled();
    fireEvent.keyDown(neighborhood, { key: 'ArrowDown' });
    fireEvent.keyDown(await screen.findByRole('option', { name: 'Centro QA' }), { key: 'Enter' });
    expect(state.setFilters).toHaveBeenCalledWith({ barrio: 'Centro QA' });
  });

  const segmentState = (key: keyof typeof segmentFixtures = 'main') => {
    mocks.currentSlug = 'junin';
    const report = structuredClone(segmentFixtures[key]);
    report.scope.survey_id = 3; report.scope.tenant_id = 10;
    const state = mocks.useSurveyAnalytics.getMockImplementation()!();
    mocks.useSurveyAnalytics.mockReturnValue({ ...state, evidenceCurrent: true,
      summary: { ...state.summary, total_respuestas: report.basis.selected_records, data_provenance: report.data_provenance },
      filters: report.scope.global_filters,
    });
    mocks.getSurveySegmentsSuggestions.mockResolvedValue({ dimensions: { canal: [
      { label: 'Canal WhatsApp publicado', filters: report.scope.segment_a_filters },
      { label: 'Canal web publicado', filters: report.scope.segment_b_filters },
    ] } });
    mocks.getSurveySegmentsCompare.mockResolvedValue(report);
    return report;
  };

  it('passes the global filters and source mode to suggestions and comparison', async () => {
    const report = segmentState('filtered'); renderPage('/admin/encuestas/3/analytics');
    await waitFor(() => expect(mocks.getSurveySegmentsSuggestions).toHaveBeenCalled());
    await waitFor(() => expect(mocks.getSurveySegmentsCompare).toHaveBeenCalled());
    expect(await screen.findByTestId('survey-segment-compare')).toHaveAttribute('data-selected-records', String(report.basis.selected_records));
    expect(mocks.getSurveySegmentsSuggestions).toHaveBeenCalledWith(3,
      expect.objectContaining({ barrio: 'centro', data_mode: 'real' }), expect.objectContaining({ tenantSlug: 'junin' }));
    expect(mocks.getSurveySegmentsCompare).toHaveBeenCalledWith(3,
      expect.objectContaining({ barrio: 'centro', data_mode: 'real', a_canal: 'whatsapp', b_canal: 'web' }),
      expect.objectContaining({ tenantSlug: 'junin' }));
  });

  it('refreshes a fresh cached comparison and hides it until the replacement read finishes', async () => {
    segmentState(); renderPage('/admin/encuestas/3/analytics');
    await screen.findByTestId('survey-segment-compare');
    const previousCalls = mocks.getSurveySegmentsCompare.mock.calls.length;
    let finish!: (value: unknown) => void;
    mocks.getSurveySegmentsCompare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Actualizar', exact: true })[0]);
    await waitFor(() => expect(mocks.getSurveySegmentsCompare).toHaveBeenCalledTimes(previousCalls + 1));
    await waitFor(() => expect(screen.queryByTestId('survey-segment-compare')).toBeNull());
    const updated = structuredClone(segmentFixtures.main); updated.scope.survey_id = 3; updated.scope.tenant_id = 10;
    updated.questions[0].label = 'Pregunta actualizada por el servidor';
    await act(async () => finish(updated));
    expect(await screen.findByTestId('survey-segment-compare')).toHaveTextContent('Pregunta actualizada por el servidor');
  });

  it('keeps the selected group identified when refreshed suggestions no longer contain it', async () => {
    segmentState(); renderPage('/admin/encuestas/3/analytics');
    await screen.findByTestId('survey-segment-compare');
    mocks.getSurveySegmentsSuggestions.mockResolvedValue({ dimensions: { canal: [
      { label: 'Canal WhatsApp publicado', filters: { canal: 'whatsapp' } },
    ] } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Actualizar', exact: true })[0]);
    await waitFor(() => expect(mocks.getSurveySegmentsSuggestions).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('survey-segment-compare')).toHaveTextContent('Canal web publicado');
    expect(document.getElementById('segment-b-selector')).toHaveTextContent('Canal web publicado');
  });

  it('withdraws a previous private result after a failed revalidation', async () => {
    segmentState(); renderPage('/admin/encuestas/3/analytics');
    await screen.findByTestId('survey-segment-compare');
    mocks.getSurveySegmentsCompare.mockRejectedValueOnce(Object.assign(new Error('Acceso revocado'), { status: 403 }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Actualizar', exact: true })[0]);
    await waitFor(() => expect(screen.queryByTestId('survey-segment-compare')).toBeNull());
    expect(await screen.findByText('Acceso revocado')).toBeVisible();
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
    expect(screen.getByText(/Exportá datos operativos/i)).toBeInTheDocument();
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

  it('reconciles a closed release by count and exposes the closure receipt', async () => {
    mocks.useSurveyAnalytics.mockReturnValue({
      summary: {
        total_respuestas: 8,
        participantes_unicos: 8,
        tasa_completitud: 100,
        preguntas: [],
        data_provenance: {
          contract_version: 'surveys.response_provenance.v1',
          mode: 'real',
          server_trusted_classification: true,
          contains_synthetic: false,
          real_responses_included: 8,
          synthetic_responses_included: 0,
          synthetic_responses_excluded: 3,
          unverified_responses_included: 0,
          unverified_responses_excluded: 1,
          synthetic_marker_contract: 'surveys.demo_seeding.v1',
        },
        demografia: {},
      },
      timeseries: [],
      heatmap: [],
      heatmapPayload: undefined,
      heatmapMeta: undefined,
      dashboardBundle: dashboardBundleFixture,
      executiveSummary: undefined,
      provenance: { source: 'backend', synthetic: false, affected_modules: [] },
      isLoading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      exportCsv: vi.fn(),
      isExporting: false,
      filters: {},
      setFilters: vi.fn(),
      error: null,
    });
    mocks.adminListSurveyGovernanceReleases.mockResolvedValue({
      ok: true,
      contract_version: 'surveys.governance_releases.v1',
      tenant: { id: 10, slug: 'junin' },
      survey_id: 3,
      survey_state: 'cerrada',
      active_release_id: null,
      latest_release_id: 5,
      capabilities: {
        read: true,
        manage: true,
        plan_allows_write: true,
        create_release: false,
        required_for_mutation: 'survey.governance.manage',
      },
      items: [
        {
          ok: true,
          contract_version: 'surveys.governance_release.v1',
          release_id: 5,
          survey_id: 3,
          version_number: 1,
          status: 'closed',
          snapshot_sha256: 'a'.repeat(64),
          policy_sha256: 'b'.repeat(64),
          published_at: '2026-09-04T11:00:00Z',
          closed_at: '2026-09-04T12:00:00Z',
          governance: {
            eligibility: {
              contract_version: 'surveys.eligibility_policy.v1',
              policy_version: 'eligibility-2026.1',
              mode: 'self_attested',
              declarations: ['resident_attested'],
              human_review_required: true,
              automated_decision: false,
              stores_roster_or_pii: false,
              decision_state: 'not_evaluated',
            },
            consent: {
              contract_version: 'surveys.consent_policy.v1',
              policy_version: 'consent-2026.1',
              public_text: 'Consentimiento institucional.',
              text_sha256: 'e'.repeat(64),
              required: true,
              stores_public_text: true,
              records_participant_input: false,
            },
            decision_rules: {
              contract_version: 'surveys.decision_rules.v1',
              quorum: { type: 'minimum_responses', value: 10 },
              tie: { procedure: 'human_review' },
              challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
              human_review_required: true,
              declarative_only: true,
              computed_outcome: null,
            },
          },
          capabilities: { can_publish: false, can_close: false },
          assurance: {
            scope: 'instrument_and_policy_integrity',
            regulated_election_certified: false,
            result_certified: false,
            external_verification: 'not_performed',
          },
          closure: {
            manifest_sha256: 'c'.repeat(64),
            manifest: {
              contract_version: 'surveys.closure_manifest.v1',
              tenant_id: 10,
              survey_id: 3,
              release_id: 5,
              release_version: 1,
              snapshot_sha256: 'a'.repeat(64),
              policy_sha256: 'b'.repeat(64),
              response_count: 12,
              response_set_sha256: 'd'.repeat(64),
              human_review_reference_sha256: 'f'.repeat(64),
              closed_at: '2026-09-04T12:00:00Z',
              assurance: {
                scope: 'local_database_closure_integrity',
                regulated_election_certified: false,
                result_certified: false,
                external_anchor_verified: false,
              },
            },
          },
        },
      ],
      total: 1,
    });

    renderPage('/admin/encuestas/3/analytics');

    await waitFor(() => {
      expect(mocks.adminListSurveyGovernanceReleases).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('survey-result-evidence-status')).toHaveTextContent('Cierre conciliado por conteo');
    });
    expect(screen.getByText('Sintéticas separadas').parentElement).toHaveTextContent('<5');
    expect(screen.getByText(/no valida la distribución ni el contenido de las respuestas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar recibo de cierre/i })).toBeEnabled();
    expect(mocks.adminListSurveyGovernanceReleases).toHaveBeenCalledWith(3, { tenantSlug: 'junin' });
  });
});
