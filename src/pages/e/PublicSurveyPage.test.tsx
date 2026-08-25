import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSurveyPublic: vi.fn(),
  useSurveyLiveResults: vi.fn(),
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

vi.mock('@/utils/surveyAnalytics', () => ({
  trackSurveyCtaClicked: vi.fn(),
  trackSurveyErrorRendered: vi.fn(),
  trackSurveyLoadError: vi.fn(),
  trackSurveyPageView: vi.fn(),
  trackSurveyRetryTriggered: vi.fn(),
  trackSurveySubmission: vi.fn(),
}));

import PublicSurveyPage from './[slug]';

describe('PublicSurveyPage loading experience', () => {
  beforeEach(() => {
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
  });
});
