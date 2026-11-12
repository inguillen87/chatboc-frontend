import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsHeatmap, filterHeatmapLocations } from './Heatmap';
import type { HeatPoint } from '@/services/statsService';

vi.mock('@/hooks/useMapProvider', () => ({ useMapProvider: () => ({ provider: 'maplibre', setProvider: vi.fn() }) }));
vi.mock('@/components/MapProviderToggle', () => ({ MapProviderToggle: () => null }));
vi.mock('@/components/LazyMapLibreMap', () => ({ default: ({ heatmapData, fitToBounds }: any) => <div data-testid="map" data-points={JSON.stringify(heatmapData)} data-bounds={JSON.stringify(fitToBounds)} /> }));
afterEach(cleanup);
const breakdown = (label: string, count: number, weight: number) => ({ label, count, weight, percentage: 0 });
const grouped: HeatPoint = { lat: -33, lng: -68, cellId: 'a', clusterSize: 10, weight: 100,
  aggregatedCategorias: [breakdown('Agua', 6, 60), breakdown('Luz', 4, 40)],
  aggregatedBarrios: [breakdown('Centro', 5, 50), breakdown('Norte', 5, 50)],
};

describe('visible heatmap metrics', () => {
  it('uses the published category count and weight instead of the entire mixed cell', () => {
    const result = filterHeatmapLocations([{ ...grouped, sampleTickets: ['original'], ticketId: 'original' }], { categories: ['Luz'], barrios: [], tipos: [] });
    expect(result.points[0]).toMatchObject({ lat: -33, lng: -68, weight: 40, totalWeight: 40, clusterSize: 4 });
    expect(result.points[0].aggregatedBarrios).toBeUndefined();
    expect(result.points[0].sampleTickets).toBeUndefined();
    expect(result.points[0].ticketId).toBeUndefined();
    expect(grouped.weight).toBe(100);
  });

  it('does not infer a category and neighborhood intersection from two marginal counts', () => {
    expect(filterHeatmapLocations([grouped], { categories: ['Luz'], barrios: ['Centro'], tipos: [] })).toEqual({ points: [], unavailableGroups: 1 });
  });

  it('recomputes visible weight, category counts and bounds after applying a category', () => {
    render(<AnalyticsHeatmap initialHeatmapData={[grouped, { lat: -34, lng: -69, categoria: 'Agua', weight: 10 }]}
      availableCategories={['Agua', 'Luz']} availableBarrios={[]} availableTipos={[]}
      metadata={{ pointCount: 999, totalWeight: 999, maxPointWeight: 999, bounds: [-180, -90, 180, 90] }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Luz' }));
    expect(screen.getByText('Ubicaciones visibles').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Intensidad visible').parentElement).toHaveTextContent('40');
    expect(screen.getByText('Intensidad por ubicación').parentElement).toHaveTextContent('40.00');
    expect(JSON.parse(screen.getByTestId('map').getAttribute('data-points')!)[0].clusterSize).toBe(4);
    expect(JSON.parse(screen.getByTestId('map').getAttribute('data-bounds')!)).toEqual([[-68, -33]]);
  });

  it('keeps missing activity dates unavailable and uses only dated locations for recency', () => {
    const base = { availableCategories: [], availableBarrios: [], availableTipos: [] };
    const view = render(<AnalyticsHeatmap {...base} initialHeatmapData={[{ lat: -33, lng: -68 }]}/>);
    expect(screen.getByText('Actividad ≤7d con fecha conocida').parentElement).toHaveTextContent('No informada');
    view.rerender(<AnalyticsHeatmap {...base} initialHeatmapData={[
      { lat: -33, lng: -68, last_ticket_at: new Date(Date.now() - 86400000).toISOString() },
      { lat: -34, lng: -69 },
    ]}/>);
    expect(screen.getByText('Actividad ≤7d con fecha conocida').parentElement).toHaveTextContent('100.00%');
  });
});
