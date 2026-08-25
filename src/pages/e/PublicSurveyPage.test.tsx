import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSurveyPublic: vi.fn(),
  useSurveyLiveResults: vi.fn(),
  trackSurveySubmission: vi.fn(),
  trackSurveyDemoInteraction: vi.fn(),
}));

vi.mock('@/hooks/useSurveyPublic', () => ({
  useSurveyPublic: mocks.useSurveyPublic,
}));

vi.mock('@/hooks/useSurveyLiveResults', () => ({
  hasSurveyLiveActivity: () => false,
  useSurveyLiveResults: mocks.useSurveyLiveResults,
}));

vi.mock('@/hooks/useSurveySocket', () => ({
  useSurveySocket: vi.fn(),
}));

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
}));

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
          })}
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

import PublicSurveyPage from './[slug]';

describe('PublicSurveyPage loading experience', () => {
  beforeEach(() => {
    mocks.trackSurveySubmission.mockReset();
    mocks.trackSurveyDemoInteraction.mockReset();
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

    const timestamp = await screen.findByTestId('survey-last-updated');
    expect(timestamp).toHaveTextContent(new Date(serverTime).toLocaleString());
    expect(timestamp).not.toHaveTextContent(new Date(closingTime).toLocaleString());
    expect(screen.getByTestId('public-survey-page')).toHaveClass('max-w-7xl', 'px-0');
    expect(screen.getByTestId('public-live-survey-content')).toHaveClass(
      'px-2',
      'sm:px-4',
      'lg:px-6',
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
    expect(screen.getByTestId('mock-survey-form')).toHaveAttribute('data-show-live-results', 'true');
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
