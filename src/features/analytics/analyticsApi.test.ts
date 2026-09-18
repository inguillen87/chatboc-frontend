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

const queueTruthFixture = () => ({
  contract_version: 'operations.queue_truth.v1',
  grain: 'one_current_open_ticket',
  source_models: ['TenantTicket', 'MunicipioTicket', 'PymeTicket'],
  as_of: '2026-08-02T14:30:00+00:00',
  membership_quality: {
    contract_version: 'operations.queue_membership_quality.v1',
    creation_membership: 'created_at_null_or_lte_as_of',
    null_created_at: { policy: 'included_with_unknown_age', included_records: 0 },
    future_created_at: {
      state: 'clean',
      policy: 'excluded_from_queue',
      excluded_records: 0,
      by_source_model: [
        { source_model: 'TenantTicket', excluded_records: 0 },
        { source_model: 'MunicipioTicket', excluded_records: 0 },
        { source_model: 'PymeTicket', excluded_records: 0 },
      ],
    },
  },
  coverage: {
    source_records: 9,
    source_models: [
      { source_model: 'TenantTicket', open_records: 5 },
      { source_model: 'MunicipioTicket', open_records: 3 },
      { source_model: 'PymeTicket', open_records: 1 },
    ],
    tenant_scope: 'authoritative',
    sla: { eligible: 9, known: 6, unknown: 3, non_eligible: 0, known_pct: 66.67 },
    age: { known: 9, unknown: 0, known_pct: 100 },
    ownership: { known: 9, unknown: 0, known_pct: 100 },
  },
  queue_snapshot: {
    grain: 'one_current_open_ticket',
    as_of: '2026-08-02T14:30:00+00:00',
    summary: {
      open_total: 9,
      oldest_open_age_seconds: 800000,
      sla_breached: 2,
      sla_at_risk: 1,
      sla_unknown: 3,
      assigned: 6,
      unassigned: 3,
    },
    sla: {
      eligible: 9,
      known: 6,
      unknown: 3,
      non_eligible: 0,
      breached: 2,
      at_risk: 1,
      healthy: 3,
      numerator: 2,
      denominator: 6,
      breach_rate_pct: 33.33,
      at_risk_window_seconds: 14400,
      state: 'partial',
      unknown_reason: 'missing_sla_evidence',
    },
    ownership: {
      assigned: 6,
      unassigned: 3,
      numerator: 6,
      denominator: 9,
      assignment_rate_pct: 66.67,
      by_owner: [
        {
          assignee_id: '12',
          count: 6,
          href: '/perfil?tab=tickets&focus=assigned_open_queue&agent=12',
          link_semantics: 'navigation_only',
          exact_filter: false,
        },
      ],
      unassigned_href: '/perfil?tab=tickets&focus=unassigned_open_queue&agent=unassigned',
    },
    age_buckets: [
      {
        key: 'lt_1h',
        label: 'Menos de 1 hora',
        count: 7,
        lower_bound_seconds: 0,
        upper_bound_seconds: 3600,
        href: '/perfil?tab=tickets&focus=open_age_lt_1h',
        link_semantics: 'navigation_only',
        exact_filter: false,
      },
      {
        key: 'gte_7d',
        label: '7 dias o mas',
        count: 2,
        lower_bound_seconds: 604800,
        upper_bound_seconds: null,
        href: '/perfil?tab=tickets&focus=open_age_gte_7d',
        link_semantics: 'navigation_only',
        exact_filter: false,
      },
    ],
    links: {
      open: '/perfil?tab=tickets&focus=open_queue',
      sla_breached: '/perfil?tab=tickets&focus=sla_breached_queue',
      sla_at_risk: '/perfil?tab=tickets&focus=sla_at_risk_queue',
      sla_unknown: '/perfil?tab=tickets&focus=sla_unknown_queue',
      unassigned: '/perfil?tab=tickets&focus=unassigned_open_queue&agent=unassigned',
    },
    link_contract: {
      open: { semantics: 'navigation_only', exact_filter: false },
      sla_breached: { semantics: 'navigation_only', exact_filter: false },
      sla_at_risk: { semantics: 'navigation_only', exact_filter: false },
      sla_unknown: { semantics: 'navigation_only', exact_filter: false },
      unassigned: { semantics: 'navigation_only', exact_filter: false },
      ownership_by_owner: { semantics: 'navigation_only', exact_filter: false },
      age_buckets: { semantics: 'navigation_only', exact_filter: false },
      reason_code: 'operational_queue_v1_not_yet_bound_to_queue_truth_snapshot',
      notice: 'Los drilldowns exactos están pendientes; estos contadores no abren filtros hasta vincular la bandeja al mismo corte y alcance.',
    },
  },
  period_flow: {
    grain: 'one_ticket_created_in_period',
    period: { from: '2026-07-26T14:30:00', to: '2026-08-02T14:30:00' },
    as_of: '2026-08-02T14:30:00+00:00',
    summary: { created_total: 4, currently_open: 3, currently_closed: 1 },
    by_source_model: [
      { source_model: 'TenantTicket', created_records: 2 },
      { source_model: 'MunicipioTicket', created_records: 1 },
      { source_model: 'PymeTicket', created_records: 1 },
    ],
    status_semantics: 'current_status_as_of_for_tickets_created_in_period',
    does_not_measure: ['tickets_closed_in_period', 'historical_backlog_snapshot'],
  },
});

