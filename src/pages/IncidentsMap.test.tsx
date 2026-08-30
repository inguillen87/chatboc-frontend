import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import IncidentsMap from './IncidentsMap';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getOperationsHeatmapV2: vi.fn(),
  getHeatmapDataset: vi.fn(),
  getTicketStats: vi.fn(),
  setProvider: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock('@/features/analytics/analyticsApi', () => ({
  getOperationsHeatmapV2: (...args: unknown[]) => mocks.getOperationsHeatmapV2(...args),
}));

vi.mock('@/features/analytics/PremiumTerritoryMap', () => ({
  PremiumTerritoryHeatmap: ({
    points,
    heatmap,
    activeFilters,
    minSampleSize,
    allowDemoFallback,
  }: {
    points?: unknown[];
    heatmap?: {
      privacy?: { mode?: string };
      summary?: { points?: number; pending_geocode?: number };
      quality?: { coverage_percent?: number; total_ticket_records?: number };
      segments?: {
        category?: Array<{ label?: string }>;
        status?: Array<{ label?: string }>;
        zone?: Array<{ label?: string }>;
      };
    };
    activeFilters?: unknown[];
    minSampleSize?: number;
    allowDemoFallback?: boolean;
  }) => (
    <div
      data-testid="mock-premium-territory-map"
      data-points={String(points?.length ?? 0)}
      data-privacy-mode={heatmap?.privacy?.mode ?? ''}
      data-summary-points={String(heatmap?.summary?.points ?? '')}
      data-pending-geocode={String(heatmap?.summary?.pending_geocode ?? '')}
      data-coverage-percent={String(heatmap?.quality?.coverage_percent ?? '')}
      data-total-ticket-records={String(heatmap?.quality?.total_ticket_records ?? '')}
      data-category-segments={JSON.stringify(heatmap?.segments?.category ?? [])}
      data-status-segments={JSON.stringify(heatmap?.segments?.status ?? [])}
      data-zone-segments={JSON.stringify(heatmap?.segments?.zone ?? [])}
      data-active-filters={JSON.stringify(activeFilters ?? [])}
      data-min-sample-size={String(minSampleSize ?? '')}
      data-demo-fallback={String(allowDemoFallback)}
    >
      mapa territorial v2
    </div>
  ),
}));

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({
    showHeatmap,
    heatmapData,
    ariaLabel,
  }: {
    showHeatmap?: boolean;
    heatmapData?: unknown[];
    ariaLabel?: string;
  }) => (
    <div
      data-testid="mock-incidents-map"
      data-heatmap={showHeatmap ? 'heatmap' : 'points'}
      data-points={String(heatmapData?.length ?? 0)}
      data-aria-label={ariaLabel ?? ''}
    >
      mapa legado
    </div>
  ),
}));

vi.mock('@/components/TicketStatsCharts', () => ({
  default: () => <div data-testid="mock-ticket-charts">charts</div>,
}));

vi.mock('@/hooks/useRequireRole', () => ({
  default: vi.fn(),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: mocks.useUser,
}));

vi.mock('@/hooks/useMapProvider', () => ({
  useMapProvider: () => ({
    provider: 'maplibre',
    setProvider: mocks.setProvider,
  }),
}));

vi.mock('@/components/MapProviderToggle', () => ({
  MapProviderToggle: ({ value }: { value: string }) => <span>Proveedor {value}</span>,
}));

vi.mock('@/utils/api', () => {
  class MockApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status = 500, payload?: unknown) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  }

  return {
    ApiError: MockApiError,
    apiFetch: (...args: unknown[]) => mocks.apiFetch(...args),
  };
});

vi.mock('@/services/statsService', () => ({
  getHeatmapDataset: (...args: unknown[]) => mocks.getHeatmapDataset(...args),
  getTicketStats: (...args: unknown[]) => mocks.getTicketStats(...args),
}));

