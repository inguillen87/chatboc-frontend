import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PremiumTerritoryHeatmap } from './PremiumTerritoryMap';
import type { OperationsHeatmapPoint, OperationsHeatmapV1 } from './analyticsTypes';

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: (props: {
    heatmapData?: unknown[];
    fitToBounds?: unknown[];
    provider?: string;
    mapStyleUrl?: string | null;
    maptilerKey?: string | null;
    googleMapsKey?: string | null;
  }) => (
    <div
      data-testid="mock-live-map"
      data-points={String(props.heatmapData?.length ?? 0)}
      data-bounds={String(props.fitToBounds?.length ?? 0)}
      data-provider={props.provider}
      data-style-url={props.mapStyleUrl ?? ''}
      data-maptiler-key={props.maptilerKey ?? ''}
      data-google-key={props.googleMapsKey ?? ''}
    />
  ),
}));

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
      map_narrative: {
        headline: 'Zona centro requiere seguimiento',
        operator_summary: 'Alta demanda concentrada con reclamos pendientes de coordenadas.',
        primary_cta: {
          label: 'Abrir cola operativa',
          ui_hint: 'open_geocoding_queue',
        },
      },
      viewport_presets: {
        default_preset_id: 'centro',
        presets: [
          {
            id: 'centro',
            label: 'Centro operativo',
            mode: 'fly_to',
            default: true,
            zoom: 13,
            radius_km: 2.5,
          },
        ],
      },
      hotspot_actions: {
        safe_by_default: true,
        writes_enabled: false,
        actions: [{ label: 'Asignar inspector', method: 'PATCH', endpoint: '/api/tickets/11' }],
        playbook: [{ label: 'Validar zona caliente' }],
      },
      ai_status: {
        status: 'local_fallback',
        mode: 'municipal_risk_detection',
        safe_to_render_without_hf_token: true,
        ai_layers_ready: true,
        map_layer_hints: ['risk_pulses', 'whatsapp_activity'],
      },
      ai_layers: {
        contract_version: 'huggingface.map_ai_layers.v1',
        layers: [{ key: 'priority_forecast', label: 'Prioridad IA', count: 2 }],
      },
    } satisfies OperationsHeatmapV1;

    render(
      <PremiumTerritoryHeatmap
        points={heatmap.points}
        heatmap={heatmap}
        mapConfig={{
          provider: 'maplibre',
          style_url: 'https://tiles.test/style.json',
          maptiler_key: 'maptiler-test',
          google_maps_key: 'google-test',
        }}
      />,
    );

    expect(screen.getByTestId('live-territory-map')).toBeTruthy();
    const liveMap = screen.getByTestId('mock-live-map');
    expect(liveMap.getAttribute('data-points')).toBe('12');
    expect(liveMap.getAttribute('data-bounds')).toBe('12');
    expect(liveMap.getAttribute('data-provider')).toBe('maplibre');
    expect(liveMap.getAttribute('data-style-url')).toBe('https://tiles.test/style.json');
    expect(liveMap.getAttribute('data-maptiler-key')).toBe('maptiler-test');
    expect(liveMap.getAttribute('data-google-key')).toBe('google-test');
    expect(screen.getAllByText('Cobertura parcial').length).toBeGreaterThan(0);
    expect(screen.getByText('interactive globe heatmap')).toBeTruthy();
    expect(screen.getAllByText('Riesgo IA').length).toBeGreaterThan(0);
    expect(screen.getByText('Resolver direcciones')).toBeTruthy();
    const decisionRadar = screen.getByTestId('territory-decision-radar');
    expect(decisionRadar).toBeTruthy();
    expect(screen.getByText('Radar de decision')).toBeTruthy();
    expect(decisionRadar.textContent).toContain('Abrir cola operativa');
    expect(screen.getByText('Zona foco')).toBeTruthy();
    expect(screen.getByText('Capas activas')).toBeTruthy();
    expect(screen.getByText('Datos pendientes')).toBeTruthy();
    expect(decisionRadar.textContent).toContain('queued');
    expect(screen.getByRole('group', { name: 'Capas visibles' })).toBeTruthy();
    expect(screen.getByText('Brief operativo IA')).toBeTruthy();
    expect(screen.getByText('Zona centro requiere seguimiento')).toBeTruthy();
    expect(screen.getByText('Alta demanda concentrada con reclamos pendientes de coordenadas.')).toBeTruthy();
    expect(screen.getByText('local fallback')).toBeTruthy();
    expect(screen.getAllByText('municipal risk detection').length).toBeGreaterThan(0);
    expect(screen.getByText('Centro operativo')).toBeTruthy();
    expect(screen.getByText('fly to - zoom 13 - 2,5 km')).toBeTruthy();
    expect(screen.getByText('Asignar inspector')).toBeTruthy();
    expect(screen.getByText('Safe by default - solo preparacion operativa')).toBeTruthy();
  });

  it('keeps the atlas fallback when there are no live coordinates', () => {
    render(<PremiumTerritoryHeatmap points={[{ id: 'draft-only', weight: 1, categoria: 'reclamos' }]} />);

    expect(screen.queryByTestId('live-territory-map')).toBeNull();
    expect(screen.getByRole('img', { name: 'Inteligencia territorial' })).toBeTruthy();
  });
});
