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
    geoLayerConfig?: {
      contract_version?: string;
      source?: { features?: unknown[] };
      layers?: {
        heatmap?: { id?: string };
        clusters?: { id?: string };
        points?: { id?: string };
      };
      telemetry?: { event_endpoint?: string; events?: string[] };
      source_options?: { enabled_layers?: string[]; default_viewport_id?: string };
      interactions?: { time_slider?: { enabled?: boolean; field?: string } };
    } | null;
  }) => (
    <div
      data-testid="mock-live-map"
      data-points={String(props.heatmapData?.length ?? 0)}
      data-bounds={String(props.fitToBounds?.length ?? 0)}
      data-provider={props.provider}
      data-style-url={props.mapStyleUrl ?? ''}
      data-maptiler-key={props.maptilerKey ?? ''}
      data-google-key={props.googleMapsKey ?? ''}
      data-geo-contract={props.geoLayerConfig?.contract_version ?? ''}
      data-geo-features={String(props.geoLayerConfig?.source?.features?.length ?? 0)}
      data-geo-heat-layer={props.geoLayerConfig?.layers?.heatmap?.id ?? ''}
      data-geo-point-layer={props.geoLayerConfig?.layers?.points?.id ?? ''}
      data-geo-telemetry-endpoint={props.geoLayerConfig?.telemetry?.event_endpoint ?? ''}
      data-geo-telemetry-events={props.geoLayerConfig?.telemetry?.events?.join('|') ?? ''}
      data-geo-enabled-layers={props.geoLayerConfig?.source_options?.enabled_layers?.join('|') ?? ''}
      data-geo-default-viewport={props.geoLayerConfig?.source_options?.default_viewport_id ?? ''}
      data-geo-time-slider={props.geoLayerConfig?.interactions?.time_slider?.enabled ? 'true' : 'false'}
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
      points: buildPoints(12).map((point, index) =>
        index === 0
          ? {
              ...point,
              label: 'Ticket centro',
              actions: [
                {
                  id: 'open_record',
                  label: 'Abrir ticket caliente',
                  method: 'GET',
                  endpoint: '/api/v2/tickets/11',
                  ui_hint: 'open_ticket',
                },
              ],
            }
          : point,
      ),
      cells: [],
      hotspots: [],
      operational_hotspots: [
        {
          id: '-34.604:-58.382',
          lat: -34.604,
          lng: -58.382,
          count: 5,
          weight: 6.8,
          operational_score: 41,
          rank_reason: 'sla_breached',
          top_category: 'reclamos',
          top_channel: 'whatsapp',
          latest_event_at: '2026-07-03T12:00:00Z',
          signals: {
            breached_sla: 2,
            overdue: 2,
            unassigned: 1,
            recent_24h: 4,
            tickets: 3,
            surveys: 1,
            analytics_events: 1,
          },
          recommended_action: {
            label: 'Abrir zona prioritaria',
            ui_hint: 'focus_map_cell_and_filter_tickets',
            filters: {
              category: 'reclamos',
              channel: 'whatsapp',
              cell_id: '-34.604:-58.382',
            },
          },
        },
      ],
      facets: [],
      category_layers: [],
      summary: {
        operational_hotspots: 1,
      },
      legend: {
        contract_version: 'operations.map.legend.v1',
        legend_items: [
          { label: 'SLA critico', color: '#ef4444', description: 'casos vencidos' },
          { label: 'WhatsApp activo', color: '#22d3ee', description: 'eventos realtime' },
        ],
      },
      layer_style_contract: {
        contract_version: 'operations.map.styles.v1',
        palette: ['#3b82f6', '#14b8a6', '#f59e0b'],
        legend_items: [{ label: 'Prioridad IA', color: '#a855f7', description: 'prediccion operativa' }],
      },
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
            actions: [
              {
                id: 'update_location',
                label: 'Actualizar ubicacion',
                method: 'PATCH',
                endpoint: '/api/v2/tickets/11',
                priority: 'high',
                ui_hint: 'open_geocoding_queue',
                body_template: { location: { lat: 'number', lng: 'number' } },
              },
            ],
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
      map_layers: {
        contract_version: 'analytics.geo_layers.v1',
        provider: {
          style_url: 'https://tiles.backend/style.json',
        },
        intensity: { total_cases: 44, total_items: 6 },
        category_heatmap: { layer_id: 'municipal-demand-heat' },
        hotspots: {
          point_layer_id: 'municipal-hotspot-points',
          focus: {
            category: 'reclamos',
            count: 22,
            risk: { level: 'critical', label: 'Critico' },
          },
        },
        visual_system: {
          renderer: 'webgl_heatmap',
          animations: { radar_sweep: true, pulse_hotspots: true },
        },
        operator_metrics: {
          total_cases: 44,
          visible_layers: 6,
          top_category: 'reclamos',
          critical_hotspots: 1,
        },
        telemetry: {
          event_endpoint: '/api/v2/analytics/map-events',
          events: ['map_loaded', 'cluster_click'],
        },
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
    expect(liveMap.getAttribute('data-geo-contract')).toBe('operations.heatmap.geo_layers.v1');
    expect(liveMap.getAttribute('data-geo-features')).toBe('12');
    expect(liveMap.getAttribute('data-geo-heat-layer')).toBe('municipal-demand-heat');
    expect(liveMap.getAttribute('data-geo-point-layer')).toBe('municipal-hotspot-points');
    expect(liveMap.getAttribute('data-geo-telemetry-endpoint')).toBe('/api/v2/analytics/map-events');
    expect(liveMap.getAttribute('data-geo-telemetry-events')).toContain('map_loaded');
    expect(liveMap.getAttribute('data-geo-telemetry-events')).toContain('cluster_click');
    expect(liveMap.getAttribute('data-geo-enabled-layers')).toContain('heat');
    expect(liveMap.getAttribute('data-geo-default-viewport')).toBe('centro');
    expect(liveMap.getAttribute('data-geo-time-slider')).toBe('true');
    expect(screen.getAllByText('Cobertura parcial').length).toBeGreaterThan(0);
    expect(screen.getByText('interactive globe heatmap')).toBeTruthy();
    expect(screen.getAllByText('Riesgo IA').length).toBeGreaterThan(0);
    expect(screen.getByText('Resolver direcciones')).toBeTruthy();
    const executiveStrip = screen.getByTestId('territory-executive-strip');
    expect(executiveStrip.textContent).toContain('Lectura ejecutiva');
    expect(executiveStrip.textContent).toContain('Puntos visibles');
    expect(executiveStrip.textContent).toContain('12');
    expect(executiveStrip.textContent).toContain('Pendientes');
    expect(executiveStrip.textContent).toContain('7');
    expect(executiveStrip.textContent).toContain('Foco territorial');
    expect(executiveStrip.textContent).toContain('reclamos');
    expect(executiveStrip.textContent).toContain('Proxima accion');
    expect(executiveStrip.textContent).toContain('Abrir cola operativa');
    const commandLoop = screen.getByTestId('territory-command-loop');
    expect(commandLoop.textContent).toContain('Pulso operativo territorial');
    expect(commandLoop.textContent).toContain('Command loop IA');
    expect(commandLoop.textContent).toContain('1 hotspots');
    expect(commandLoop.textContent).toContain('reclamos');
    expect(commandLoop.textContent).toContain('Abrir cola operativa');
    expect(commandLoop.textContent).toContain('42%');
    expect(commandLoop.textContent).toContain('30s');
    expect(screen.getAllByTestId('territory-command-card').length).toBe(4);
    const commandLoopCta = screen.getByRole('link', { name: /abrir cola crm/i });
    expect(commandLoopCta.getAttribute('href')).toContain('/perfil?tab=tickets');
    expect(commandLoopCta.getAttribute('href')).toContain('focus=open_geocoding_queue');
    const decisionRadar = screen.getByTestId('territory-decision-radar');
    expect(decisionRadar).toBeTruthy();
    expect(screen.getByText('Radar de decision')).toBeTruthy();
    expect(decisionRadar.textContent).toContain('Abrir cola operativa');
    expect(screen.getByText('Foco backend')).toBeTruthy();
    expect(screen.getByText('Capas activas')).toBeTruthy();
    expect(screen.getByText('Datos pendientes')).toBeTruthy();
    expect(decisionRadar.textContent).toContain('queued');
    expect(screen.getByTestId('backend-map-contract-card')).toBeTruthy();
    expect(screen.getAllByText('webgl heatmap').length).toBeGreaterThan(0);
    expect(screen.getByText('radar activo')).toBeTruthy();
    expect(screen.getByText('Hotspots criticos')).toBeTruthy();
    expect(screen.getByText('22 casos agrupados en el foco operativo.')).toBeTruthy();
    const liveLegend = screen.getByTestId('territory-live-legend');
    expect(liveLegend).toBeTruthy();
    expect(liveLegend.textContent).toContain('Señal viva');
    expect(liveLegend.textContent).toContain('operations.heatmap.updated');
    expect(liveLegend.textContent).toContain('Foco');
    expect(liveLegend.textContent).toContain('reclamos');
    expect(liveLegend.textContent).toContain('Accion siguiente');
    expect(liveLegend.textContent).toContain('Abrir cola operativa');
    expect(liveLegend.textContent).toContain('Sistema visual');
    expect(liveLegend.textContent).toContain('webgl heatmap');
    expect(liveLegend.textContent).toContain('SLA critico');
    expect(liveLegend.textContent).toContain('WhatsApp activo');
    expect(liveLegend.textContent).toContain('Prioridad IA');
    expect(screen.getByTestId('operational-hotspots-panel')).toBeTruthy();
    expect(screen.getByText('Hotspots operativos')).toBeTruthy();
    expect(screen.getByText('Zonas para actuar primero')).toBeTruthy();
    expect(screen.getByText('SLA vencido')).toBeTruthy();
    expect(screen.getByText('SLA: 2')).toBeTruthy();
    expect(screen.getByText('sin responsable: 1')).toBeTruthy();
    expect(screen.getByText('24h: 4')).toBeTruthy();
    expect(screen.getAllByTestId('operational-hotspot-item').length).toBe(1);
    expect(screen.getByRole('group', { name: 'Capas visibles' })).toBeTruthy();
    expect(screen.getByText('Brief operativo IA')).toBeTruthy();
    expect(screen.getByText('Zona centro requiere seguimiento')).toBeTruthy();
    expect(screen.getByText('Alta demanda concentrada con reclamos pendientes de coordenadas.')).toBeTruthy();
    expect(screen.getByText('local fallback')).toBeTruthy();
    expect(screen.getAllByText('municipal risk detection').length).toBeGreaterThan(0);
    expect(screen.getByText('Centro operativo')).toBeTruthy();
    expect(screen.getByText('fly to - zoom 13 - 2,5 km')).toBeTruthy();
    expect(screen.getByTestId('heatmap-action-loop')).toBeTruthy();
    expect(screen.getAllByTestId('heatmap-action-item').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('Asignar inspector')).toBeTruthy();
    expect(screen.getByText('Actualizar ubicacion')).toBeTruthy();
    expect(screen.getByText('Abrir ticket caliente')).toBeTruthy();
    expect(screen.getAllByText('preparacion segura').length).toBeGreaterThan(0);
    const crmLinks = screen.getAllByRole('link', { name: /abrir en crm/i });
    expect(crmLinks.length).toBeGreaterThan(0);
    expect(crmLinks.some((link) => link.getAttribute('href')?.includes('/perfil?tab=tickets'))).toBe(true);
    expect(crmLinks.some((link) => link.getAttribute('href')?.includes('ticket_id=11'))).toBe(true);
    expect(crmLinks.some((link) => link.getAttribute('href')?.includes('focus=open_geocoding_queue'))).toBe(true);
    expect(screen.getByText('Safe by default - solo preparacion operativa')).toBeTruthy();
  });

  it('keeps the atlas fallback when there are no live coordinates', () => {
    render(<PremiumTerritoryHeatmap points={[{ id: 'draft-only', weight: 1, categoria: 'reclamos' }]} />);

    expect(screen.queryByTestId('live-territory-map')).toBeNull();
    expect(screen.getByRole('img', { name: 'Inteligencia territorial' })).toBeTruthy();
    expect(screen.getByTestId('territory-hud-overlay')).toBeTruthy();
    expect(screen.getByTestId('territory-radar-sweep')).toBeTruthy();
    expect(screen.getByTestId('territory-selected-crosshair')).toBeTruthy();
    expect(screen.getAllByTestId('territory-comet-route').length).toBeGreaterThan(0);
  });

  it('renders backend heatmap cells as live map points when raw points are absent', () => {
    const heatmap = {
      contract_version: 'operations.heatmap.v1',
      points: [],
      cells: [
        {
          cell_id: 'cell-centro',
          centroid_lat: -34.61,
          centroid_lon: -60.91,
          count: 9,
          dominant_category: 'alumbrado',
          risk: { level: 'critical', label: 'Critico' },
        },
      ],
      hotspots: [],
      facets: [],
      category_layers: [],
      map_layers: {
        contract_version: 'analytics.geo_layers.v1',
        intensity: { total_cases: 9, total_items: 1 },
        hotspots: {
          focus: {
            category: 'alumbrado',
            count: 9,
            risk: { level: 'critical', label: 'Critico' },
          },
        },
        visual_system: {
          renderer: 'webgl_heatmap',
          animations: { radar_sweep: true },
        },
        operator_metrics: {
          total_cases: 9,
          visible_layers: 1,
          top_category: 'alumbrado',
          critical_hotspots: 1,
        },
      },
    } satisfies OperationsHeatmapV1;

    render(<PremiumTerritoryHeatmap points={[]} heatmap={heatmap} allowDemoFallback />);

    const liveMap = screen.getByTestId('mock-live-map');
    expect(screen.getByTestId('live-territory-map')).toBeTruthy();
    expect(liveMap.getAttribute('data-points')).toBe('1');
    expect(liveMap.getAttribute('data-geo-contract')).toBe('operations.heatmap.geo_layers.v1');
    expect(liveMap.getAttribute('data-geo-features')).toBe('1');
    expect(screen.getByText('heatmap backend')).toBeTruthy();
    expect(screen.getAllByText('alumbrado').length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: 'Inteligencia territorial' })).toBeNull();
  });
});
