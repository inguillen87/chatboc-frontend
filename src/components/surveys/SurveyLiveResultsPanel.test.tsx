import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyLiveResultsPanel } from './SurveyLiveResultsPanel';
import { getPublicSurveyLiveResults } from '@/api/encuestas';
import type { SurveyLivePublicResultsPayload } from '@/types/encuestas';
import { ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const mocks = vi.hoisted(() => ({
  liveHook: {} as Record<string, unknown>,
  refetch: vi.fn(),
  socketOptions: undefined as any,
  realHook: false,
}));

vi.mock('@/hooks/useSurveyLiveResults', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useSurveyLiveResults')>();
  return {
    ...actual,
    useSurveyLiveResults: (...args: Parameters<typeof actual.useSurveyLiveResults>) =>
      mocks.realHook ? actual.useSurveyLiveResults(...args) : mocks.liveHook,
  };
});

vi.mock('@/api/encuestas', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/encuestas')>(),
  getPublicSurveyLiveResults: vi.fn(),
}));

vi.mock('@/hooks/useSurveySocket', () => ({
  useSurveySocket: (options: any) => {
    mocks.socketOptions = options;
    return null;
  },
}));

// Availability tests exercise the real panel and hook, without starting a map
// renderer or loading its external assets in JSDOM.
vi.mock('@/components/LazyMapLibreMap', () => ({ default: () => null }));

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

const clients: QueryClient[] = [];
const renderWithRealHook = (extra?: React.ReactNode) => {
  mocks.realHook = true;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<><SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />{extra}</>, { wrapper });
};

