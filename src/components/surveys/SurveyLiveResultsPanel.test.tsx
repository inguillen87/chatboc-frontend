import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyLiveResultsPanel } from './SurveyLiveResultsPanel';
import type { SurveyLivePublicResultsPayload } from '@/types/encuestas';

const mocks = vi.hoisted(() => ({
  liveHook: {} as Record<string, unknown>,
  refetch: vi.fn(),
  socketOptions: undefined as any,
}));

vi.mock('@/hooks/useSurveyLiveResults', () => ({
  hasSurveyLiveActivity: (payload?: SurveyLivePublicResultsPayload) => Boolean(payload?.total_respuestas || payload?.heatmap?.points?.length || payload?.heatmap?.cells?.length),
  useSurveyLiveResults: () => mocks.liveHook,
}));

vi.mock('@/hooks/useSurveySocket', () => ({
  useSurveySocket: (options: any) => {
    mocks.socketOptions = options;
    return null;
  },
}));

const payloadFixture = (total = 12, version = 1): SurveyLivePublicResultsPayload => ({
  contract_version: 'surveys.live_results.v2',
  result_version: version,
  total_respuestas: total,
  updated_at: '2026-07-09T20:10:00Z',
  kpis: {
    responses_last_hour: 7,
    participation_per_minute: 1.4,
  },
  preguntas: [
    {
      id: 'prioridad',
      texto: 'Prioridad barrial',
      total_votos: total,
      opciones: [
        { id: 'luz', texto: 'Luminaria', votos: total },
      ],
    },
  ],
  timeline_minute: [
    { minute: '20:08', respuestas: 2 },
    { minute: '20:09', respuestas: total },
  ],
  heatmap: {
    points: [{ lat: -33.086, lng: -68.471, respuestas: total, barrio: 'Centro', canal: 'whatsapp' }],
    metadata: { privacy_mode: 'public_aggregated', raw_points_redacted: true },
  },
  ai_summary: 'Centro concentra la actividad reciente.',
});

beforeEach(() => {
  mocks.refetch.mockReset();
  mocks.socketOptions = undefined;
  mocks.liveHook = {
    liveResults: payloadFixture(),
    isLoading: false,
    isFetching: false,
    error: null,
    consecutiveErrors: 0,
    liveStatus: { status: 'live', label: 'En vivo', description: 'Actualizado' },
    pollingIntervalMs: 5000,
    refetch: mocks.refetch,
  };
});

describe('SurveyLiveResultsPanel', () => {
  it('renders live polling results with KPI, questions and territory preview', () => {
    render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" title="Sala live" />);

    expect(screen.getByTestId('survey-live-results-panel')).toBeInTheDocument();
    expect(screen.getByText('Sala live')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('En vivo');
    expect(screen.getByText('Prioridad barrial')).toBeInTheDocument();
    expect(screen.getByText('Centro concentra la actividad reciente.')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    expect(mocks.socketOptions).toMatchObject({
      slug: 'voto-plaza',
      tenantSlug: 'junin',
      enabled: true,
    });
  });

  it('prefers a newer socket payload over polling data', () => {
    mocks.liveHook = {
      ...mocks.liveHook,
      liveResults: payloadFixture(1, 1),
    };

    render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);

    act(() => {
      mocks.socketOptions.onUpdate(payloadFixture(24, 2));
    });

    expect(screen.getByRole('status')).toHaveTextContent('Socket live');
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
  });

  it('keeps an actionable disabled state without a public slug', () => {
    render(<SurveyLiveResultsPanel slug="" enabled={false} />);

    expect(screen.getByTestId('survey-live-results-panel-disabled')).toHaveTextContent('Activa resultados en vivo');
  });
});
