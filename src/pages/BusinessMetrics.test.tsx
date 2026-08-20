import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BusinessMetrics from './BusinessMetrics';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getOperationsHeatmapV2: vi.fn(),
  getPublicMapConfigV1: vi.fn(),
  premiumHeatmap: vi.fn(),
  getTicketStats: vi.fn(),
  getTenantDashboardBundle: vi.fn(),
  getTenantHeatmapSummary: vi.fn(),
  getTenantEmployeeCoverage: vi.fn(),
  useTenant: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  apiFetch: mocks.apiFetch,
  getErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

vi.mock('@/features/analytics/analyticsApi', () => ({
  getOperationsHeatmapV2: mocks.getOperationsHeatmapV2,
  getPublicMapConfigV1: mocks.getPublicMapConfigV1,
}));

vi.mock('@/features/analytics/PremiumTerritoryMap', () => ({
  PremiumTerritoryHeatmap: (props: any) => {
    mocks.premiumHeatmap(props);
    return (
      <div data-testid="premium-territory-heatmap">
        points:{props.points?.length ?? 0};contract:{props.heatmap?.contract_version ?? 'none'};provider:{props.mapConfig?.provider ?? 'none'}
      </div>
    );
  },
}));

vi.mock('@/services/statsService', () => ({
  getTicketStats: mocks.getTicketStats,
}));

vi.mock('@/services/enterpriseService', () => ({
  enterpriseService: {
    getTenantDashboardBundle: mocks.getTenantDashboardBundle,
    getTenantHeatmapSummary: mocks.getTenantHeatmapSummary,
    getTenantEmployeeCoverage: mocks.getTenantEmployeeCoverage,
  },
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: mocks.useTenant,
}));

vi.mock('@/components/TicketStatsCharts', () => ({
  default: () => <div data-testid="ticket-stats-charts" />,
}));

const legacyHeatmapSummary = {
  top_categories: [{ categoria: 'Arreglo de calle', count: 3 }],
  top_zones: [{ zona: 'Centro', count: 2 }],
  hotspot_pairs: [{ categoria: 'Arreglo de calle', zona: 'Centro', count: 2 }],
  heatmap_points: [
    {
      id: 'legacy-1',
      lat: -34.58,
      lng: -60.94,
      weight: 2,
      categoria: 'Arreglo de calle',
      source: 'ticket',
    },
  ],
};

const operationsHeatmap = {
  contract_version: 'operations.heatmap.v1',
  points: [
    {
      id: 'ops-1',
      lat: -34.59,
      lng: -60.95,
      weight: 5,
      categoria: 'Luminaria',
      source: 'tickets',
    },
  ],
  cells: [],
  hotspots: [],
  facets: [],
  category_layers: [],
  render_contract: {
    state: 'ready',
    can_render_heatmap: true,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/t/junin/metrics']}>
      <Routes>
        <Route path="/t/:tenant/metrics" element={<BusinessMetrics />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BusinessMetrics premium heatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.useTenant.mockReturnValue({ tenant: { slug: 'junin', tipo: 'municipio' } });
    mocks.getTenantDashboardBundle.mockResolvedValue(null);
    mocks.getTenantHeatmapSummary.mockResolvedValue(legacyHeatmapSummary);
    mocks.getTenantEmployeeCoverage.mockResolvedValue({ categorias: [], zonas: [], permisos: [] });
    mocks.getTicketStats.mockResolvedValue({ charts: [] });
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path.includes('/summary')) return { summary: 'Resumen IA' };
      if (path.includes('/kpis')) return {};
      return [];
    });
    mocks.getPublicMapConfigV1.mockResolvedValue({ contract_version: 'public.map_config.v1', provider: 'maplibre' });
  });

  it('renders the operations heatmap contract when the premium endpoint is available', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(operationsHeatmap);

    renderPage();

    expect(await screen.findByText('Contrato ops')).toBeInTheDocument();
    expect(screen.getByTestId('premium-territory-heatmap')).toHaveTextContent('contract:operations.heatmap.v1');
    expect(screen.getByTestId('premium-territory-heatmap')).toHaveTextContent('provider:maplibre');
    expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      range: '30d',
      include_ai: 0,
    });
    expect(mocks.premiumHeatmap).toHaveBeenCalledWith(expect.objectContaining({
      points: operationsHeatmap.points,
      heatmap: operationsHeatmap,
      allowDemoFallback: false,
    }));
  });

  it('keeps real tenant points without enabling the synthetic fallback', async () => {
    mocks.getOperationsHeatmapV2.mockRejectedValue(new Error('premium heatmap down'));
    mocks.getPublicMapConfigV1.mockRejectedValue(new Error('map config down'));

    renderPage();

    expect(await screen.findByText('Fuente tenant')).toBeInTheDocument();
    expect(screen.getByTestId('premium-territory-heatmap')).toHaveTextContent('points:1');
    await waitFor(() => {
      expect(mocks.premiumHeatmap).toHaveBeenCalledWith(expect.objectContaining({
        heatmap: expect.objectContaining({
          contract_version: 'operations.heatmap.v1',
          render_contract: expect.objectContaining({ can_render_heatmap: true }),
        }),
        allowDemoFallback: false,
      }));
    });
  });
});
