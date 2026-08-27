import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import IncidentsMap from './IncidentsMap';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getHeatmapDataset: vi.fn(),
  getTicketStats: vi.fn(),
  setProvider: vi.fn(),
}));

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({ showHeatmap, heatmapData }: { showHeatmap?: boolean; heatmapData?: unknown[] }) => (
    <div
      data-testid="mock-incidents-map"
      data-heatmap={showHeatmap ? 'heatmap' : 'points'}
      data-points={String(heatmapData?.length ?? 0)}
    >
      mapa operativo
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
  useUser: () => ({
    user: {
      tipo_chat: 'municipio',
      latitud: '-33.086',
      longitud: '-68.471',
    },
  }),
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
  class ApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status = 500, payload?: unknown) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  }

  return {
    ApiError,
    apiFetch: (...args: unknown[]) => mocks.apiFetch(...args),
  };
});

vi.mock('@/services/statsService', () => ({
  getHeatmapDataset: (...args: unknown[]) => mocks.getHeatmapDataset(...args),
  getTicketStats: (...args: unknown[]) => mocks.getTicketStats(...args),
}));

const heatmapPoints = [
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

describe('IncidentsMap', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.getHeatmapDataset.mockReset();
    mocks.getTicketStats.mockReset();
    mocks.setProvider.mockReset();

    mocks.apiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.includes('categorias')) {
        return Promise.resolve({ categorias: [{ nombre: 'Luminaria' }, { nombre: 'Arbolado' }] });
      }
      if (endpoint.includes('estados')) {
        return Promise.resolve({ estados: ['Nuevo', 'En proceso'] });
      }
      return Promise.resolve({});
    });

    mocks.getHeatmapDataset.mockResolvedValue({
      points: heatmapPoints,
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

  it('renders compact filters, telemetry overlay and heatmap data', async () => {
    render(<IncidentsMap />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-incidents-map')).toHaveAttribute('data-points', '2');
    });

    expect(screen.getByTestId('incidents-filter-command')).toHaveTextContent('Filtros operativos');
    expect(screen.getByTestId('incidents-filter-command')).toHaveTextContent('Filtros avanzados y segmentacion');
    expect(screen.getByTestId('incidents-telemetry-overlay')).toBeInTheDocument();
    expect(screen.getByText('Comando territorial')).toBeInTheDocument();
    expect(screen.getAllByText('Centro').length).toBeGreaterThan(0);
    expect(screen.getByTestId('mock-incidents-map')).toHaveAttribute('data-heatmap', 'heatmap');
  });

  it('scopes every territorial request to the canonical tenant override', async () => {
    render(<IncidentsMap tenantSlugOverride="junin" />);

    await waitFor(() => {
      expect(mocks.getHeatmapDataset).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_slug: 'junin', tipo: 'municipio' }),
      );
      expect(mocks.getTicketStats).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_slug: 'junin', tipo: 'municipio' }),
      );
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/municipal/categorias',
      expect.objectContaining({ tenantSlug: 'junin' }),
    );
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/municipal/estados',
      expect.objectContaining({ tenantSlug: 'junin' }),
    );
  });

  it('switches between heatmap and points without losing the map', async () => {
    render(<IncidentsMap />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-incidents-map')).toHaveAttribute('data-heatmap', 'heatmap');
    });

    fireEvent.click(screen.getByRole('button', { name: /Calor activo/i }));

    expect(screen.getByTestId('mock-incidents-map')).toHaveAttribute('data-heatmap', 'points');
    expect(screen.getByText('Solo puntos')).toBeInTheDocument();
  });

  it('keeps draft filters local until the operator applies them', async () => {
    render(<IncidentsMap />);

    await waitFor(() => {
      expect(mocks.getHeatmapDataset).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '18' } });
    expect(mocks.getHeatmapDataset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      expect(mocks.getHeatmapDataset).toHaveBeenCalledTimes(2);
    });
    expect(mocks.getHeatmapDataset).toHaveBeenLastCalledWith(
      expect.objectContaining({ edad_min: '18', tipo: 'municipio' }),
    );
  });

  it('replaces an empty map with one actionable empty state', async () => {
    mocks.getHeatmapDataset.mockResolvedValue({ points: [] });
    mocks.getTicketStats.mockResolvedValue({ charts: [], heatmap: [] });

    render(<IncidentsMap />);

    expect(await screen.findByTestId('incidents-map-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-incidents-map')).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar el mapa')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar a 90 dias' }));

    await waitFor(() => {
      expect(mocks.getHeatmapDataset).toHaveBeenCalledTimes(2);
    });
    expect(mocks.getHeatmapDataset).toHaveBeenLastCalledWith(
      expect.objectContaining({ fecha_inicio: expect.any(String), fecha_fin: expect.any(String) }),
    );
  });

  it('shows a retryable error without rendering the empty map', async () => {
    mocks.getHeatmapDataset
      .mockRejectedValueOnce(new Error('No se pudo consultar el mapa'))
      .mockResolvedValue({ points: heatmapPoints });

    render(<IncidentsMap />);

    const errorState = await screen.findByTestId('incidents-map-error');
    expect(errorState).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('mock-incidents-map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-incidents-map')).toHaveAttribute('data-points', '2');
    });
  });
});
