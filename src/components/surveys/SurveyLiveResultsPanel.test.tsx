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
    metadata: { privacy_mode: 'public_aggregated', raw_points_redacted: true, map_config: { provider: 'MapLibre' } },
  },
  realtime: {
    contract_version: 'surveys.realtime.v2',
    enabled: true,
    room: 'contract-primary',
    primary_room: 'contract-primary',
    legacy_room: 'contract-legacy',
    rooms: ['contract-primary', 'contract-legacy'],
    socket: {
      join_event: 'join',
      join_payloads: [{ room: 'contract-primary', tenant_slug: 'junin' }],
      events: [
        { name: 'survey.live_results.updated', contract_version: 'surveys.live_results.v2' },
        { name: 'survey.vote.created', contract_version: 'surveys.live_results.v2' },
      ],
    },
    polling: { interval_ms: 4500 },
  },
  render_contract: {
    preferred_visualization: 'live_vote_command_center',
    product_surface: {
      name: 'Noether Analytics Maps',
      scope: 'surveys_live_heatmap',
      supports: ['live_vote_heatmaps', 'privacy_safe_geo_aggregation', 'maplibre_layers'],
    },
    supports: ['cards', 'timeline', 'heatmap', 'admin_operations'],
    map_experience: 'interactive_heatmap_with_ai_layers',
  },
  admin_operations: {
    contract_version: 'surveys.operations.v2',
    analytics_surface: {
      heatmap_route: '/admin/encuestas/1/analytics?focus=heatmap&include_heatmap=1',
    },
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
    expect(screen.getByTestId('survey-live-product-surface')).toHaveTextContent('Noether Analytics Maps');
    expect(screen.getByTestId('survey-live-product-surface')).toHaveTextContent('Privacidad protegida');
    expect(screen.getByTestId('survey-live-product-surface')).toHaveTextContent('MapLibre');
    expect(screen.getByRole('link', { name: 'Abrir mapa admin' })).toHaveAttribute(
      'href',
      '/admin/encuestas/1/analytics?focus=heatmap&include_heatmap=1',
    );
    expect(screen.getByText('Polling automático', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.getByText('Prioridad barrial')).toBeInTheDocument();
    expect(screen.getByText('Centro concentra la actividad reciente.')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    expect(mocks.socketOptions).toMatchObject({
      slug: 'voto-plaza',
      tenantSlug: 'junin',
      joinPayloads: [{ room: 'contract-primary', tenant_slug: 'junin' }],
      events: ['survey.live_results.updated', 'survey.vote.created'],
      enabled: true,
    });
    expect(mocks.socketOptions.rooms).toEqual(expect.arrayContaining(['contract-primary', 'contract-legacy']));
    expect(mocks.socketOptions.rooms).toEqual(expect.arrayContaining(['encuesta:junin:voto-plaza', 'encuesta_voto-plaza']));
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

    expect(screen.getByText('Socket live', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
  });

  it('normalizes socket payloads with vote, snapshot and heatmap aliases before rendering', () => {
    mocks.liveHook = {
      ...mocks.liveHook,
      liveResults: payloadFixture(1, 1),
    };

    render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);

    act(() => {
      mocks.socketOptions.onUpdate({
        contractVersion: 'surveys.live_results.v2',
        snapshotVersion: '2026-07-10T20:15:00Z',
        total_votes: '31',
        questions: [
          {
            question_id: 'emergencia',
            title: 'Emergencia escolar',
            total_votes: '31',
            options: [{ key: 'aulas', label: 'Aulas', votes: '31', percent: '100' }],
          },
        ],
        series: [{ minute: '20:15', value: '31' }],
        points: [{ latitude: '-33.086', lon: '-68.471', votes: '31', barrio: 'Centro' }],
        heatmap_metadata: { points_count: 1, raw_points_redacted: true },
      });
    });

    expect(screen.getByText('Socket live', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.getByText('Emergencia escolar')).toBeInTheDocument();
    expect(screen.getAllByText('31').length).toBeGreaterThan(0);
    const pointsCount = screen.getByTestId('survey-live-heatmap-points-count');
    expect(pointsCount).toHaveTextContent('Puntos');
    expect(pointsCount).toHaveTextContent('1');
  });

  it('shows validated citizen provenance on the public live surface', () => {
    mocks.liveHook = {
      ...mocks.liveHook,
      liveResults: {
        ...payloadFixture(),
        data_provenance: {
          contract_version: 'surveys.response_provenance.v1',
          mode: 'real',
          server_trusted_classification: true,
          contains_synthetic: false,
          real_responses_included: 12,
          synthetic_responses_included: 0,
          synthetic_responses_excluded: 100,
          synthetic_marker_contract: 'surveys.demo_seeding.v1',
        },
      },
    };

    render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);

    const provenance = screen.getByTestId('survey-response-provenance-real');
    expect(provenance).toHaveTextContent('Resultados ciudadanos');
    expect(provenance).toHaveTextContent('100 respuestas excluidas');
  });

  it('keeps an actionable disabled state without a public slug', () => {
    render(<SurveyLiveResultsPanel slug="" enabled={false} />);

    expect(screen.getByTestId('survey-live-results-panel-disabled')).toHaveTextContent('Activa resultados en vivo');
  });

  it('keeps HTTP polling active without opening a socket when the backend disables it', () => {
    mocks.liveHook = {
      ...mocks.liveHook,
      liveResults: {
        ...payloadFixture(),
        realtime: {
          contract_version: 'surveys.realtime.v2',
          enabled: true,
          socket: { enabled: false },
          polling: { interval_ms: 5000 },
        },
      },
    };

    render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);

    expect(mocks.socketOptions.enabled).toBe(false);
    expect(screen.getByText('Polling automático', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('rejects a socket payload scoped to another survey and refreshes the authoritative polling payload', () => {
    render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);

    act(() => {
      mocks.socketOptions.onUpdate({
        ...payloadFixture(99, 10),
        slug_publico: 'otra-votacion',
        tenant_slug: 'otra-organizacion',
      });
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('99')).not.toBeInTheDocument();
    expect(screen.getByText('Polling automático', { selector: '[role="status"]' })).toBeInTheDocument();
  });
});