describe('operations heatmap v2 contract', () => {
  beforeEach(() => {
    mocks.panelGet.mockReset();
  });

  it('passes segment filters and preserves declared zones and response provenance', async () => {
    mocks.panelGet.mockResolvedValue({
      contract_version: 'operations.heatmap.v1',
      privacy_metadata: {
        privacy_mode: 'tenant_aggregated',
        min_sample_size: '14',
        coordinate_precision_decimals: '3',
        suppressed: { records: '4', cells: '2', exact_points: true },
        rawPointsRedacted: 'true',
        coordinatePrecision: 'rounded_3_decimals',
        populationSource: 'INDEC 2022',
        boundary_source: 'Catastro Junín 2026',
      },
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
        zone: [{ key: 'centro', label: 'Centro', count: 4 }],
      },
      response_provenance: {
        contract_version: 'surveys.response_provenance.v1',
        mode: 'real',
        server_trusted_classification: 'true',
        contains_synthetic: 'false',
        real_responses_included: '3',
        synthetic_responses_included: '0',
        synthetic_responses_excluded: '2',
        unverified_responses_included: '0',
        unverified_responses_excluded: '1',
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
      location_quality: {
        contract_version: 'operations.location_quality.v1',
        total_ticket_records: '63',
        ticket_records_with_coordinates: '21',
        ticket_records_outside_jurisdiction: '2',
        ticket_records_pending_geocode: '34',
        coordinate_coverage_pct: '33.33',
        status: 'ready',
      },
      jurisdiction: {
        contract_version: 'operations.tenant_jurisdiction.v1',
        state: 'configured',
        enforced: 'true',
        city: 'Junín',
        state_name: 'Mendoza',
        excluded_coordinate_records: '2',
        review_candidate_count: '2',
        bounds: { west: '-68.6', south: '-33.3', east: '-68.3', north: '-32.9' },
        source: { kind: 'tenant_geo_config', ref: 'municipios/junin/geo.json' },
      },
      territorial_facets: {
        contract_version: 'operations.heatmap.territorial_facets.v1',
        summary: {
          ticket_records: '63',
          mapped_records: '21',
          records_outside_jurisdiction: '2',
          pending_geocode_records: '34',
        },
        categories: [
          {
            key: 'alumbrado',
            label: 'Alumbrado',
            count: '6',
            mapped_count: '4',
            pending_geocode_count: '1',
            outside_jurisdiction_count: '1',
          },
        ],
        addresses: [
          {
            key: 'don bosco 55',
            label: 'Don Bosco 55, Junín',
            count: '2',
            mapped_count: '1',
            outside_jurisdiction_count: '1',
          },
        ],
        explicit_zones: [],
      },
      jurisdiction_review: {
        contract_version: 'operations.heatmap.jurisdiction_review.v1',
        status: 'pending',
        candidate_count: '2',
        reason_code: 'coordinates_outside_configured_jurisdiction',
        writes_performed: 'false',
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
        territories: {
          type: 'FeatureCollection',
          metadata: { official: true, source: 'Catastro Junín 2026' },
          features: [
            {
              type: 'Feature',
              id: 'centro',
              geometry: {
                type: 'Polygon',
                coordinates: [[[-60.95, -34.62], [-60.9, -34.62], [-60.9, -34.57], [-60.95, -34.57], [-60.95, -34.62]]],
              },
              properties: { nombre: 'Centro', poblacion: 31400 },
            },
          ],
        },
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
            source_model: 'MunicipioTicket',
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
          id: 'municipio_ticket:10',
          record_source: 'municipio_ticket',
          lat: '-34.58',
          lng: '-60.94',
          weight: '2',
          categoria: 'alumbrado',
          genero: 'femenino',
          rango_edad: '35-44',
          canal: 'whatsapp',
          source: 'tickets',
          barrio: 'Centro',
          direccion: 'Don Bosco 55',
          addressCellLabel: 'Sector Centro A',
          cellId: 'h3:centro-a',
          geocode_quality: 'verified_gps',
          location_provenance: {
            coordinate: { source: 'whatsapp_location' },
          },
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
      zone: 'centro',
      estado: 'nuevo',
      sla_state: 'breached',
      assignee_id: 77,
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
    expect(url).toContain('zone=centro');
    expect(url).toContain('estado=nuevo');
    expect(url).toContain('sla_state=breached');
    expect(url).toContain('assignee_id=77');
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
      id: 'municipio_ticket:10',
      record_source: 'municipio_ticket',
      source_model: 'MunicipioTicket',
      ticket_id: '10',
      ticket_identity_status: 'valid',
      barrio: 'Centro',
      address: 'Don Bosco 55',
      direccion: 'Don Bosco 55',
      address_cell_label: 'Sector Centro A',
      cell_id: 'h3:centro-a',
      location_quality: 'verified_gps',
      location_provenance: 'whatsapp_location',
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
    expect(response.segments?.zone?.[0]).toMatchObject({ key: 'centro', label: 'Centro', count: 4 });
    expect(response.response_provenance).toMatchObject({
      contract_version: 'surveys.response_provenance.v1',
      mode: 'real',
      server_trusted_classification: true,
      contains_synthetic: false,
      real_responses_included: 3,
      synthetic_responses_excluded: 2,
      unverified_responses_excluded: 1,
    });
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
    expect(response.location_quality).toMatchObject({
      total_ticket_records: 63,
      ticket_records_with_coordinates: 21,
      ticket_records_outside_jurisdiction: 2,
      ticket_records_pending_geocode: 34,
      coordinate_coverage_pct: 33.33,
    });
    expect(response.jurisdiction).toMatchObject({
      enforced: true,
      city: 'Junín',
      state_name: 'Mendoza',
      excluded_coordinate_records: 2,
      review_candidate_count: 2,
    });
    expect(response.territorial_facets?.summary).toMatchObject({
      ticket_records: 63,
      mapped_records: 21,
      records_outside_jurisdiction: 2,
      pending_geocode_records: 34,
    });
    expect(response.territorial_facets?.categories?.[0]).toMatchObject({
      key: 'alumbrado',
      mapped_count: 4,
      pending_geocode_count: 1,
      outside_jurisdiction_count: 1,
    });
    expect(response.jurisdiction_review).toMatchObject({
      status: 'pending',
      candidate_count: 2,
      writes_performed: false,
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
    expect(response.geo_layers?.boundaries?.features).toHaveLength(1);
    expect(response.geo_layers).not.toHaveProperty('territories');
    expect(response.privacy).toEqual({
      mode: 'tenant_aggregated',
      aggregation: undefined,
      minimum_sample_size: 14,
      k_min: 14,
      raw_points_redacted: true,
      coordinate_precision: 'rounded_3_decimals',
      coordinate_precision_decimals: 3,
      suppressed: { records: '4', cells: '2', exact_points: true },
      population_source: 'INDEC 2022',
      boundaries_source: 'Catastro Junín 2026',
    });
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
      source_model: 'MunicipioTicket',
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
    const recentEvidenceAt = new Date(Date.now() - 5 * 60 * 1000)
      .toISOString()
      .replace('.000Z', 'Z');
    mocks.panelGet.mockResolvedValue({
      contract_version: 'ai.provider_status_public.v1',
      generated_at: '2026-06-27T12:00:00Z',
      secret_values_exposed: 'false',
      llm_provider_order: ['gemini', 'openai', null, 'huggingface'],
      readiness: {
        selected_chat_provider: 'openai',
        chat_runtime_configured: 'true',
        chat_ready: 'true',
        specialized_ai_runtime_configured: 'true',
        specialized_ai_ready: 'true',
        status: 'ready',
        warnings: ['huggingface_quota_or_payment_required', null],
      },
      providers: {
        gemini: {
          configured: 'true',
          runtime_configured: 'true',
          provider_order_enabled: 'true',
          chat_model: 'gemini-2.5-flash',
          base_url: 'https://secret.invalid/sk-provider-secret',
        },
        huggingface: {
          configured: 'true',
          enabled: 'true',
          runtime_configured: 'true',
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
      openai_suite: {
        contract_version: 'openai.suite_readiness.v1',
        status: 'live_verified',
        key_configured: 'true',
        runtime_configured: 'true',
        provider_verification: {
          status: 'live_verified',
          live_verified: 'true',
          live_verified_at: recentEvidenceAt,
          raw_error: '401 sk-provider-secret',
        },
        capability_evidence_available: 'true',
        reason_codes: ['capability_live_verification_missing', 'raw error sk-provider-secret'],
        capabilities: {
          chat_responses: {
            status: 'live_verified',
            runtime_configured: 'true',
            provider_live_verified: 'true',
            live_verified: 'true',
            live_verified_at: recentEvidenceAt,
            reason_codes: ['capability_live_verification_missing'],
            configuration_env: ['OPENAI_API_KEY', 'LLM_PROVIDER_ORDER', 'OPENAI_CHAT_MODEL_DEFAULT'],
          },
          vision: {
            status: 'live_verified',
            runtime_configured: 'true',
            provider_live_verified: 'true',
            live_verified: 'true',
            live_verified_at: recentEvidenceAt,
            reason_codes: ['capability_live_verification_missing', 'sk-provider-secret'],
            configuration_env: ['OPENAI_API_KEY', 'OPENAI_VISION_MODEL', 'SK_PROVIDER_SECRET'],
          },
        },
      },
      frontend_contract: {
        render_as: 'operations_ai_provider_status',
        advisory_only: true,
        tenant_scoped: true,
        access_tenant_scoped: true,
        configuration_scope: 'platform_runtime',
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
        selected_chat_provider: 'gemini',
        chat_runtime_configured: true,
        chat_ready: false,
        specialized_ai_runtime_configured: true,
        specialized_ai_ready: false,
        status: 'warning',
        warnings: [
          'huggingface_quota_or_payment_required',
          'chat_capability_live_verification_missing',
          'specialized_ai_live_verification_missing',
        ],
      },
      providers: {
        gemini: {
          provider: 'gemini',
          configured: true,
          runtime_configured: true,
          provider_order_enabled: true,
          chat_model: 'gemini-2.5-flash',
        },
        huggingface: {
          provider: 'huggingface',
          configured: true,
          enabled: true,
          runtime_configured: true,
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
      openai_suite: {
        status: 'partially_verified',
        key_configured: true,
        provider_verification: {
          status: 'live_verified',
          live_verified: true,
          live_verified_at: recentEvidenceAt,
        },
        capability_evidence_available: false,
        capabilities: {
          chat_responses: {
            status: 'unverified',
            runtime_configured: true,
            live_verified: false,
            live_verified_at: null,
          },
          vision: {
            status: 'unverified',
            runtime_configured: true,
            live_verified: false,
            live_verified_at: null,
            configuration_env: ['OPENAI_API_KEY', 'OPENAI_VISION_MODEL'],
            reason_codes: ['capability_live_verification_missing'],
          },
          realtime_voice: {
            status: 'blocked',
          },
        },
      },
      frontend_contract: {
        access_tenant_scoped: true,
        configuration_scope: 'platform_runtime',
      },
    });
    expect(response.providers.huggingface.last_failure).not.toHaveProperty('message');
    expect(response.providers.gemini).not.toHaveProperty('base_url');
    expect(response.frontend_contract).not.toHaveProperty('tenant_scoped');
    expect(JSON.stringify(response)).not.toContain('sk-provider-secret');
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
      commerce: {
        summary: { orders: 3, source_records: 4, deduplicated_mirrors: 1, total_monetary: 4000, currency: 'ARS' },
        by_source_model: [{ key: 'Order', label: 'Order', count: '2' }],
        totals_by_currency: [{ key: 'ARS', currency: 'ARS', amount: '4000', count: '3' }],
      },
      queue_truth: queueTruthFixture(),
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
    expect(response.commerce?.by_source_model).toEqual([{ key: 'Order', label: 'Order', count: 2 }]);
    expect(response.commerce?.totals_by_currency).toEqual([
      { key: 'ARS', label: 'ARS', currency: 'ARS', amount: 4000, count: 3 },
    ]);
    expect(response.queue_truth?.queue_snapshot?.summary).toMatchObject({
      open_total: 9,
      sla_unknown: 3,
    });
    expect(response.queue_truth?.period_flow?.grain).toBe('one_ticket_created_in_period');
    expect(response.queue_truth?.membership_quality?.future_created_at?.state).toBe('clean');
  });

  it('omits partial, contradictory or unsafe queue truth without dropping the dashboard', async () => {
    const partialQueueTruth = {
      contract_version: 'operations.queue_truth.v1',
      grain: 'one_current_open_ticket',
      as_of: '2026-08-02T14:30:00+00:00',
    };
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: partialQueueTruth,
    });

    const partialResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(partialResponse.queue_truth).toBeUndefined();
    expect(partialResponse.summary.open_tickets).toBe(7);

    const contradictoryQueueTruth = queueTruthFixture();
    contradictoryQueueTruth.queue_snapshot.summary.open_total = 10;
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: contradictoryQueueTruth,
    });

    const contradictoryResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(contradictoryResponse.queue_truth).toBeUndefined();
    expect(contradictoryResponse.summary.open_tickets).toBe(7);

    const unsafeQueueTruth = queueTruthFixture();
    unsafeQueueTruth.queue_snapshot.links.open = '//attacker.example/steal';
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: unsafeQueueTruth,
    });

    const unsafeResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(unsafeResponse.queue_truth).toBeUndefined();
    expect(unsafeResponse.summary.open_tickets).toBe(7);

    const semanticDriftQueueTruth = queueTruthFixture();
    semanticDriftQueueTruth.queue_snapshot.link_contract.unassigned = {
      semantics: 'exact_filter',
      exact_filter: true,
    };
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: semanticDriftQueueTruth,
    });

    const semanticDriftResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(semanticDriftResponse.queue_truth).toBeUndefined();
    expect(semanticDriftResponse.summary.open_tickets).toBe(7);

    const reasonCodeDriftQueueTruth = queueTruthFixture();
    reasonCodeDriftQueueTruth.queue_snapshot.link_contract.reason_code = 'unreviewed_filter_semantics';
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: reasonCodeDriftQueueTruth,
    });

    const reasonCodeDriftResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(reasonCodeDriftResponse.queue_truth).toBeUndefined();
    expect(reasonCodeDriftResponse.summary.open_tickets).toBe(7);

    const ownerLinkDriftQueueTruth = queueTruthFixture();
    ownerLinkDriftQueueTruth.queue_snapshot.ownership.by_owner[0].exact_filter = true;
    ownerLinkDriftQueueTruth.queue_snapshot.ownership.by_owner[0].link_semantics = 'exact_filter';
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: ownerLinkDriftQueueTruth,
    });

    const ownerLinkDriftResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(ownerLinkDriftResponse.queue_truth).toBeUndefined();
    expect(ownerLinkDriftResponse.summary.open_tickets).toBe(7);

    const missingNoticeQueueTruth = queueTruthFixture();
    missingNoticeQueueTruth.queue_snapshot.link_contract.notice = '   ';
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: missingNoticeQueueTruth,
    });

    const missingNoticeResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(missingNoticeResponse.queue_truth).toBeUndefined();
    expect(missingNoticeResponse.summary.open_tickets).toBe(7);

    const invalidMembershipQuality = queueTruthFixture();
    invalidMembershipQuality.membership_quality.future_created_at.excluded_records = 2;
    invalidMembershipQuality.membership_quality.future_created_at.state = 'quarantined';
    mocks.panelGet.mockResolvedValueOnce({
      contract_version: 'operations.dashboard.v1',
      summary: { open_tickets: 7 },
      alerts: [],
      next_best_actions: [],
      queue_truth: invalidMembershipQuality,
    });

    const invalidMembershipResponse = await getOperationsDashboardV2({ tenantSlug: 'junin' });

    expect(invalidMembershipResponse.queue_truth).toBeUndefined();
    expect(invalidMembershipResponse.summary.open_tickets).toBe(7);
  });
});
