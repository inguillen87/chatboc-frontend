import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OperationsHeatmapV1 } from './analyticsTypes';
import { TerritorialPendingLocationsInbox } from './TerritorialPendingLocationsInbox';

const mocks = vi.hoisted(() => ({
  getOperationsHeatmapV2: vi.fn(),
}));

vi.mock('./analyticsApi', () => ({
  getOperationsHeatmapV2: mocks.getOperationsHeatmapV2,
}));

const renderInbox = (props: ComponentProps<typeof TerritorialPendingLocationsInbox> = { tenantSlug: 'junin' }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TerritorialPendingLocationsInbox {...props} />
    </QueryClientProvider>,
  );
};

const heatmapFixture = (): OperationsHeatmapV1 => ({
  points: [],
  cells: [],
  hotspots: [],
  facets: [],
  category_layers: [],
  geocoding: {
    contract_version: 'operations.heatmap.geocoding_queue.v1',
    status: 'pending',
    candidate_count: 2,
    candidates: [{
      record_id: 419,
      ticket_id: 419,
      source_model: 'MunicipioTicket',
      address: 'Plaza departamental 742, Junín, Mendoza',
      category: 'Luminarias',
      source: 'WhatsApp',
      reason_code: 'address_without_coordinates',
      actions: [{ id: 'open_record', method: 'GET', endpoint: '/api/v2/tickets/419' }],
    }],
  },
});

describe('TerritorialPendingLocationsInbox', () => {
  beforeEach(() => mocks.getOperationsHeatmapV2.mockReset());

  it('renders a compact safe queue and keeps write decisions disabled without a safe contract', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(heatmapFixture());

    renderInbox({ tenantSlug: 'junin', initialFacet: 'luminarias' });

    expect(screen.getByRole('heading', { name: 'Ubicaciones pendientes' })).toBeInTheDocument();
    expect(await screen.findByText('2 informadas')).toBeInTheDocument();
    expect(screen.getByText('1 sin detalle publicado')).toBeInTheDocument();
    expect(screen.getAllByText('Corredor Plaza departamental')).not.toHaveLength(0);
    expect(screen.queryByText(/742/)).not.toBeInTheDocument();

    const ticketLinks = screen.getAllByRole('link', { name: /abrir ticket/i });
    expect(ticketLinks[0]).toHaveAttribute(
      'href',
      '/perfil?tab=tickets&focus=territorial_location_review&ticket_id=419&tenant_slug=junin&tenant=junin&source_model=MunicipioTicket',
    );
    expect(screen.getByRole('link', { name: /revisar evidencia/i })).toHaveAttribute('href', expect.stringContaining('ticket_id=419'));
    expect(screen.getByRole('button', { name: 'Aprobar ubicación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar ubicación' })).toBeDisabled();
    expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      scope: 'municipio',
      range: '30d',
      include_ai: 0,
      limit: 100,
    });
  });

  it('shows an honest count-only state when the backend withholds candidate detail', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue({
      ...heatmapFixture(),
      geocoding: { candidate_count: 34, status: 'pending' },
    });

    renderInbox();

    expect(await screen.findByText('Hay pendientes, pero falta el detalle seguro')).toBeInTheDocument();
    expect(screen.getByText(/informa 34 ubicaciones pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/no se inventan filas ni domicilios/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('list', { name: /ubicaciones visibles/i })).not.toBeInTheDocument());
  });
});
