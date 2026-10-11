import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSurveyPublic: vi.fn(),
  useSurveyLiveResults: vi.fn(),
  trackSurveySubmission: vi.fn(),
  trackSurveyDemoInteraction: vi.fn(),
  toast: vi.fn(),
  formSubmissionResolved: vi.fn(),
  formSubmissionRejected: vi.fn(),
  socketOptions: undefined as any,
}));

vi.mock('@/hooks/useSurveyPublic', () => ({
  useSurveyPublic: mocks.useSurveyPublic,
}));

vi.mock('@/hooks/useSurveyLiveResults', () => ({
  hasSurveyLiveActivity: () => false,
  useSurveyLiveResults: mocks.useSurveyLiveResults,
}));

vi.mock('@/hooks/useSurveySocket', () => ({
  useSurveySocket: vi.fn((options: any) => { mocks.socketOptions = options; }),
}));

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));

vi.mock('@/components/surveys/SurveyForm', () => ({
  SurveyForm: ({
    onSubmit,
    readOnly,
    showLiveResults,
    submitLabel,
  }: {
    onSubmit: (payload: {
      submission_id: string;
      respuestas: Array<{ pregunta_id: number; opcion_ids: number[] }>;
    }) => Promise<unknown>;
    readOnly?: boolean;
    showLiveResults?: boolean;
    submitLabel?: string;
  }) => (
    <div
      data-testid={readOnly ? 'mock-survey-results' : 'mock-survey-form'}
      data-show-live-results={String(Boolean(showLiveResults))}
    >
      {!readOnly ? (
        <button
          type="button"
          onClick={() => void onSubmit({
            submission_id: '018f4c8e-1e56-7f38-a4df-83fd68394876',
            respuestas: [{ pregunta_id: 1, opcion_ids: [10] }],
          }).then(mocks.formSubmissionResolved, mocks.formSubmissionRejected)}
        >
          {submitLabel || 'Enviar prueba'}
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('@/utils/surveyAnalytics', () => ({
  trackSurveyCtaClicked: vi.fn(),
  trackSurveyErrorRendered: vi.fn(),
  trackSurveyLoadError: vi.fn(),
  trackSurveyPageView: vi.fn(),
  trackSurveyRetryTriggered: vi.fn(),
  trackSurveySubmission: mocks.trackSurveySubmission,
  trackSurveyDemoInteraction: mocks.trackSurveyDemoInteraction,
}));

import PublicSurveyPage, { resolvePublicSurveyBrandLabel } from './[slug]';
import type { SurveyPublic } from '@/types/encuestas';
import { ApiError } from '@/utils/api';

const publicBrandSurvey = (
  tenant: SurveyPublic['tenant'],
  tenantSlug?: string | null,
): SurveyPublic => ({
  slug: 'consulta-publica',
  tenant_slug: tenantSlug,
  tenant,
  titulo: 'Consulta pública',
  tipo: 'opinion',
  inicio_at: '2026-08-01T00:00:00-03:00',
  fin_at: null,
  politica_unicidad: 'libre',
  preguntas: [],
});

describe('public survey tenant branding', () => {
  it.each([
    ['tdf', 'Gobierno de Tierra del Fuego'],
    ['mendoza', 'Gobierno de Mendoza'],
  ])('uses the matching server-owned %s tenant identity', (tenantSlug, tenantName) => {
    const survey = publicBrandSurvey({ slug: tenantSlug, nombre: tenantName }, tenantSlug);

    expect(resolvePublicSurveyBrandLabel(survey, tenantSlug)).toBe(tenantName);
  });

  it('uses neutral branding when the response has no server-owned tenant identity', () => {
    const survey = {
      ...publicBrandSurvey(null, 'mendoza'),
      branding: { public_name: 'Junín Participa' },
      municipio_nombre: 'Municipalidad de Junín',
    };

    expect(resolvePublicSurveyBrandLabel(survey, 'mendoza')).toBe('Participación ciudadana');
  });

  it('fails closed when the requested tenant and response tenant do not match', () => {
    const survey = publicBrandSurvey(
      { slug: 'tdf', nombre: 'Gobierno de Tierra del Fuego' },
      'tdf',
    );

    expect(resolvePublicSurveyBrandLabel(survey, 'mendoza')).toBe('Participación ciudadana');
  });

  it('fails closed when a supplied tenant selector is malformed', () => {
    const survey = publicBrandSurvey(
      { slug: 'mendoza', nombre: 'Gobierno de Mendoza' },
      'mendoza',
    );

    expect(resolvePublicSurveyBrandLabel(survey, '../mendoza')).toBe('Participación ciudadana');
  });
});

describe('PublicSurveyPage loading experience', () => {
  beforeEach(() => {
    mocks.trackSurveySubmission.mockReset();
    mocks.trackSurveyDemoInteraction.mockReset();
    mocks.toast.mockReset();
    mocks.formSubmissionResolved.mockReset();
    mocks.formSubmissionRejected.mockReset();
    mocks.useSurveyPublic.mockReset().mockReturnValue({
      survey: undefined,
      isLoading: true,
      isRefetching: false,
      failureCount: 0,
      error: null,
      errorStatus: null,
      errorDetails: null,
      errorReasonCode: null,
      isTransientError: false,
      retryLoad: vi.fn(),
      submit: vi.fn(),
      isSubmitting: false,
      submitError: null,
      submitStatus: null,
      submitErrorDetails: null,
      submitReasonCode: null,
    });
    mocks.useSurveyLiveResults.mockReset().mockReturnValue({
      liveResults: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      consecutiveErrors: 0,
      liveStatus: {
        status: 'idle',
        label: 'En espera',
        description: 'Resultados en espera.',
      },
      pollingIntervalMs: null,
      refetch: vi.fn(),
    });
  });

  it.each([
    { journey: 'A→B', returnToOriginalOrganization: false, rejectAck: false, retireByUnmount: false },
    { journey: 'A→B→A', returnToOriginalOrganization: true, rejectAck: false, retireByUnmount: false },
    { journey: 'A→B with rejection', returnToOriginalOrganization: false, rejectAck: true, retireByUnmount: false },
    { journey: 'A→B→A with rejection', returnToOriginalOrganization: true, rejectAck: true, retireByUnmount: false },
    { journey: 'unmount with acknowledgement', returnToOriginalOrganization: false, rejectAck: false, retireByUnmount: true },
    { journey: 'unmount with rejection', returnToOriginalOrganization: false, rejectAck: true, retireByUnmount: true },
  ])(
    'ignores a deferred acknowledgement after organization $journey instead of replacing the current participation form',
    async ({ returnToOriginalOrganization, rejectAck, retireByUnmount }) => {
      const { useNavigate: useActualNavigate } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
      const publicDefaults = mocks.useSurveyPublic();
      const liveDefaults = mocks.useSurveyLiveResults();
      let acknowledgeOriginal!: (ack: { ack_kind: 'durable_response' }) => void;
      let rejectOriginal!: (error: Error) => void;
      const pendingOriginal = new Promise<{ ack_kind: 'durable_response' }>((resolve, reject) => {
        acknowledgeOriginal = resolve;
        rejectOriginal = reject;
      });
      const submitOriginal = vi.fn().mockReturnValue(pendingOriginal);
      const submitOther = vi.fn().mockResolvedValue({ ack_kind: 'durable_response' });
      const refetchOriginal = vi.fn();
      const refetchOther = vi.fn();

      mocks.useSurveyPublic.mockImplementation((_slug: string, options: { tenantSlug: string }) => {
        const original = options.tenantSlug === 'organizacion-a';
        return {
          ...publicDefaults,
          survey: {
            ...publicBrandSurvey(
              { slug: options.tenantSlug, nombre: original ? 'Organización A' : 'Organización B' },
              options.tenantSlug,
            ),
            public_state: { is_open: true, accepts_responses: true, server_time: '2026-01-01T00:00:00Z' },
          },
          isLoading: false,
          submit: original ? submitOriginal : submitOther,
        };
      });
      mocks.useSurveyLiveResults.mockImplementation((_slug: string, tenant: string) => ({
        ...liveDefaults,
        refetch: tenant === 'organizacion-a' ? refetchOriginal : refetchOther,
      }));

      function OrganizationNavigation() {
        const navigate = useActualNavigate();
        const [params] = useSearchParams();
        return (
          <div>
            <output data-testid="current-public-survey-organization">{params.get('tenant_slug')}</output>
            <button type="button" onClick={() => navigate('/e/consulta-publica?tenant_slug=organizacion-b')}>Cambiar a organización B</button>
            <button type="button" onClick={() => navigate('/e/consulta-publica?tenant_slug=organizacion-a')}>Cambiar a organización A</button>
          </div>
        );
      }

      const view = render(
        <MemoryRouter initialEntries={['/e/consulta-publica?tenant_slug=organizacion-a']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <OrganizationNavigation />
          <Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /></Routes>
        </MemoryRouter>,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Enviar prueba' }));
      expect(submitOriginal).toHaveBeenCalledTimes(1);
      if (retireByUnmount) {
        view.unmount();
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar a organización B' }));
        await waitFor(() => expect(screen.getByTestId('current-public-survey-organization')).toHaveTextContent('organizacion-b'));
        if (returnToOriginalOrganization) {
          fireEvent.click(screen.getByRole('button', { name: 'Cambiar a organización A' }));
          await waitFor(() => expect(screen.getByTestId('current-public-survey-organization')).toHaveTextContent('organizacion-a'));
        }
        expect(screen.getByTestId('mock-survey-form')).toBeVisible();
      }

      await act(async () => {
        if (rejectAck) rejectOriginal(new Error('Original submission rejected'));
        else acknowledgeOriginal({ ack_kind: 'durable_response' });
        await pendingOriginal.catch(() => undefined);
        await Promise.resolve();
      });

      expect(screen.queryByRole('heading', { name: '¡Gracias por participar!' })).not.toBeInTheDocument();
      if (!retireByUnmount) expect(screen.getByTestId('mock-survey-form')).toBeVisible();
      expect(mocks.formSubmissionResolved).not.toHaveBeenCalled();
      expect(mocks.formSubmissionRejected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'AbortError' }));
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(mocks.trackSurveySubmission).not.toHaveBeenCalled();
      expect(refetchOriginal).not.toHaveBeenCalled();
      expect(refetchOther).not.toHaveBeenCalled();
      expect(submitOriginal).toHaveBeenCalledTimes(1);
      expect(submitOther).not.toHaveBeenCalled();
    },
  );

  it.each(['survey id', 'instrument revision', 'server tenant identity'])(
    'retires a deferred acknowledgement when the %s changes in the same route',
    async (change) => {
      let acknowledge!: (ack: { ack_kind: 'durable_response' }) => void;
      const submit = vi.fn().mockReturnValue(new Promise((resolve) => { acknowledge = resolve; }));
      const defaults = mocks.useSurveyPublic();
      let survey: SurveyPublic = {
        ...publicBrandSurvey({ id: 12, slug: 'organizacion-a', nombre: 'Organización A' }, 'organizacion-a'),
        id: 41, instrument_revision: 1,
      };
      mocks.useSurveyPublic.mockImplementation(() => ({ ...defaults, survey, isLoading: false, submit }));
      const content = () => <MemoryRouter initialEntries={['/e/consulta-publica?tenant_slug=organizacion-a']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /></Routes></MemoryRouter>;
      const view = render(content());
      fireEvent.click(await screen.findByRole('button', { name: 'Enviar prueba' }));
      survey = {
        ...survey,
        ...(change === 'survey id' ? { id: 42 } : {}),
        ...(change === 'instrument revision' ? { instrument_revision: 2 } : {}),
        ...(change === 'server tenant identity' ? { tenant: { ...survey.tenant!, id: 13 } } : {}),
      };
      view.rerender(content());
      await act(async () => { acknowledge({ ack_kind: 'durable_response' }); });

      expect(screen.queryByRole('heading', { name: '¡Gracias por participar!' })).not.toBeInTheDocument();
      expect(screen.getByTestId('mock-survey-form')).toBeVisible();
      expect(mocks.formSubmissionResolved).not.toHaveBeenCalled();
      expect(mocks.formSubmissionRejected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'AbortError' }));
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(mocks.trackSurveySubmission).not.toHaveBeenCalled();
      expect(mocks.useSurveyLiveResults().refetch).not.toHaveBeenCalled();
      expect(submit).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts the current durable acknowledgement once and resets completion for a newly published instrument', async () => {
    const submit = vi.fn().mockResolvedValue({ ack_kind: 'durable_response' });
    const defaults = mocks.useSurveyPublic();
    let survey: SurveyPublic = {
      ...publicBrandSurvey({ id: 12, slug: 'organizacion-a', nombre: 'Organización A' }, 'organizacion-a'),
      id: 41, instrument_revision: 1,
    };
    mocks.useSurveyPublic.mockImplementation(() => ({ ...defaults, survey, isLoading: false, submit }));
    const content = () => <MemoryRouter initialEntries={['/e/consulta-publica?tenant_slug=organizacion-a']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /></Routes></MemoryRouter>;
    const view = render(content());
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar prueba' }));
    expect(await screen.findByRole('heading', { name: '¡Gracias por participar!' })).toBeVisible();
    expect(mocks.formSubmissionResolved).toHaveBeenCalledTimes(1);
    expect(mocks.formSubmissionRejected).not.toHaveBeenCalled();
    expect(mocks.trackSurveySubmission).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.useSurveyLiveResults().refetch).toHaveBeenCalledTimes(1));

    survey = { ...survey, instrument_revision: 2 };
    view.rerender(content());
    expect(screen.queryByRole('heading', { name: '¡Gracias por participar!' })).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-survey-form')).toBeVisible();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each(['ambiguous acknowledgement', 'duplicate response'])(
    'preserves the current %s error without a success or another submission',
    async (outcome) => {
      const duplicate = new ApiError('Duplicate response', 409, { reason_code: 'survey_response_duplicate' });
      const submit = outcome === 'duplicate response'
        ? vi.fn().mockRejectedValue(duplicate)
        : vi.fn().mockResolvedValue({ ack_kind: 'synthetic_demo' });
      mocks.useSurveyPublic.mockReturnValue({
        ...mocks.useSurveyPublic(), isLoading: false, submit,
        survey: publicBrandSurvey({ slug: 'organizacion-a', nombre: 'Organización A' }, 'organizacion-a'),
      });
      render(<MemoryRouter initialEntries={['/e/consulta-publica?tenant_slug=organizacion-a']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /></Routes></MemoryRouter>);
      fireEvent.click(await screen.findByRole('button', { name: 'Enviar prueba' }));
      await waitFor(() => expect(mocks.formSubmissionRejected).toHaveBeenCalledTimes(1));
      expect(mocks.formSubmissionRejected).toHaveBeenCalledWith(
        outcome === 'duplicate response' ? duplicate : expect.objectContaining({ name: 'AmbiguousSurveySubmissionError' }),
      );
      expect(mocks.formSubmissionResolved).not.toHaveBeenCalled();
      expect(screen.getByTestId('mock-survey-form')).toBeVisible();
      expect(screen.queryByRole('heading', { name: '¡Gracias por participar!' })).not.toBeInTheDocument();
      expect(mocks.trackSurveySubmission).not.toHaveBeenCalled();
      expect(mocks.useSurveyLiveResults().refetch).not.toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledTimes(1);
      if (outcome === 'duplicate response') expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ya registramos tu opinión' }));
      expect(submit).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the survey route informative and accessible while data loads', () => {
    render(
      <MemoryRouter
        initialEntries={['/e/prioridades-barriales?tenant_slug=municipio']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/e/:slug" element={<PublicSurveyPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando encuesta y resultados en vivo...');
    expect(screen.getByText('Cargando encuesta y resultados en vivo...').closest('[aria-busy="true"]'))
      .toBeInTheDocument();
    expect(screen.getByTestId('public-survey-loading-shell')).toHaveClass(
      'min-h-[calc(100dvh-5rem)]',
      'max-w-7xl',
      'px-0',
    );
    expect(mocks.useSurveyPublic).toHaveBeenCalledTimes(1);
    expect(mocks.useSurveyPublic.mock.calls[0]?.[1]).toEqual({ tenantSlug: 'municipio' });
  });

  it.each([403, 404])('offers a terminal list action after a definitive %s without repeating the request', async (status) => {
    const retryLoad = vi.fn();
    mocks.useSurveyPublic.mockReturnValue({
      ...mocks.useSurveyPublic(), isLoading: false, error: 'Encuesta no disponible',
      errorStatus: status, errorDetails: { retryable: false, action_hint: 'check_survey_link' },
      errorReasonCode: 'survey_not_found', isTransientError: false, retryLoad,
    });
    render(<MemoryRouter initialEntries={['/e/unavailable?tenant_slug=tenant']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /><Route path="/encuestas" element={<p>Listado de encuestas</p>} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver encuestas' }));
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(retryLoad).not.toHaveBeenCalled();
  });

  it('vetoes survey and socket snapshots after live public access is withdrawn', async () => {
    const survey = {
      ...publicBrandSurvey({ slug: 'tenant', nombre: 'Organización' }, 'tenant'),
      es_votacion_envivo: true, mostrar_resultados_envivo: true,
      resultados_envivo: { total_respuestas: 123, preguntas: {} },
    };
    mocks.useSurveyPublic.mockReturnValue({ ...mocks.useSurveyPublic(), survey, isLoading: false });
    mocks.useSurveyLiveResults.mockReturnValue({
      ...mocks.useSurveyLiveResults(), liveResults: { total_respuestas: 123, preguntas: [] },
      liveStatus: { status: 'live', label: 'En vivo', description: 'Disponible' },
    });
    const content = <MemoryRouter initialEntries={['/e/consulta-publica?tenant_slug=tenant']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /></Routes></MemoryRouter>;
    const view = render(content);
    fireEvent.click(await screen.findByRole('button', { name: 'Resultados y territorio' }));
    act(() => { mocks.socketOptions.onUpdate({ contract_version: 'surveys.live_results.v2', total_respuestas: 456, preguntas: [] }); });
    expect(screen.getAllByText('456').length).toBeGreaterThan(0);
    mocks.useSurveyLiveResults.mockReturnValue({
      ...mocks.useSurveyLiveResults(), liveResults: undefined, accessWithdrawn: true,
      error: 'Resultados ocultos', liveStatus: { status: 'error', label: 'Resultados no disponibles', description: 'Acceso público retirado.' },
    });
    view.rerender(<MemoryRouter initialEntries={['/e/consulta-publica?tenant_slug=tenant']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/e/:slug" element={<PublicSurveyPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText('Resultados públicos no disponibles.')).toBeInTheDocument();
    expect(screen.queryByText('456')).not.toBeInTheDocument();
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(mocks.socketOptions.enabled).toBe(false);
    act(() => { mocks.socketOptions.onUpdate({ contract_version: 'surveys.live_results.v2', total_respuestas: 789, preguntas: [] }); });
    expect(screen.queryByText('789')).not.toBeInTheDocument();
  });

  it('shows the server synchronization time instead of mislabeling the survey closing date', async () => {
    const serverTime = '2026-08-24T22:46:37.889652-03:00';
    const closingTime = '2026-09-23T22:46:37.891057-03:00';
    mocks.useSurveyPublic.mockReturnValue({
      survey: {
        slug: 'prioridades-barriales',
        titulo: 'Prioridades barriales',
        descripcion: 'Consulta pública',
        tipo: 'votacion',
        inicio_at: '2026-08-01T00:00:00-03:00',
        fin_at: closingTime,
        politica_unicidad: 'libre',
        preguntas: [
          {
            id: 1,
            orden: 1,
            tipo: 'opcion_unica',
            texto: '¿Qué tema debería resolverse primero?',
            obligatoria: true,
            opciones: [{ id: 10, orden: 1, texto: 'Luminarias' }],
          },
        ],
        es_votacion_envivo: true,
        mostrar_resultados_envivo: false,
        public_state: { server_time: serverTime, is_open: true, accepts_responses: true },
      },
      isLoading: false,
      isRefetching: false,
      failureCount: 0,
      error: null,
      errorStatus: null,
      errorDetails: null,
      errorReasonCode: null,
      isTransientError: false,
      retryLoad: vi.fn(),
      submit: vi.fn(),
      isSubmitting: false,
      submitError: null,
      submitStatus: null,
      submitErrorDetails: null,
      submitReasonCode: null,
    });

    render(
      <MemoryRouter
        initialEntries={['/e/prioridades-barriales?tenant_slug=junin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/e/:slug" element={<PublicSurveyPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Resultados y territorio' }));
    const timestamp = await screen.findByTestId('survey-last-updated');
    expect(timestamp).toHaveTextContent(new Date(serverTime).toLocaleString());
    expect(timestamp).not.toHaveTextContent(new Date(closingTime).toLocaleString());
    expect(screen.getByTestId('public-survey-page')).toHaveClass('max-w-7xl', 'px-0');
    expect(screen.getByTestId('public-live-survey-content')).toHaveClass(
      'px-4',
      'sm:px-6',
    );
  });

  it('recognizes a server-classified synthetic demo without recursos and never claims a citizen write', async () => {
    const submit = vi.fn().mockResolvedValue({
      ack_kind: 'synthetic_demo',
      contract_version: 'surveys.public_response.v2',
      legacy_contract_version: 'demo.survey_response_ack.v1',
      ok: true,
      demo_mode: true,
      persisted: false,
      durable: false,
    });
    const provenance = {
      contract_version: 'surveys.response_provenance.v1' as const,
      mode: 'synthetic' as const,
      server_trusted_classification: true as const,
      contains_synthetic: true,
      real_responses_included: 0,
      synthetic_responses_included: 137,
      synthetic_responses_excluded: 0,
      synthetic_marker_contract: 'surveys.demo_seeding.v1' as const,
    };
    mocks.useSurveyPublic.mockReturnValue({
      survey: {
        slug: 'demo-gobierno-junin-prioridades-barriales',
        titulo: 'Prioridades barriales',
        descripcion: 'Escenario ejecutivo',
        tipo: 'votacion',
        inicio_at: '2026-08-01T00:00:00-03:00',
        fin_at: null,
        politica_unicidad: 'libre',
        preguntas: [
          {
            id: 1,
            orden: 1,
            tipo: 'opcion_unica',
            texto: '¿Qué tema debería resolverse primero?',
            obligatoria: true,
            opciones: [{ id: 10, orden: 1, texto: 'Luminarias' }],
          },
        ],
        recursos: null,
        demo_mode: true,
        puntos_recompensa: 25,
        es_votacion_envivo: true,
        mostrar_resultados_envivo: true,
        resultados_envivo: {
          demo_mode: true,
          seeded_responses: 137,
          total_respuestas: 137,
          preguntas: {
            '1': { tipo: 'opcion_unica', opciones: [{ id: 10, texto: 'Luminarias', votos: 26 }] },
          },
          data_provenance: provenance,
          response_provenance: provenance,
        },
        public_state: { server_time: '2026-08-25T00:00:00-03:00', is_open: true, accepts_responses: true },
      },
      isLoading: false,
      isRefetching: false,
      failureCount: 0,
      error: null,
      errorStatus: null,
      errorDetails: null,
      errorReasonCode: null,
      isTransientError: false,
      retryLoad: vi.fn(),
      submit,
      isSubmitting: false,
      submitError: null,
      submitStatus: null,
      submitErrorDetails: null,
      submitReasonCode: null,
    });
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.useSurveyLiveResults.mockReturnValue({
      liveResults: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      consecutiveErrors: 0,
      liveStatus: { status: 'live', label: 'En vivo', description: 'Datos disponibles.' },
      pollingIntervalMs: 5_000,
      refetch,
    });

    render(
      <MemoryRouter
        initialEntries={['/e/demo-gobierno-junin-prioridades-barriales?tenant_slug=junin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/e/:slug" element={<PublicSurveyPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('survey-response-provenance-synthetic')).toHaveTextContent(
      'No representa participación ciudadana',
    );
    expect(screen.getByTestId('public-survey-demo-disclosure')).toHaveTextContent(
      '137 respuestas sintéticas',
    );
    expect(screen.getByTestId('mock-survey-form')).toHaveAttribute('data-show-live-results', 'false');
    expect(screen.getByRole('button', { name: 'Participar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Resultados y territorio' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Simular participación' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Simular participación' }));

    expect(await screen.findByRole('heading', { name: 'Simulación interactiva completada' })).toBeVisible();
    expect(screen.getByText(/no se guarda ni se presenta como dato ciudadano/i)).toBeVisible();
    expect(screen.queryByText(/respuesta quedó registrada correctamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Puntos obtenidos/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Respuesta registrada')).not.toBeInTheDocument();
    expect(screen.queryByText('Sincronizado')).not.toBeInTheDocument();
    expect(screen.queryByText('Analíticas capturadas')).not.toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(mocks.trackSurveyDemoInteraction).toHaveBeenCalledWith(expect.objectContaining({
      persisted: false,
      durable: false,
    }));
    expect(mocks.trackSurveySubmission).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('keeps a durable demo submit successful when the non-blocking results refresh fails', async () => {
    const submit = vi.fn().mockResolvedValue({
      ack_kind: 'durable_demo',
      contract_version: 'surveys.public_response.v2',
      participation_contract_version: 'demo.survey_participation.v1',
      ok: true,
      accepted: true,
      demo_mode: true,
      persisted: true,
      durable: true,
      municipal_truth: false,
      response_origin: 'interactive_demo',
    });
    const provenance = {
      contract_version: 'surveys.response_provenance.v1' as const,
      mode: 'synthetic' as const,
      server_trusted_classification: true as const,
      contains_synthetic: true,
      real_responses_included: 0,
      synthetic_responses_included: 137,
      synthetic_responses_excluded: 0,
      synthetic_marker_contract: 'surveys.demo_seeding.v1' as const,
    };
    mocks.useSurveyPublic.mockReturnValue({
      survey: {
        slug: 'demo-gobierno-junin-prioridades-barriales',
        titulo: 'Prioridades barriales',
        descripcion: 'Escenario ejecutivo',
        tipo: 'votacion',
        inicio_at: '2026-08-01T00:00:00-03:00',
        fin_at: null,
        politica_unicidad: 'libre',
        preguntas: [
          {
            id: 1,
            orden: 1,
            tipo: 'opcion_unica',
            texto: '¿Qué tema debería resolverse primero?',
            obligatoria: true,
            opciones: [{ id: 10, orden: 1, texto: 'Luminarias' }],
          },
        ],
        recursos: null,
        demo_mode: true,
        puntos_recompensa: 25,
        es_votacion_envivo: true,
        mostrar_resultados_envivo: true,
        resultados_envivo: {
          demo_mode: true,
          seeded_responses: 137,
          interactive_demo_responses: 4,
          total_respuestas: 141,
          preguntas: {
            '1': { tipo: 'opcion_unica', opciones: [{ id: 10, texto: 'Luminarias', votos: 30 }] },
          },
          data_provenance: provenance,
          response_provenance: provenance,
        },
        public_state: { server_time: '2026-08-25T00:00:00-03:00', is_open: true, accepts_responses: true },
      },
      isLoading: false,
      isRefetching: false,
      failureCount: 0,
      error: null,
      errorStatus: null,
      errorDetails: null,
      errorReasonCode: null,
      isTransientError: false,
      retryLoad: vi.fn(),
      submit,
      isSubmitting: false,
      submitError: null,
      submitStatus: null,
      submitErrorDetails: null,
      submitReasonCode: null,
    });
    const refetch = vi.fn().mockRejectedValue(new Error('live results unavailable'));
    mocks.useSurveyLiveResults.mockReturnValue({
      liveResults: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      consecutiveErrors: 0,
      liveStatus: { status: 'live', label: 'En vivo', description: 'Datos disponibles.' },
      pollingIntervalMs: 5_000,
      refetch,
    });

    render(
      <MemoryRouter
        initialEntries={['/e/demo-gobierno-junin-prioridades-barriales?tenant_slug=junin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/e/:slug" element={<PublicSurveyPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Simular participación' }));

    expect(await screen.findByRole('heading', { name: 'Participación demo guardada en Preview' })).toBeVisible();
    expect(screen.getByText(/entorno QA de Preview/i)).toBeVisible();
    expect(screen.queryByText(/Puntos obtenidos/i)).not.toBeInTheDocument();
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Participación demo guardada en Preview' })).toBeVisible();
    expect(mocks.trackSurveyDemoInteraction).toHaveBeenCalledWith(expect.objectContaining({
      persisted: true,
      durable: true,
    }));
    expect(mocks.trackSurveySubmission).not.toHaveBeenCalled();
  });
});
