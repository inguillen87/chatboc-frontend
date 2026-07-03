import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MapWidget } from './MapWidget';
import type { HeatmapResponse, PointsResponse } from '@/services/analyticsService';

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({ showHeatmap, heatmapData }: { showHeatmap?: boolean; heatmapData?: Array<Record<string, unknown>> }) => (
    <div data-testid="mock-map" data-mode={showHeatmap ? 'heatmap' : 'points'}>
      <span data-testid="mock-map-first-lat">{String(heatmapData?.[0]?.lat ?? '')}</span>
      <span data-testid="mock-map-first-lng">{String(heatmapData?.[0]?.lng ?? '')}</span>
      mapa operativo {heatmapData?.length ?? 0}
    </div>
  ),
}));

vi.mock('@/hooks/useMapProvider', () => ({
  useMapProvider: () => ({
    provider: 'maplibre',
    setProvider: vi.fn(),
  }),
}));

vi.mock('@/components/MapProviderToggle', () => ({
  MapProviderToggle: ({ value }: { value: string }) => <button type="button">Proveedor {value}</button>,
}));

vi.mock('@/utils/exportUtils', () => ({
  exportElementToPng: vi.fn(),
  exportToCsv: vi.fn(),
}));

const heatmapFixture = (): HeatmapResponse => ({
  points: [],
  cells: [
    {
      cellId: 'centro',
      label: 'Centro',
      centroid_lat: -33.086,
      centroid_lon: -68.471,
      count: 12,
      weight: 7.5,
      breakdown: { luminaria: 12 },
    },
    {
      cellId: 'barrio-norte',
      label: 'Barrio Norte',
      centroid_lat: -33.081,
      centroid_lon: -68.462,
      count: 4,
      weight: 2.1,
      breakdown: { arbolado: 4 },
    },
  ],
  hotspots: [
    {
      cellId: 'centro',
      label: 'Centro',
      count: 12,
      weight: 7.5,
      breakdown: { luminaria: 12 },
    },
  ],
  metadata: {
    totals: {
      geocoded: 18,
      missing: 2,
      coverage: 90,
      tickets: 20,
    },
    intensity: {
      totalWeight: 9.6,
      averageWeight: 4.8,
    },
    categories: [{ label: 'Luminaria', count: 12, percentage: 66.67 }],
    severity: [{ label: 'Alta', count: 5, percentage: 27.78 }],
    status: [{ label: 'Nuevo', count: 8, percentage: 44.44 }],
    recency: [{ label: 'Ultimas 24h', count: 3, percentage: 16.67 }],
    serviceLevels: {
      responseMinutes: { average: 12, p90: 30 },
      resolutionMinutes: { average: 240, p90: 600 },
    },
  },
});

const pointsFixture = (): PointsResponse => ({
  points: [
    {
      cellId: 'ticket-1',
      lat: -33.086,
      lon: -68.471,
      categoria: 'Luminaria',
      estado: 'nuevo',
    },
  ],
});

const operationsHeatmapFixture = (): HeatmapResponse => ({
  contract_version: 'operations.heatmap.v1',
  points: [],
  cells: [
    {
      cellId: 'junin-centro',
      label: 'Junin Centro',
      lat: -33.086,
      lng: -68.471,
      count: 8,
      weight: 6.2,
      breakdown: { reclamos: 8 },
    },
  ],
  hotspots: [],
  metadata: {
    totals: {
      geocoded: 8,
      missing: 0,
      coverage: 100,
      tickets: 8,
    },
  },
});

describe('MapWidget', () => {
  it('renders the operational command strip and the map with heatmap data', () => {
    render(
      <MapWidget
        title="Mapa territorial"
        description="Mapa de calor operativo"
        heatmap={heatmapFixture()}
        points={pointsFixture()}
        exportName="mapa"
      />,
    );

    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('Señal visible');
    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('2 celdas de calor');
    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('90.00%');
    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('18 geocodificados');
    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('Centro');
    expect(screen.getByTestId('analytics-map-intelligence-strip')).toHaveTextContent('Lectura ejecutiva');
    expect(screen.getByTestId('analytics-map-intelligence-strip')).toHaveTextContent('Centro concentra 12 eventos');
    expect(screen.getByTestId('analytics-map-intelligence-strip')).toHaveTextContent('Confianza geografica');
    expect(screen.getByTestId('analytics-map-intelligence-strip')).toHaveTextContent('Alta');
    expect(screen.getByTestId('analytics-map-intelligence-strip')).toHaveTextContent('Respuesta p90');
    expect(screen.getByTestId('analytics-map-intelligence-strip')).toHaveTextContent('30 min');
    expect(screen.getByTestId('mock-map')).toHaveAttribute('data-mode', 'heatmap');
    expect(screen.getAllByText('Radar territorial').length).toBeGreaterThan(0);
    expect(screen.getByText('Categorías principales')).toBeInTheDocument();
  });

  it('renders operations heatmap v1 cells that use lat/lng coordinates', () => {
    render(
      <MapWidget
        title="Mapa territorial"
        heatmap={operationsHeatmapFixture()}
        exportName="mapa"
      />,
    );

    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('1 celdas de calor');
    expect(screen.getByTestId('mock-map')).toHaveTextContent('mapa operativo 1');
    expect(screen.getByTestId('mock-map-first-lat')).toHaveTextContent('-33.086');
    expect(screen.getByTestId('mock-map-first-lng')).toHaveTextContent('-68.471');
  });

  it('switches to real points mode without losing the command strip', () => {
    render(
      <MapWidget
        title="Mapa territorial"
        heatmap={heatmapFixture()}
        points={pointsFixture()}
        exportName="mapa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Puntos' }));

    expect(screen.getByTestId('analytics-map-command-strip')).toHaveTextContent('1 puntos reales');
    expect(screen.getByTestId('mock-map')).toHaveAttribute('data-mode', 'points');
  });
});