beforeEach(() => {
  mocks.refetch.mockReset();
  mocks.realHook = false;
  mocks.socketOptions = undefined;
  vi.mocked(getPublicSurveyLiveResults).mockReset();
  safeLocalStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in live retry tests'); }));
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

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it('vetoes previous socket results when HTTP withdraws public access', () => {
    const view = render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);
    act(() => { mocks.socketOptions.onUpdate(payloadFixture(24, 2)); });
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
    mocks.liveHook = {
      ...mocks.liveHook,
      liveResults: undefined,
      accessWithdrawn: true,
      error: 'Resultados ocultos',
      liveStatus: { status: 'error', label: 'Resultados no disponibles', description: 'La organización no habilita resultados públicos.' },
    };
    view.rerender(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);
    expect(screen.getByTestId('survey-live-results-panel-unavailable')).toBeInTheDocument();
    expect(screen.queryByText('24')).not.toBeInTheDocument();
    expect(screen.queryByText('Prioridad barrial')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refrescar' })).not.toBeInTheDocument();
    expect(mocks.socketOptions.enabled).toBe(false);
    act(() => { mocks.socketOptions.onUpdate(payloadFixture(99, 3)); });
    expect(screen.queryByText('99')).not.toBeInTheDocument();
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

  it('retires its manual pending state and focus ownership when the survey scope changes', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const pending = new Promise<void>((ok) => { resolve = ok; });
    mocks.refetch.mockReturnValueOnce(pending);
    mocks.liveHook = {
      ...mocks.liveHook, liveResults: undefined, accessWithdrawn: true,
      liveStatus: { status: 'error', label: 'Resultados no disponibles', description: 'Resultados retirados.' },
    };
    const view = render(<><SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" /><label>Otra tarea<input /></label></>);
    await user.click(screen.getByRole('button', { name: 'Reintentar disponibilidad' }));
    expect(screen.getByRole('button', { name: 'Reintentar disponibilidad' })).toBeDisabled();
    view.rerender(<><SurveyLiveResultsPanel slug="otra-encuesta" tenantSlug="junin" /><label>Otra tarea<input /></label></>);
    expect(screen.getByRole('button', { name: 'Reintentar disponibilidad' })).toBeEnabled();
    const otherControl = screen.getByRole('textbox', { name: 'Otra tarea' });
    await user.click(otherControl);
    await act(async () => { resolve(); await pending; });
    expect(otherControl).toHaveFocus();
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('removes its pending focus listener on unmount and ignores the late completion', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const pending = new Promise<void>((ok) => { resolve = ok; });
    mocks.refetch.mockReturnValueOnce(pending);
    mocks.liveHook = { ...mocks.liveHook, liveResults: undefined, accessWithdrawn: true };
    const view = render(<SurveyLiveResultsPanel slug="voto-plaza" tenantSlug="junin" />);
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    await user.click(screen.getByRole('button', { name: 'Reintentar disponibilidad' }));
    const focusHandler = addListener.mock.calls.find(([event]) => event === 'focusin')?.[1];
    expect(focusHandler).toBeDefined();
    view.unmount();
    expect(removeListener).toHaveBeenCalledWith('focusin', focusHandler);
    await act(async () => { resolve(); await pending; });
    expect(document.body).toHaveFocus();
  });
});

describe('explicit availability retry with the real live hook and offline API', () => {
  it.each([
    ['a repeated denial', new ApiError('Resultados retirados', 403)],
    ['a network failure', new Error('Offline')],
  ])('retains unavailable results after %s and recovers only after a fresh 200', async (_name, failure) => {
    const user = userEvent.setup();
    vi.mocked(getPublicSurveyLiveResults)
      .mockRejectedValueOnce(new ApiError('Resultados retirados', 403))
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(payloadFixture(17, 2));
    renderWithRealHook();
    await screen.findByTestId('survey-live-results-panel-unavailable');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('La organización no tiene habilitados los resultados públicos de esta encuesta.');
    expect(screen.queryByText('Resultados retirados')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Reintentar disponibilidad' });
    expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(1);
    expect(mocks.socketOptions.enabled).toBe(false);

    await user.click(retry);
    await waitFor(() => {
      expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2);
      expect(retry).toBeEnabled();
    });
    expect(screen.getByTestId('survey-live-results-panel-unavailable')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('La organización no tiene habilitados los resultados públicos de esta encuesta.');
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    expect(screen.queryByText('Prioridad barrial')).not.toBeInTheDocument();
    expect(mocks.socketOptions.enabled).toBe(false);

    await user.click(retry);
    await screen.findByTestId('survey-live-results-panel');
    expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Prioridad barrial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refrescar' })).toBe(retry);
    await waitFor(() => expect(retry).toHaveFocus());
    expect(window.localStorage.getItem('survey-live-results-access:["junin","voto-plaza"]')).not.toBeNull();
  });

  it('supports keyboard retry, disables duplicate attempts while pending and keeps its trigger after recovery', async () => {
    const user = userEvent.setup();
    let resolve!: (value: SurveyLivePublicResultsPayload) => void;
    const pending = new Promise<SurveyLivePublicResultsPayload>((ok) => { resolve = ok; });
    vi.mocked(getPublicSurveyLiveResults)
      .mockRejectedValueOnce(new ApiError('Resultados retirados', 403))
      .mockReturnValueOnce(pending);
    renderWithRealHook();
    await screen.findByTestId('survey-live-results-panel-unavailable');
    const retry = screen.getByRole('button', { name: 'Reintentar disponibilidad' });
    await user.tab();
    expect(retry).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(retry).toBeDisabled());
    expect(retry).toHaveAttribute('aria-busy', 'true');
    expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2);
    fireEvent.click(retry);
    await user.keyboard(' ');
    expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('survey-live-results-panel-unavailable')).toBeInTheDocument();

    await act(async () => { resolve(payloadFixture(19, 2)); await pending; });
    await screen.findByTestId('survey-live-results-panel');
    expect(screen.getByRole('button', { name: 'Refrescar' })).toBe(retry);
    await waitFor(() => expect(retry).toBeEnabled());
    expect(retry).toHaveAttribute('aria-busy', 'false');
    await waitFor(() => expect(retry).toHaveFocus());
  });

  it('does not take focus from a control selected while the explicit retry is pending', async () => {
    const user = userEvent.setup();
    let resolve!: (value: SurveyLivePublicResultsPayload) => void;
    const pending = new Promise<SurveyLivePublicResultsPayload>((ok) => { resolve = ok; });
    vi.mocked(getPublicSurveyLiveResults)
      .mockRejectedValueOnce(new ApiError('Resultados retirados', 403))
      .mockReturnValueOnce(pending);
    renderWithRealHook(<label>Otra tarea<input /></label>);
    await screen.findByTestId('survey-live-results-panel-unavailable');
    await user.click(screen.getByRole('button', { name: 'Reintentar disponibilidad' }));
    const otherControl = screen.getByRole('textbox', { name: 'Otra tarea' });
    await user.click(otherControl);
    expect(otherControl).toHaveFocus();
    await act(async () => { resolve(payloadFixture(21, 2)); await pending; });
    await screen.findByTestId('survey-live-results-panel');
    expect(otherControl).toHaveFocus();
  });

  it('does not restore retry focus after a voluntary focus move followed by blur', async () => {
    const user = userEvent.setup();
    let resolve!: (value: SurveyLivePublicResultsPayload) => void;
    const pending = new Promise<SurveyLivePublicResultsPayload>((ok) => { resolve = ok; });
    vi.mocked(getPublicSurveyLiveResults)
      .mockRejectedValueOnce(new ApiError('Resultados retirados', 403))
      .mockReturnValueOnce(pending);
    renderWithRealHook(<label>Otra tarea<input /></label>);
    await screen.findByTestId('survey-live-results-panel-unavailable');
    await user.click(screen.getByRole('button', { name: 'Reintentar disponibilidad' }));
    const otherControl = screen.getByRole('textbox', { name: 'Otra tarea' });
    act(() => { otherControl.focus(); otherControl.blur(); });
    expect(document.body).toHaveFocus();
    await act(async () => { resolve(payloadFixture(23, 2)); await pending; });
    await screen.findByTestId('survey-live-results-panel');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refrescar' })).toBeEnabled());
    expect(document.body).toHaveFocus();
  });
});
