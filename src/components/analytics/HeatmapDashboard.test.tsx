import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HeatmapDashboard from './HeatmapDashboard';

const mocks = vi.hoisted(() => ({
  getHeatmap: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsService: {
    getHeatmap: mocks.getHeatmap,
  },
}));

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({ heatmapData, evidence }: { heatmapData?: Array<Record<string, unknown>>; evidence?: Record<string, unknown> }) => (
    <div data-testid="mock-heatmap" data-count={String(heatmapData?.length ?? 0)}>
      <span data-testid="mock-heatmap-first-lat">{String(heatmapData?.[0]?.lat ?? '')}</span>
      <span data-testid="mock-heatmap-first-lng">{String(heatmapData?.[0]?.lng ?? '')}</span>
      <span data-testid="mock-heatmap-cell-fallback">{String(evidence?.usingCellFallback ?? false)}</span>
    </div>
  ),
}));

afterEach(() => {
  mocks.getHeatmap.mockReset();
});

describe('HeatmapDashboard', () => {
  it('renders a map from aggregated cells when the backend does not expose raw points', async () => {
    mocks.getHeatmap.mockResolvedValueOnce({
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [
        {
          cell_id: 'junin-centro',
          label: 'Junin Centro',
          centroid_lat: -33.086,
          centroid_lon: -68.471,
          count: 12,
        },
      ],
      location_quality: {
        coverage_pct: 100,
        with_coordinates: 12,
        without_coordinates: 0,
      },
    });

    render(
      <HeatmapDashboard
        tenantId={7}
        dateRange={{ from: '2026-07-01', to: '2026-07-09' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('mock-heatmap')).toHaveAttribute('data-count', '1'));
    expect(screen.getByTestId('mock-heatmap-first-lat')).toHaveTextContent('-33.086');
    expect(screen.getByTestId('mock-heatmap-first-lng')).toHaveTextContent('-68.471');
    expect(screen.getByTestId('mock-heatmap-cell-fallback')).toHaveTextContent('true');
    expect(mocks.getHeatmap).toHaveBeenCalledWith(expect.objectContaining({ tenantSlug: 'junin' }));
  });
});