const legacyHeatmapPoints = [
  {
    id: 1,
    lat: -33.086,
    lng: -68.471,
    weight: 6,
    barrio: 'Centro',
    categoria: 'Luminaria',
    estado: 'Nuevo',
  },
  {
    id: 2,
    lat: -33.091,
    lng: -68.462,
    weight: 3,
    barrio: 'Barrio Norte',
    categoria: 'Arbolado',
    estado: 'En proceso',
  },
];

const operationsHeatmap = (overrides: Record<string, unknown> = {}) => ({
  contract_version: 'operations.heatmap.v1',
  render_contract: {
    state: 'ready',
    can_render_heatmap: true,
    map_engine: 'maplibre',
    layers: ['points', 'cells'],
  },
  summary: {
    points: 21,
    cells: 2,
    aggregated_observations: 21,
    pending_geocode: 1,
    suppressed_cells: 1,
    suppressed_records: 3,
  },
  quality: {
    state: 'ready',
    coverage_percent: 75,
    total_ticket_records: 28,
    ticket_records_with_coordinates: 21,
    pending_geocode: 1,
  },
  points: [
    { id: 'ticket:1', lat: -34.58, lng: -60.94, weight: 6, source: 'ticket' },
    { id: 'ticket:2', lat: -34.59, lng: -60.95, weight: 3, source: 'ticket' },
  ],
  cells: [],
  hotspots: [],
  facets: [],
  category_layers: [],
  segments: {
    category: [{ key: 'luminaria', label: 'Luminaria', count: 12 }],
    status: [{ key: 'nuevo', label: 'Nuevo', count: 11 }],
    zone: [{ key: 'centro', label: 'Centro', count: 14 }],
  },
  applied_filters: {},
  privacy: {
    mode: 'employee_aggregated',
    minimum_sample_size: 5,
    k_min: 5,
    coordinate_precision_decimals: 3,
    suppressed: { records: 3, cells: 1, exact_points: true },
  },
  source_quality: {
    contract_version: 'operations.heatmap_source_quality.v1',
  },
  response_provenance: {
    mode: 'real',
    server_trusted_classification: true,
    contains_synthetic: false,
    synthetic_responses_excluded: 2,
  },
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('IncidentsMap', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.getOperationsHeatmapV2.mockReset();
    mocks.getHeatmapDataset.mockReset();
    mocks.getTicketStats.mockReset();
    mocks.setProvider.mockReset();
    mocks.useUser.mockReset();
    mocks.useUser.mockReturnValue({
      user: {
        tipo_chat: 'municipio',
        latitud: '-33.086',
        longitud: '-68.471',
      },
    });

    mocks.apiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.includes('categorias')) {
        return Promise.resolve({ categorias: [{ nombre: 'Luminaria' }, { nombre: 'Arbolado' }] });
      }
      if (endpoint.includes('estados')) {
        return Promise.resolve({ estados: ['Nuevo', 'En proceso'] });
      }
      return Promise.resolve({});
    });

    mocks.getOperationsHeatmapV2.mockResolvedValue(operationsHeatmap());
    mocks.getHeatmapDataset.mockResolvedValue({
      points: legacyHeatmapPoints,
      metadata: {
        map: {
          heatmap: {
            bounds: [-68.48, -33.1, -68.45, -33.07],
            centroid: [-68.471, -33.086],
          },
        },
      },
    });
    mocks.getTicketStats.mockResolvedValue({
      charts: [{ title: 'Por estado', data: { Nuevo: 2 } }],
    });
  });

  it('uses the v2 contract first and exposes privacy, provenance and no-demo evidence', async () => {
    render(<IncidentsMap />);

    expect(screen.getByTestId('incidents-map-loading')).toHaveTextContent(
      'Verificando cobertura territorial',
    );

    const map = await screen.findByTestId('mock-premium-territory-map');
    const evidence = screen.getByTestId('operations-heatmap-evidence');
    expect(map).toHaveAttribute('data-points', '2');
    expect(map).toHaveAttribute('data-privacy-mode', 'employee_aggregated');
    expect(map).toHaveAttribute('data-min-sample-size', '5');
    expect(map).toHaveAttribute('data-demo-fallback', 'false');
    expect(map.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(evidence).toHaveTextContent(
      'Calidad y privacidad de los datos',
    );
    expect(evidence).toHaveTextContent(
      'Privacidad protegida desde 5 casos',
    );
    expect(evidence).toHaveTextContent(
      '2 respuestas simuladas excluidas',
    );
    expect(screen.getByText('Ver detalles técnicos de auditoría')).toBeInTheDocument();
    expect(screen.getByTestId('operations-heatmap-audit-details')).toHaveTextContent(
      'Precisión: 3 decimales',
    );
    expect(screen.getByTestId('operations-heatmap-audit-details')).toHaveTextContent(
      'Supresión: 3 registros · 1 celda',
    );
    expect(screen.getByTestId('operations-heatmap-audit-details')).toHaveTextContent(
      'Procedencia: Procedencia parcial',
    );
    expect(document.body.textContent).not.toContain('Datos operativos verificados');
    expect(mocks.getHeatmapDataset).not.toHaveBeenCalled();
    expect(mocks.getTicketStats).not.toHaveBeenCalled();
    expect(screen.queryByTestId('legacy-heatmap-evidence')).not.toBeInTheDocument();
  });

  it('defaults only the territorial workspace to full history and keeps shorter ranges selectable', async () => {
    render(<IncidentsMap tenantSlugOverride="junin" />);

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'junin',
          source: 'tickets',
          range: 'all',
          scope: 'historical',
          from: undefined,
          to: undefined,
        }),
      );
    });

    const range = screen.getByLabelText('Cobertura del mapa') as HTMLSelectElement;
    expect(range.value).toBe('all');
    expect(range).toHaveAccessibleDescription('Independiente del período operativo.');
    expect(
      screen.getByTestId('mock-premium-territory-map').getAttribute('data-active-filters'),
    ).toContain('Histórico completo');

    fireEvent.change(range, { target: { value: '7d' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(2));
    expect(mocks.getOperationsHeatmapV2).toHaveBeenLastCalledWith(
      expect.objectContaining({
        range: undefined,
        scope: undefined,
        source: 'tickets',
        from: expect.any(String),
        to: expect.any(String),
      }),
    );
  });

  it('derives executive KPIs from v2 summary and segments, not sparse point fields', async () => {
    render(<IncidentsMap />);

    const map = await screen.findByTestId('mock-premium-territory-map');
    expect(map).toHaveAttribute('data-summary-points', '21');
    expect(map).toHaveAttribute('data-total-ticket-records', '28');
    expect(map).toHaveAttribute('data-coverage-percent', '75');
    expect(map).toHaveAttribute('data-pending-geocode', '1');
    expect(screen.queryByText('21 puntos')).not.toBeInTheDocument();
    expect(map.getAttribute('data-category-segments')).toContain('Luminaria');
    expect(map.getAttribute('data-status-segments')).toContain('Nuevo');
    expect(map.getAttribute('data-zone-segments')).toContain('Centro');
  });

  it('scopes the v2 request to the canonical tenant and does not call legacy services', async () => {
    render(<IncidentsMap tenantSlugOverride="junin" />);

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith(
        expect.objectContaining({ tenantSlug: 'junin', source: 'tickets', include_ai: 0 }),
      );
    });
    expect(mocks.getHeatmapDataset).not.toHaveBeenCalled();
    expect(mocks.getTicketStats).not.toHaveBeenCalled();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/municipal/categorias',
      expect.objectContaining({ tenantSlug: 'junin' }),
    );
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/municipal/estados',
      expect.objectContaining({ tenantSlug: 'junin' }),
    );
  });

  it('keeps non-municipal maps on their existing multi-source contract', async () => {
    mocks.useUser.mockReturnValue({
      user: {
        tipo_chat: 'pyme',
        latitud: '-33.086',
        longitud: '-68.471',
      },
    });

    render(<IncidentsMap tenantSlugOverride="comercio-demo" />);

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'comercio-demo',
          source: undefined,
          scope: 'historical',
        }),
      );
    });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/pyme/categorias',
      expect.objectContaining({ tenantSlug: 'comercio-demo' }),
    );
  });

  it('ignores an older response that resolves after the current request', async () => {
    const first = deferred<ReturnType<typeof operationsHeatmap>>();
    const second = deferred<ReturnType<typeof operationsHeatmap>>();
    mocks.getOperationsHeatmapV2
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { rerender } = render(<IncidentsMap tenantSlugOverride="tenant-anterior" />);
    await waitFor(() => expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(1));

    rerender(<IncidentsMap tenantSlugOverride="junin" />);
    await waitFor(() => expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve(
        operationsHeatmap({
          summary: { points: 44, cells: 4, aggregated_observations: 44, pending_geocode: 0 },
          applied_filters: { zone: ['Centro'] },
        }),
      );
      await second.promise;
    });

    const currentMap = await screen.findByTestId('mock-premium-territory-map');
    expect(currentMap).toHaveAttribute('data-summary-points', '44');
    expect(currentMap.getAttribute('data-active-filters')).toContain('Centro');

    await act(async () => {
      first.resolve(
        operationsHeatmap({
          summary: { points: 7, cells: 1, aggregated_observations: 7, pending_geocode: 3 },
          applied_filters: { zone: ['Respuesta vieja'] },
        }),
      );
      await first.promise;
    });

    expect(currentMap).toHaveAttribute('data-summary-points', '44');
    expect(currentMap.getAttribute('data-active-filters')).toContain('Centro');
    expect(currentMap.getAttribute('data-active-filters')).not.toContain('Respuesta vieja');
    expect(currentMap).not.toHaveAttribute('data-summary-points', '7');
  });

  it('uses only backend-confirmed filters in the premium map contract', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(
      operationsHeatmap({
        applied_filters: {
          category: ['Luminaria'],
          sla_state: ['breached'],
          assignee_id: ['77'],
        },
      }),
    );

    render(<IncidentsMap />);

    const map = await screen.findByTestId('mock-premium-territory-map');
    expect(map.getAttribute('data-active-filters')).toContain('Luminaria');
    expect(map.getAttribute('data-active-filters')).toContain('SLA');
    expect(map.getAttribute('data-active-filters')).toContain('breached');
    expect(map.getAttribute('data-active-filters')).toContain('Responsable');
    expect(map.getAttribute('data-active-filters')).toContain('77');
    expect(screen.getByTestId('operations-heatmap-evidence')).toHaveTextContent('3 filtros aplicados');
  });

  it('keeps draft filters local and maps age ranges only after apply', async () => {
    render(<IncidentsMap />);

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '18' } });
    expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(2);
    });
    expect(mocks.getOperationsHeatmapV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ age_range: '18_24,25_34,35_44,45_59,60_plus' }),
    );
    expect(mocks.getHeatmapDataset).not.toHaveBeenCalled();
  });

  it('publishes only real barrio and distrito values in the territorial selectors', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(
      operationsHeatmap({
        points: [
          {
            id: 'ticket:1',
            lat: -34.58,
            lng: -60.94,
            weight: 6,
            barrio: 'sin_zona',
            distrito: 'UNKNOWN',
          },
          {
            id: 'ticket:2',
            lat: -34.59,
            lng: -60.95,
            weight: 3,
            barrio: 'Centro',
            distrito: 'Distrito 1',
          },
          {
            id: 'ticket:3',
            lat: -34.6,
            lng: -60.96,
            weight: 2,
            barrio: 'Sin barrio',
            distrito: 'null',
          },
        ],
      }),
    );

    render(<IncidentsMap />);
    await screen.findByTestId('mock-premium-territory-map');

    const barrio = screen.getByLabelText('Barrio') as HTMLSelectElement;
    const distrito = screen.getByLabelText('Distrito') as HTMLSelectElement;

    expect(barrio).toBeEnabled();
    expect(Array.from(barrio.options).map((option) => option.text)).toEqual(['Todos', 'Centro']);
    expect(distrito).toBeEnabled();
    expect(Array.from(distrito.options).map((option) => option.text)).toEqual([
      'Todos',
      'Distrito 1',
    ]);
  });

  it('disables unavailable territorial filters with an accessible, truthful explanation', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(
      operationsHeatmap({
        points: [
          {
            id: 'ticket:1',
            lat: -34.58,
            lng: -60.94,
            weight: 6,
            barrio: 'sin_zona',
            distrito: 'sin_distrito',
          },
          {
            id: 'ticket:2',
            lat: -34.59,
            lng: -60.95,
            weight: 3,
            barrio: 'No informado',
            distrito: 'undefined',
          },
        ],
      }),
    );

    render(<IncidentsMap />);
    await screen.findByTestId('mock-premium-territory-map');

    const barrio = screen.getByLabelText('Barrio');
    const distrito = screen.getByLabelText('Distrito');

    expect(barrio).toBeDisabled();
    expect(barrio).toHaveAccessibleDescription(
      'La fuente todavía no publicó barrios verificables para esta vista.',
    );
    expect(distrito).toBeDisabled();
    expect(distrito).toHaveAccessibleDescription(
      'La fuente todavía no publicó distritos verificables para esta vista.',
    );
    expect(screen.getByLabelText('Luminaria')).toBeEnabled();
    expect(screen.getByLabelText('Nuevo')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledTimes(2));
    expect(mocks.getOperationsHeatmapV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ zone: undefined }),
    );
  });

  it.each([404, 405, 501])(
    'fails closed instead of exposing legacy exact coordinates for compatibility status %s',
    async (status) => {
      mocks.getOperationsHeatmapV2.mockRejectedValue(
        new ApiError('Contrato no publicado', status),
      );

      render(<IncidentsMap />);

      expect(await screen.findByTestId('incidents-map-error')).toHaveTextContent(
        'No se muestran coordenadas de la vista heredada',
      );
      expect(mocks.getHeatmapDataset).not.toHaveBeenCalled();
      expect(mocks.getTicketStats).not.toHaveBeenCalled();
      expect(screen.queryByTestId('legacy-heatmap-evidence')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-incidents-map')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-premium-territory-map')).not.toBeInTheDocument();
    },
  );

  it.each([401, 403, 500])(
    'fails closed without legacy or demo data for status %s',
    async (status) => {
      mocks.getOperationsHeatmapV2.mockRejectedValue(
        new ApiError('No se puede certificar el contrato', status),
      );

      render(<IncidentsMap />);

      expect(await screen.findByTestId('incidents-map-error')).toHaveAttribute('role', 'alert');
      expect(mocks.getHeatmapDataset).not.toHaveBeenCalled();
      expect(mocks.getTicketStats).not.toHaveBeenCalled();
      expect(screen.queryByTestId('legacy-heatmap-evidence')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-incidents-map')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-premium-territory-map')).not.toBeInTheDocument();
    },
  );

  it('treats an explicit v2 can_render_heatmap false as authoritative', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(
      operationsHeatmap({
        render_contract: {
          state: 'suppressed',
          can_render_heatmap: false,
          map_engine: 'maplibre',
          layers: ['points'],
        },
        map_narrative: {
          headline: 'Mapa protegido por privacidad',
          body: 'La muestra no alcanza el umbral publicado.',
        },
      }),
    );

    render(<IncidentsMap />);

    expect(await screen.findByTestId('incidents-map-empty')).toHaveTextContent(
      'Mapa protegido por privacidad',
    );
    expect(screen.queryByTestId('mock-premium-territory-map')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-incidents-map')).not.toBeInTheDocument();
    expect(mocks.getHeatmapDataset).not.toHaveBeenCalled();
  });

  it('does not expose the legacy heat/point toggle when the secure contract is unavailable', async () => {
    mocks.getOperationsHeatmapV2.mockRejectedValue(new ApiError('No disponible', 404));

    render(<IncidentsMap />);

    expect(await screen.findByTestId('incidents-map-error')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-incidents-map')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Densidad activa/i })).not.toBeInTheDocument();
  });
});
