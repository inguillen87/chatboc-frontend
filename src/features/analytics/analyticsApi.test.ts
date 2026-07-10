import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  panelGet: vi.fn(),
}));

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: mocks.panelGet,
  },
}));

import {
  getOperationsDashboardV2,
  getOperationsHeatmapV2,
  getOperationsAIProviderStatusV2,
  getOperationsAIBriefV2,
  getPublicMapConfigV1,
} from './analyticsApi';

describe('operations heatmap v2 contract', () => {
  beforeEach(() => {
    mocks.panelGet.mockReset();
  });

  it('passes segment filters and normalizes real category, age and gender facets', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'operations.heatmap.v1',
      render_contract: {
        state: 'ready',
        map_engine: 'deckgl',
        layers: ['base_heatmap', null, 'ai_risk_layers'],
        point_format: { lat: 'lat', lng: 'lng' },
        can_render_heatmap: 'false',
        recommended_views: ['interactive_globe', null, 'geocoding_queue'],
        premium_metadata: ['geo_layers', null, 'map_layers', 'source_quality'],
      },
      facets: [
        {
          key: 'categoria',
          label: 'Categorias',
          items: [{ value: 'alumbrado', label: 'Alumbrado', count: 4 }],
        },
      ],
      segments: {
        category: [{ key: 'alumbrado', label: 'Alumbrado', count: 4 }],
        gender: [{ key: 'femenino', label: 'Femenino', count: 3 }],
        age_range: [{ key: '35-44', label: '35-44', count: 2 }],
        source: [{ key: 'tickets', label: 'Tickets', count: 4 }],
      },
      applied_filters: {
        categoria: 'alumbrado',
        genero: 'femenino',
        rango_edad: '35-44',
        source: 'tickets',
      },
      demographics: {
        source: 'real_metadata_only',
        gender: [{ key: 'unknown', label: 'unknown', count: 1 }],
        age_ranges: [{ key: '35-44', label: '35-44', count: 2 }],
        known_gender_points: 3,
        known_age_points: 2,
        unknown_gender_points: 1,
        unknown_age_points: 0,
      },
      category_layers: [{ key: 'alumbrado', label: 'Alumbrado', count: 4 }],
      quality: {
        contract_version: 'operations.heatmap_quality.v1',
        state: 'ready',
        label: 'Mapa operativo confiable',
        coverage_rate: '0.75',
        coverage_percent: '75',
        visible_points: '1',
        pending_geocode: '2',
        can_render_heatmap: 'true',
      },
      realtime: {
        contract_version: 'operations.heatmap_realtime.v1',
        poll_seconds: '20',
        socket_namespace: 'analytics',
        socket_events: ['ticket.updated', 'whatsapp.message.created'],
        latest_event_at: '2026-06-27T10:00:00Z',
        sources: ['tickets', 'whatsapp'],
      },
      legend: {
        mode: 'category_source_quality',
      },
      geo_layers: {
        contract_version: 'operations.heatmap_geo_layers.v1',
        provider: 'geojson',
        coordinate_order: 'lng_lat',
        points: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-60.94, -34.58] },
              properties: { id: 'tenant_ticket:10', category: 'alumbrado', weight: 2 },
            },
            null,
          ],
        },
        cells: { type: 'FeatureCollection', features: [] },
        hotspots: { type: 'FeatureCollection', features: [] },
        categories: {
          alumbrado: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-60.94, -34.58] },
                properties: { category: 'alumbrado' },
              },
            ],
          },
        },
      },
      map_layers: {
        contract_version: 'operations.heatmap_map_layers.v1',
        engine: 'maplibre',
        format: 'geojson',
        layers: [
          { id: 'base_heatmap', label: 'Actividad territorial', source: 'geo_layers.points', type: 'heatmap' },
          { id: 'hotspots', label: 'Zonas criticas', source: 'geo_layers.hotspots', type: 'symbol' },
        ],
        telemetry: {
          event_endpoint: '/api/analytics/event',
          events: ['map_layer_toggled', 'heatmap_bbox_changed'],
        },
      },
      source_quality: {
        contract_version: 'operations.heatmap_source_quality.v1',
        sources: {
          ticket: { label: 'Reclamos', points: 1, pending_geocode: 2 },
        },
        summary: { points: 1, pending_geocode: 2 },
      },
      spatial_filter: {
        applied: 'true',
        bbox: { west: '-60.95', south: '-34.59', east: '-60.93', north: '-34.57' },
      },
      map_experience: {
        contract_version: 'operations.map_experience.v1',
        preferred_visualization: 'interactive_globe_heatmap',
        map_engines: ['maplibre', 'deckgl', 44, 'google'],
        layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity', null],
        empty_state_behavior: 'show_geocoding_queue_and_ai_summary',
        supports_reduced_motion: 'true',
      },
      ai_layers: {
        contract_version: 'huggingface.map_ai_layers.v1',
        status: 'ready',
        mode: 'municipal_risk_detection',
        hf_status: { configured: true },
        frontend_contract: {
          map_engines: ['deckgl', 'maplibre', false],
          layer_groups: ['ai_risk_layers', 'survey_participation', null],
        },
        risk_layers: [{ key: 'riesgo_alto', label: 'Riesgo alto', count: '2' }],
        recommendations: [{ label: 'Priorizar cuadrilla', method: 'POST' }],
      },
      ai_insights: {
        contract_version: 'huggingface.ai_insights.v1',
        provider_family: 'huggingface',
        mode: 'deterministic_local_fallback',
        domain: 'operations',
        hf_status: {
          configured: 'true',
          zero_shot_enabled: 'true',
          used: 'false',
        },
        advisory_policy: {
          mutates_operational_state: false,
        },
        thresholds: {
          risk_min_score: '0.56',
        },
        summary: {
          dominant_intent: 'public_service_claim',
          dominant_intent_label: 'reclamo de servicio publico',
          risk_level: 'high',
          requires_human_attention: true,
        },
        collection: {
          items_analyzed: '4',
        },
        recommended_actions: [{ label: 'Revisar conversaciones con riesgo', priority: 'high' }],
        frontend_contract: {
          advisory_only: true,
          safe_to_render_without_hf_token: true,
        },
      },
      map_narrative: {
        contract_version: 'operations.heatmap_narrative.v1',
        state: 'ready',
        headline: 'Mapa operativo Junin',
        body: 'Zona centro concentra reclamos activos.',
        title: 'Mapa operativo Junin',
        summary: 'Zona centro concentra reclamos activos.',
        empty_state_title: 'Sin coordenadas reales',
        primary_action: { label: 'Abrir cola de geocodificacion', ui_hint: 'open_geocoding_queue' },
      },
      layer_style_contract: {
        contract_version: 'operations.heatmap.layer_styles.v1',
        palette: ['#22d3ee', 10, '#f59e0b'],
        layers: [{ key: 'tickets', label: 'Tickets', count: '4' }],
        legend: [{ key: 'high', label: 'Alta densidad', value: '8' }],
      },
      viewport_presets: {
        contract_version: 'operations.heatmap_viewport_presets.v1',
        default_preset_id: 'junin_centro',
        camera_constraints: { min_zoom: '4' },
        presets: [
          {
            id: 'junin_centro',
            label: 'Centro',
            mode: 'fly_to',
            default: 'true',
            center: { lat: '-34.58', lon: '-60.94' },
            zoom: '13',
            pitch: '45',
            radiusKm: '2.5',
          },
        ],
      },
      hotspot_actions: {
        contract_version: 'operations.heatmap_hotspot_actions.v1',
        safe_by_default: 'true',
        writes_enabled: 'false',
        actions: [{ label: 'Asignar inspector', method: 'PATCH' }],
        playbook: [{ label: 'Validar zona caliente', enabled: true }],
      },
      hotspot_playbook: [{ label: 'Enviar aviso WhatsApp', endpoint: '/api/templates/send' }],
      operator_playbook: [{ label: 'Crear parte operativo', priority: 'high' }],
      ai_status: {
        contract_version: 'operations.heatmap_ai_status.v1',
        status: 'local_fallback',
        configured: 'true',
        used_hf: 'false',
        safe_to_render_without_hf_token: 'true',
        ai_layers_ready: 'true',
        map_layer_hints: ['risk_pulses', null, 'whatsapp_activity'],
      },
      geocoding: {
        contract_version: 'operations.heatmap.geocoding_queue.v1',
        status: 'pending',
        reason_code: 'address_without_coordinates',
        candidate_count: '1',
        candidates: [
          {
            record_id: 42,
            direccion: 'Av. San Martin 123, Junin',
            categoria: 'limpieza',
            origen: 'ticket',
            reason_code: 'address_without_coordinates',
            actions: [
              { id: 'open_record', label: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/42' },
              {
                id: 'update_location',
                label: 'Actualizar ubicacion',
                method: 'PATCH',
                endpoint: '/api/v2/tickets/42',
                requires: ['location.lat', 'location.lng'],
                body_template: { location: { lat: 'number', lng: 'number', address: 'string' } },
              },
            ],
          },
        ],
        recommended_action: {
          label: 'Geocodificar direcciones pendientes',
          method: 'PATCH',
          endpoint_template: '/api/tickets/{record_id}/ubicacion',
        },
        guidance: {
          contract_version: 'operations.heatmap_geocoding_guidance.v1',
          state: 'pending',
          candidate_count: '1',
          coverage_percent: '75',
          backend_external_calls: 'none',
          recommended_actions: [{ label: 'Abrir cola', ui_hint: 'open_geocoding_queue' }],
        },
      },
      points: [
        {
          id: 10,
          lat: '-34.58',
          lng: '-60.94',
          weight: '2',
          categoria: 'alumbrado',
          genero: 'femenino',
          rango_edad: '35-44',
          canal: 'whatsapp',
          source: 'tickets',
          barrio: 'Centro',
          estado: 'nuevo',
          actions: [
            { id: 'open_record', label: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/10' },
            {
              id: 'update_location',
              label: 'Actualizar ubicacion',
              method: 'PATCH',
              endpoint: '/api/v2/tickets/10',
              requires: ['location.lat', null, 'location.lng'],
              body_template: { location: { lat: 'number', lng: 'number' } },
            },
          ],
        },
      ],
    });

    const response = await getOperationsHeatmapV2({
      tenantSlug: 'junin',
      categoria: 'alumbrado',
      genero: 'femenino',
      rango_edad: '35-44',
      source: 'tickets',
      range: 'all',
      scope: 'historical',
      canal: 'whatsapp',
      barrio: 'Centro',
      estado: 'nuevo',
      include_ai: 0,
    });

    const [url, options] = mocks.panelGet.mock.calls[0];
    expect(url).toContain('/api/v2/analytics/operations/heatmap?');
    expect(url).toContain('categoria=alumbrado');
    expect(url).toContain('genero=femenino');
    expect(url).toContain('rango_edad=35-44');
    expect(url).toContain('source=tickets');
    expect(url).toContain('range=all');
    expect(url).toContain('scope=historical');
    expect(url).toContain('canal=whatsapp');
    expect(url).toContain('barrio=Centro');
    expect(url).toContain('estado=nuevo');
    expect(url).toContain('include_ai=0');
    expect(options).toMatchObject({ tenantSlug: 'junin' });

    expect(response.points).toHaveLength(1);
    expect(response.points[0]).toMatchObject({
      lat: -34.58,
      lng: -60.94,
      weight: 2,
      categoria: 'alumbrado',
      genero: 'femenino',
      rango_edad: '35-44',
      canal: 'whatsapp',
      source: 'tickets',
      barrio: 'Centro',
      estado: 'nuevo',
      actions: [
        { title: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/10' },
        {
          title: 'Actualizar ubicacion',
          method: 'PATCH',
          endpoint: '/api/v2/tickets/10',
          requires: ['location.lat', 'location.lng'],
          body_template: { location: { lat: 'number', lng: 'number' } },
        },
      ],
    });
    expect(response.render_contract).toMatchObject({
      state: 'ready',
      map_engine: 'deckgl',
      layers: ['base_heatmap', 'ai_risk_layers'],
      can_render_heatmap: false,
      recommended_views: ['interactive_globe', 'geocoding_queue'],
      premium_metadata: ['geo_layers', 'map_layers', 'source_quality'],
    });
    expect(response.facets[0].items[0]).toMatchObject({ label: 'Alumbrado', count: 4 });
    expect(response.segments?.gender?.[0]).toMatchObject({ label: 'Femenino', count: 3 });
    expect(response.filters_applied?.categoria).toBe('alumbrado');
    expect(response.applied_filters?.source).toBe('tickets');
    expect(response.demographics?.source).toBe('real_metadata_only');
    expect(response.demographics?.gender[0]).toMatchObject({ label: 'unknown', count: 1 });
    expect(response.category_layers[0]).toMatchObject({ label: 'Alumbrado', count: 4 });
    expect(response.quality).toMatchObject({
      contract_version: 'operations.heatmap_quality.v1',
      state: 'ready',
      coverage_rate: 0.75,
      coverage_percent: 75,
      visible_points: 1,
      pending_geocode: 2,
      can_render_heatmap: true,
    });
    expect(response.realtime).toMatchObject({
      poll_seconds: 20,
      socket_namespace: 'analytics',
      socket_events: ['ticket.updated', 'whatsapp.message.created'],
      latest_event_at: '2026-06-27T10:00:00Z',
    });
    expect(response.legend?.mode).toBe('category_source_quality');
    expect(response.geo_layers).toMatchObject({
      contract_version: 'operations.heatmap_geo_layers.v1',
      provider: 'geojson',
      coordinate_order: 'lng_lat',
    });
    expect(response.geo_layers?.points?.features).toHaveLength(1);
    expect(response.geo_layers?.categories?.alumbrado?.features).toHaveLength(1);
    expect(response.map_layers).toMatchObject({
      contract_version: 'operations.heatmap_map_layers.v1',
      engine: 'maplibre',
      telemetry: {
        event_endpoint: '/api/analytics/event',
        events: ['map_layer_toggled', 'heatmap_bbox_changed'],
      },
    });
    expect(response.source_quality).toMatchObject({
      contract_version: 'operations.heatmap_source_quality.v1',
      sources: {
        ticket: { label: 'Reclamos', points: 1, pending_geocode: 2 },
      },
    });
    expect(response.spatial_filter).toMatchObject({
      applied: true,
      bbox: { west: '-60.95', south: '-34.59', east: '-60.93', north: '-34.57' },
    });
    expect(response.map_experience).toMatchObject({
      contract_version: 'operations.map_experience.v1',
      preferred_visualization: 'interactive_globe_heatmap',
      map_engines: ['maplibre', 'deckgl', 'google'],
      layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity'],
      supports_reduced_motion: true,
    });
    expect(response.ai_layers).toMatchObject({
      contract_version: 'huggingface.map_ai_layers.v1',
      status: 'ready',
      mode: 'municipal_risk_detection',
      frontend_contract: {
        map_engines: ['deckgl', 'maplibre'],
        layer_groups: ['ai_risk_layers', 'survey_participation'],
      },
      risk_layers: [{ label: 'Riesgo alto', count: 2 }],
      recommendations: [{ title: 'Priorizar cuadrilla', method: 'POST' }],
    });
    expect(response.ai_insights).toMatchObject({
      contract_version: 'huggingface.ai_insights.v1',
      provider_family: 'huggingface',
      mode: 'deterministic_local_fallback',
      domain: 'operations',
      hf_status: {
        configured: 'true',
        zero_shot_enabled: 'true',
        used: 'false',
      },
      thresholds: {
        risk_min_score: '0.56',
      },
      summary: {
        dominant_intent: 'public_service_claim',
        dominant_intent_label: 'reclamo de servicio publico',
        risk_level: 'high',
        requires_human_attention: true,
      },
      collection: {
        items_analyzed: '4',
      },
      recommended_actions: [{ title: 'Revisar conversaciones con riesgo', priority: 'high' }],
      frontend_contract: {
        advisory_only: true,
        safe_to_render_without_hf_token: true,
      },
    });
    expect(response.map_narrative).toMatchObject({
      contract_version: 'operations.heatmap_narrative.v1',
      state: 'ready',
      headline: 'Mapa operativo Junin',
      title: 'Mapa operativo Junin',
      body: 'Zona centro concentra reclamos activos.',
      description: 'Zona centro concentra reclamos activos.',
      operator_summary: 'Zona centro concentra reclamos activos.',
      primary_cta: { title: 'Abrir cola de geocodificacion', ui_hint: 'open_geocoding_queue' },
    });
    expect(response.layer_style_contract).toMatchObject({
      contract_version: 'operations.heatmap.layer_styles.v1',
      palette: ['#22d3ee', '#f59e0b'],
      layers: [{ label: 'Tickets', count: 4 }],
      legend_items: [{ label: 'Alta densidad', value: 8 }],
    });
    expect(response.viewport_presets).toMatchObject({
      contract_version: 'operations.heatmap_viewport_presets.v1',
      default_preset_id: 'junin_centro',
    });
    expect(response.viewport_presets?.presets[0]).toMatchObject({
      id: 'junin_centro',
      label: 'Centro',
      mode: 'fly_to',
      default: true,
      center: { lat: -34.58, lng: -60.94 },
      zoom: 13,
      pitch: 45,
      radius_km: 2.5,
    });
    expect(response.hotspot_actions).toMatchObject({
      contract_version: 'operations.heatmap_hotspot_actions.v1',
      safe_by_default: true,
      writes_enabled: false,
      actions: [{ title: 'Asignar inspector', method: 'PATCH' }],
      playbook: [{ title: 'Validar zona caliente' }],
    });
    expect(response.hotspot_playbook?.[0]).toMatchObject({ title: 'Enviar aviso WhatsApp' });
    expect(response.operator_playbook?.[0]).toMatchObject({ title: 'Crear parte operativo', priority: 'high' });
    expect(response.ai_status).toMatchObject({
      contract_version: 'operations.heatmap_ai_status.v1',
      status: 'local_fallback',
      configured: true,
      used_hf: false,
      safe_to_render_without_hf_token: true,
      ai_layers_ready: true,
      map_layer_hints: ['risk_pulses', 'whatsapp_activity'],
    });
    expect(response.geocoding).toMatchObject({
      contract_version: 'operations.heatmap.geocoding_queue.v1',
      status: 'pending',
      candidate_count: 1,
      recommended_action: {
        title: 'Geocodificar direcciones pendientes',
        method: 'PATCH',
      },
      guidance: {
        contract_version: 'operations.heatmap_geocoding_guidance.v1',
        state: 'pending',
        candidate_count: 1,
        coverage_percent: 75,
        backend_external_calls: 'none',
        recommended_actions: [{ title: 'Abrir cola', ui_hint: 'open_geocoding_queue' }],
      },
    });
    expect(response.geocoding?.candidates?.[0]).toMatchObject({
      record_id: 42,
      address: 'Av. San Martin 123, Junin',
      category: 'limpieza',
      source: 'ticket',
      actions: [
        { title: 'Abrir ticket', method: 'GET', endpoint: '/api/v2/tickets/42' },
        {
          title: 'Actualizar ubicacion',
          method: 'PATCH',
          endpoint: '/api/v2/tickets/42',
          requires: ['location.lat', 'location.lng'],
          body_template: { location: { lat: 'number', lng: 'number', address: 'string' } },
        },
      ],
    });
  });

  it('reads the backend map config contract for operational maps', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'public.map_config.v1',
      provider: 'maplibre',
      available_providers: ['google', 'maplibre'],
      style_url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      style_url_source: 'configured',
      style_url_warning: null,
      maptiler_key: '',
      google_maps_key: 'test-google-key',
    });

    const response = await getPublicMapConfigV1({ tenantSlug: 'junin-1' });

    const [url, options] = mocks.panelGet.mock.calls[0];
    expect(url).toContain('/api/map/config?');
    expect(url).toContain('tenant_slug=junin-1');
    expect(url).toContain('tenant=junin-1');
    expect(options).toMatchObject({ tenantSlug: 'junin-1' });
    expect(response).toMatchObject({
      contract_version: 'public.map_config.v1',
      provider: 'maplibre',
      style_url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      google_maps_key: 'test-google-key',
    });
  });

  it('normalizes the standalone operations AI brief contract', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'operations.ai_brief.v1',
      source_contract: 'operations.dashboard.v1',
      generated_at: '2026-06-27T12:00:00Z',
      summary: {
        headline: 'Picos de reclamos por luminaria.',
        narrative: 'La prioridad operativa esta en reclamos nuevos y conversaciones sin leer.',
        dominant_intent: 'reclamos',
        sentiment: 'urgente',
      },
      priority: {
        severity: 'high',
        score: 82,
        label: 'Alta',
        focus_items: ['Luminaria', 'Centro'],
      },
      recommended_actions: [
        {
          id: 'assign-luminaria',
          title: 'Asignar cuadrilla de luminaria',
          description: 'Reducir espera en Centro.',
          priority: 'high',
          owner_hint: 'Obras publicas',
        },
      ],
      model_policy: {
        task_type: 'analytics',
        primary_provider: 'huggingface',
        selected_provider: 'fallback',
        model_used: 'deterministic-operational-brief',
        hf_enabled: true,
        hf_configured: true,
      },
      access: {
        requires_capability: 'analytics_dashboard',
        tenant_scoped: true,
      },
    });

    const response = await getOperationsAIBriefV2({ tenantSlug: 'junin' });

    const [url, options] = mocks.panelGet.mock.calls[0];
    expect(url).toContain('/api/v2/analytics/operations/ai-brief');
    expect(options).toMatchObject({ tenantSlug: 'junin' });
    expect(response).toMatchObject({
      contract_version: 'operations.ai_brief.v1',
      summary: {
        headline: 'Picos de reclamos por luminaria.',
        dominant_intent: 'reclamos',
      },
      priority: {
        severity: 'high',
        score: 82,
        focus_items: ['Luminaria', 'Centro'],
      },
      model_policy: {
        task_type: 'analytics',
        hf_enabled: true,
        hf_configured: true,
      },
    });
    expect(response.focus_items.map((item) => item.label)).toEqual(['Luminaria', 'Centro']);
    expect(response.top_action).toMatchObject({
      title: 'Asignar cuadrilla de luminaria',
      priority: 'high',
    });
  });

  it('normalizes tenant scoped AI provider status without secret values', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'ai.provider_status_public.v1',
      generated_at: '2026-06-27T12:00:00Z',
      secret_values_exposed: 'false',
      llm_provider_order: ['gemini', 'openai', null, 'huggingface'],
      readiness: {
        chat_ready: 'true',
        specialized_ai_ready: 'false',
        status: 'warning',
        warnings: ['huggingface_quota_or_payment_required', null],
      },
      providers: {
        gemini: {
          configured: 'true',
          provider_order_enabled: 'true',
          chat_model: 'gemini-2.5-flash',
        },
        huggingface: {
          configured: 'true',
          enabled: 'true',
          runtime_status: 'degraded',
          quota_depleted: 'true',
          fallback_behavior: 'deterministic_local_fallback',
          required_env: ['HUGGINGFACE_API_TOKEN', null],
          last_failure: {
            reason_code: 'huggingface_quota_or_payment_required',
            task: 'zero_shot',
            message: 'raw message should stay out of normalized failure',
          },
        },
      },
      frontend_contract: {
        render_as: 'operations_ai_provider_status',
        advisory_only: true,
      },
    });

    const response = await getOperationsAIProviderStatusV2({ tenantSlug: 'junin' });

    const [url, options] = mocks.panelGet.mock.calls[0];
    expect(url).toContain('/api/v2/analytics/operations/ai-provider-status');
    expect(options).toMatchObject({ tenantSlug: 'junin' });
    expect(response).toMatchObject({
      contract_version: 'ai.provider_status_public.v1',
      secret_values_exposed: false,
      llm_provider_order: ['gemini', 'openai', 'huggingface'],
      readiness: {
        chat_ready: true,
        specialized_ai_ready: false,
        status: 'warning',
        warnings: ['huggingface_quota_or_payment_required'],
      },
      providers: {
        gemini: {
          provider: 'gemini',
          configured: true,
          provider_order_enabled: true,
          chat_model: 'gemini-2.5-flash',
        },
        huggingface: {
          provider: 'huggingface',
          configured: true,
          enabled: true,
          runtime_status: 'degraded',
          quota_depleted: true,
          fallback_behavior: 'deterministic_local_fallback',
          required_env: ['HUGGINGFACE_API_TOKEN'],
          last_failure: {
            reason_code: 'huggingface_quota_or_payment_required',
            task: 'zero_shot',
          },
        },
      },
    });
    expect(response.providers.huggingface.last_failure).not.toHaveProperty('message');
  });

  it('keeps the AI brief when it is embedded in the operations dashboard contract', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'operations.dashboard.v1',
      generated_at: '2026-06-27T12:00:00Z',
      summary: {
        total_tickets: 2,
        open_tickets: 1,
        resolved_tickets: 1,
        avg_first_response_minutes: 15,
        avg_resolution_hours: 4,
        unread_conversations: 1,
        active_surveys: 1,
        unread_survey_comments: 1,
        live_votes: 10,
      },
      status_breakdown: [],
      category_breakdown: [],
      channel_breakdown: [],
      sla: {},
      trends: {},
      alerts: [],
      next_best_actions: [],
      heatmap: { contract_version: 'operations.heatmap.v1', points: [] },
      realtime: {},
      survey_analytics: {},
      ai_brief: {
        contract_version: 'operations.ai_brief.v1',
        summary: {
          headline: 'Conversaciones ciudadanas en aumento.',
          narrative: 'Se recomienda revisar comentarios nuevos.',
          dominant_intent: 'survey_feedback',
          sentiment: 'mixed',
        },
        priority: {
          severity: 'medium',
          score: 61,
          label: 'Media',
          focus_items: ['Encuestas'],
        },
        recommended_actions: [],
        model_policy: {
          task_type: 'analytics',
          selected_provider: 'fallback',
          model_used: 'deterministic-operational-brief',
        },
      },
    });

    const response = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(response.ai_brief).toMatchObject({
      contract_version: 'operations.ai_brief.v1',
      summary: {
        headline: 'Conversaciones ciudadanas en aumento.',
        dominant_intent: 'survey_feedback',
      },
      priority: {
        severity: 'medium',
        score: 61,
      },
    });
    expect(response.ai_brief?.focus_items.map((item) => item.label)).toEqual(['Encuestas']);
  });
});
