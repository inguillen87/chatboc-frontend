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
});
