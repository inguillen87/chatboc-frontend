import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PremiumTerritoryHeatmap } from './PremiumTerritoryMap';
import type { OperationsHeatmapPoint, OperationsHeatmapV1 } from './analyticsTypes';

const buildPoints = (count: number): OperationsHeatmapPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `point-${index}`,
    lat: -34.61 + index * 0.0001,
    lng: -60.91 + index * 0.0001,
    weight: 2,
    previous: 1,
    barrio: 'Centro',
    categoria: 'reclamos',
    canal: 'whatsapp',
  }));

describe('PremiumTerritoryHeatmap', () => {
  it('renders contract-driven layers, quality state and geocoding action', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: buildPoints(12),
      cells: [],
      hotspots: [],
      facets: [],
      category_layers: [],
      map_experience: {
        preferred_visualization: 'interactive_globe_heatmap',
        layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity'],
        empty_state_behavior: 'show_geocoding_queue_and_ai_summary',
      },
      quality: {
        state: 'degraded',
        label: 'Cobertura parcial',
        coverage_percent: 42,
        visible_points: 12,
        pending_geocode: 7,
        empty_state_action: {
          title: 'Resolver direcciones',
          method: 'PATCH',
          endpoint_template: '/api/tickets/{record_id}/ubicacion',
        },
      },
      geocoding: {
        status: 'queued',
        candidate_count: 7,
        candidates: [
          {
            record_id: 11,
            address: 'Av. Siempre Viva 123',
            category: 'reclamos',
            source: 'tickets',
          },
        ],
      },
      realtime: {
        poll_seconds: 30,
        sources: ['tickets'],
        socket_events: ['operations.heatmap.updated'],
      },
      ai_layers: {
        contract_version: 'huggingface.map_ai_layers.v1',
        layers: [{ key: 'priority_forecast', label: 'Prioridad IA', count: 2 }],
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={heatmap.points} heatmap={heatmap} />);

    expect(screen.getByRole('img', { name: 'Inteligencia territorial' })).toBeTruthy();
    expect(screen.getAllByText('Cobertura parcial').length).toBeGreaterThan(0);
    expect(screen.getByText('interactive globe heatmap')).toBeTruthy();
    expect(screen.getAllByText('Riesgo IA').length).toBeGreaterThan(0);
    expect(screen.getByText('Resolver direcciones')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Capas visibles' })).toBeTruthy();
  });
});
