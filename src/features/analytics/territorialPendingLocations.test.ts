import { describe, expect, it } from 'vitest';

import type { OperationsHeatmapV1 } from './analyticsTypes';
import {
  adaptPendingLocationQueue,
  buildPendingLocationTicketHref,
  safeAggregateAreaLabel,
} from './territorialPendingLocations';

const heatmapWith = (geocoding: OperationsHeatmapV1['geocoding']): OperationsHeatmapV1 => ({
  points: [],
  cells: [],
  hotspots: [],
  facets: [],
  category_layers: [],
  geocoding,
});

describe('territorialPendingLocations adapter', () => {
  it('redacts exact address identifiers while retaining a useful aggregate corridor', () => {
    expect(safeAggregateAreaLabel({ address: '25 de Mayo 1234, Junín, Mendoza' })).toBe('Corredor 25 de Mayo');
    expect(safeAggregateAreaLabel({ street_segment: 'Av. San Martín 742, piso 2' })).toBe('Av. San Martín');
    expect(safeAggregateAreaLabel({ address: 'Mz. B lote 12, Barrio Norte' })).toBe('Área todavía no publicada');
  });

  it('adapts published candidates without enabling write actions implicitly', () => {
    const queue = adaptPendingLocationQueue(heatmapWith({
      contract_version: 'operations.heatmap.geocoding_queue.v1',
      status: 'pending',
      candidate_count: 3,
      candidates: [{
        record_id: 42,
        ticket_id: 'M-42',
        source_model: 'MunicipioTicket',
        address: 'Don Bosco 531, Junín',
        category: 'Luminarias',
        source: 'whatsapp',
        reason_code: 'address_without_coordinates',
        actions: [
          { id: 'open_record', method: 'GET', endpoint: '/api/v2/tickets/42' },
          { id: 'approve_location', method: 'PATCH', endpoint: '/api/v2/tickets/42', writes_enabled: false },
        ],
      }],
    }), 'junin');

    expect(queue).toMatchObject({
      state: 'partial',
      total: 3,
      published: 1,
      hidden: 2,
      writesEnabled: false,
    });
    expect(queue.candidates[0]).toMatchObject({
      safeAreaLabel: 'Corredor Don Bosco',
      qualityLabel: 'Dirección sin coordenadas verificadas',
      ticketHref: '/perfil?tab=tickets&focus=territorial_location_review&ticket_id=M-42&tenant_slug=junin&tenant=junin&source_model=MunicipioTicket',
      actions: {
        review: { enabled: true },
        approve: { enabled: false },
        reject: { enabled: false },
      },
    });
  });

  it('reports a summary-only contract instead of inventing candidate rows', () => {
    const queue = adaptPendingLocationQueue(heatmapWith({ candidate_count: 34, status: 'pending' }), 'junin');

    expect(queue).toMatchObject({ state: 'summary_only', total: 34, published: 0, hidden: 34 });
    expect(queue.candidates).toEqual([]);
  });

  it('only includes supported source models in ticket deep links', () => {
    expect(buildPendingLocationTicketHref('52', 'junin', 'TenantTicket')).toContain('source_model=TenantTicket');
    expect(buildPendingLocationTicketHref(null, 'junin', 'TenantTicket')).toBeNull();
  });
});
