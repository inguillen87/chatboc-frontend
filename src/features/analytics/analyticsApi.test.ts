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
      map_experience: {
        contract_version: 'operations.map_experience.v1',
        preferred_visualization: 'interactive_globe_heatmap',
        map_engines: ['maplibre', 'deckgl', 44, 'google'],
        layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity', null],
        empty_state_behavior: 'show_geocoding_queue_and_ai_summary',
        supports_reduced_motion: 'true',
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
          },
        ],
        recommended_action: {
          label: 'Geocodificar direcciones pendientes',
          method: 'PATCH',
          endpoint_template: '/api/tickets/{record_id}/ubicacion',
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
    expect(response.map_experience).toMatchObject({
      contract_version: 'operations.map_experience.v1',
      preferred_visualization: 'interactive_globe_heatmap',
      map_engines: ['maplibre', 'deckgl', 'google'],
      layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity'],
      supports_reduced_motion: true,
    });
    expect(response.geocoding).toMatchObject({
      contract_version: 'operations.heatmap.geocoding_queue.v1',
      status: 'pending',
      candidate_count: 1,
      recommended_action: {
        title: 'Geocodificar direcciones pendientes',
        method: 'PATCH',
      },
    });
    expect(response.geocoding?.candidates?.[0]).toMatchObject({
      record_id: 42,
      address: 'Av. San Martin 123, Junin',
      category: 'limpieza',
      source: 'ticket',
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
