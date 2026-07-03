import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OperationsAIOpsQueueV1,
  OperationsActionCenterV1,
  OperationsDashboardV1,
  OperationsFreshnessV1,
  OperationsHeatmapV1,
  PublicMapConfigV1,
} from './analyticsTypes';
import { OperationsDashboardPanel } from './OperationsDashboardPanel';

const mocks = vi.hoisted(() => ({
  getOperationsDashboardV2: vi.fn(),
  getOperationsHeatmapV2: vi.fn(),
  getOperationsActionCenterV2: vi.fn(),
  getOperationsAIBriefV2: vi.fn(),
  getOperationsAIOpsQueueV2: vi.fn(),
  getOperationsFreshnessV2: vi.fn(),
  getPublicMapConfigV1: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
  },
}));

vi.mock('./PremiumTerritoryMap', () => ({
  PremiumTerritoryHeatmap: ({ points, activeFilters }: { points: unknown[]; activeFilters?: Array<{ label: string; value: string }> }) => (
    <div data-testid="premium-territory-heatmap">
      premium map {points.length} puntos
      <span>
        {activeFilters?.length
          ? `filters: ${activeFilters.map((filter) => `${filter.label}=${filter.value}`).join(', ')}`
          : 'sin filtros'}
      </span>
    </div>
  ),
}));

vi.mock('./analyticsApi', () => ({
  getOperationsDashboardV2: mocks.getOperationsDashboardV2,
  getOperationsHeatmapV2: mocks.getOperationsHeatmapV2,
  getOperationsActionCenterV2: mocks.getOperationsActionCenterV2,
  getOperationsAIBriefV2: mocks.getOperationsAIBriefV2,
  getOperationsAIOpsQueueV2: mocks.getOperationsAIOpsQueueV2,
  getOperationsFreshnessV2: mocks.getOperationsFreshnessV2,
  getPublicMapConfigV1: mocks.getPublicMapConfigV1,
}));

const dashboardFixture = (): OperationsDashboardV1 => ({
  contract_version: 'operations.dashboard.v1',
  summary: {
    open_tickets: 12,
    survey_responses: 44,
    whatsapp_messages: 90,
    employees: 6,
    map_points: 2,
  },
  alerts: [],
  next_best_actions: [],
  tickets: {
    summary: { open_tickets: 12 },
    by_status: [{ key: 'nuevo', label: 'Nuevo', count: 8 }],
  },
  surveys: {
    summary: { responses: 44 },
  },
  chats: {
    summary: { whatsapp_messages: 90 },
  },
  employees: {
    summary: { employees: 6 },
  },
  frontend_contract: {
    primary_refresh_seconds: 60,
  },
});

const heatmapFixture = (overrides: Partial<OperationsHeatmapV1> = {}): OperationsHeatmapV1 => ({
  contract_version: 'operations.heatmap.v1',
  render_contract: {
    state: 'ready',
    layers: ['tickets', 'ai_risk'],
  },
  summary: {
    points: 2,
  },
  quality: {
    state: 'ready',
    label: 'Mapa operativo confiable',
    coverage_percent: 75,
    visible_points: 2,
    total_ticket_records: 8,
    ticket_records_with_coordinates: 6,
    ticket_records_without_coordinates: 2,
    pending_geocode: 1,
  },
  realtime: {
    poll_seconds: 20,
    latest_event_at: '2026-06-27T10:00:00Z',
    socket_events: ['ticket.updated'],
    sources: ['tickets', 'whatsapp'],
  },
  map_experience: {
    preferred_visualization: 'interactive_globe_heatmap',
    map_engines: ['maplibre', 'deckgl'],
    layer_groups: ['base_heatmap', 'ai_risk_layers', 'whatsapp_activity'],
    supports_reduced_motion: true,
  },
  geocoding: {
    status: 'pending',
    candidate_count: 1,
    candidates: [
      {
        record_id: 42,
        address: 'Av. San Martin 123, Junin',
        category: 'limpieza',
        source: 'ticket',
        reason_code: 'address_without_coordinates',
      },
    ],
    recommended_action: {
      title: 'Geocodificar direcciones pendientes',
      method: 'PATCH',
      endpoint: '/api/tickets/{record_id}/ubicacion',
    },
  },
  facets: [
    {
      key: 'categoria',
      field: 'categoria',
      query_param: 'categoria',
      label: 'Categoria',
      items: [{ key: 'alumbrado', label: 'Alumbrado', count: 2 }],
    },
    {
      key: 'canal',
      field: 'canal',
      query_param: 'canal',
      label: 'Canal',
      items: [{ key: 'whatsapp', label: 'WhatsApp', count: 2 }],
    },
  ],
  category_layers: [{ key: 'alumbrado', label: 'Alumbrado', count: 2 }],
  demographics: {
    source: 'real_metadata_only',
    gender: [{ key: 'femenino', label: 'Femenino', count: 1 }],
    age_ranges: [{ key: '35-44', label: '35-44', count: 2 }],
    known_gender_points: 1,
    unknown_gender_points: 1,
    known_age_points: 2,
    unknown_age_points: 0,
  },
  cells: [],
  hotspots: [],
  points: [
    {
      id: 1,
      lat: -34.58,
      lng: -60.94,
      weight: 2,
      layer: 'tickets',
      source: 'tickets',
      categoria: 'alumbrado',
      canal: 'whatsapp',
      genero: 'femenino',
      rango_edad: '35-44',
      barrio: 'Centro',
      estado: 'nuevo',
    },
    {
      id: 2,
      lat: -34.59,
      lng: -60.95,
      weight: 1,
      layer: 'ai_risk',
      source: 'ai_risk',
      categoria: 'alumbrado',
      canal: 'whatsapp',
      estado: 'en_proceso',
    },
  ],
  ...overrides,
});

const freshnessFixture = (): OperationsFreshnessV1 => ({
  status: 'fresh',
  summary: {
    fresh_sources: 4,
    stale_sources: 0,
    empty_sources: 0,
    can_render_dashboard: true,
    can_render_heatmap: true,
  },
  sources: [],
});

const actionCenterFixture = (): OperationsActionCenterV1 => ({
  items: [],
  alerts: [],
});

const aiOpsQueueFixture = (): OperationsAIOpsQueueV1 => ({
  contract_version: 'operations.ai_ops_queue.v1',
  enabled: true,
  agent_display_name: 'Valeria IA-Analytics',
  summary: {
    total: 3,
    high: 1,
    medium: 1,
    low: 1,
    advisory_only: true,
  },
  advisory_policy: {
    advisory_only: true,
    mutates_operational_state: false,
  },
  items: [
    {
      id: 'ticket:tenant_ticket:1',
      source: 'ticket',
      title: 'Reclamo requiere revision humana',
      priority: 'high',
      reason_codes: ['sla_overdue', 'citizen_or_customer_channel'],
      recommended_action: {
        label: 'Abrir caso',
        method: 'GET',
        endpoint: '/api/v2/tickets/1',
        href: '/t/junin/tickets?ticket_id=1&source=tenant_ticket',
      },
      signals: { category: 'alumbrado', channel: 'whatsapp' },
      pii: { redacted: true },
    },
    {
      id: 'order:pedido_conversacional:2',
      source: 'order',
      title: 'Pedido asistido requiere revision',
      priority: 'medium',
      reason_codes: ['unmatched_items'],
      recommended_action: {
        label: 'Revisar pedido',
        method: 'GET',
        endpoint: '/api/admin/tenants/junin/orders/2',
        href: '/t/junin/pedidos/2',
      },
      signals: { unmatched: 2, detected: 5 },
      pii: { redacted: true },
    },
    {
      id: 'survey:enc_encuesta:3',
      source: 'survey',
      title: 'Encuesta o votacion en monitoreo',
      priority: 'low',
      reason_codes: ['survey_live_monitoring'],
      recommended_action: {
        label: 'Ver analitica',
        method: 'GET',
        endpoint: '/api/v2/public/surveys/demo/live-results',
        href: '/admin/encuestas/3/analytics',
      },
      signals: { responses: 10 },
      pii: { redacted: true },
    },
  ],
});

const mapConfigFixture = (): PublicMapConfigV1 => ({
  provider: 'maplibre',
  available_providers: ['maplibre'],
});

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OperationsDashboardPanel />
    </QueryClientProvider>,
  );
};

describe('OperationsDashboardPanel territory UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOperationsDashboardV2.mockResolvedValue(dashboardFixture());
    mocks.getOperationsHeatmapV2.mockResolvedValue(heatmapFixture());
    mocks.getOperationsActionCenterV2.mockResolvedValue(actionCenterFixture());
    mocks.getOperationsAIBriefV2.mockResolvedValue(null);
    mocks.getOperationsAIOpsQueueV2.mockResolvedValue(aiOpsQueueFixture());
    mocks.getOperationsFreshnessV2.mockResolvedValue(freshnessFixture());
    mocks.getPublicMapConfigV1.mockResolvedValue(mapConfigFixture());
  });

  it('surfaces territorial quality, layers, filters and geocoding queue around the premium map', async () => {
    renderPanel();

    expect(await screen.findByTestId('operations-command-cockpit')).toBeTruthy();
    expect(screen.getByText('Cabina de mando')).toBeTruthy();
    expect(screen.getByText('Vista ejecutiva para operar ahora')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir bandeja de reclamos/i }).getAttribute('href')).toBe('/perfil?tab=tickets');
    expect(screen.getByRole('link', { name: /Ver mapa de calor/i }).getAttribute('href')).toBe('#operations-heatmap');
    expect(screen.getByRole('link', { name: /Revisar cola IA/i }).getAttribute('href')).toBe('#operations-ai-queue');
    expect(screen.getByRole('link', { name: /Ver encuestas/i }).getAttribute('href')).toBe('/perfil?tab=analytics&focus=surveys');
    expect(screen.getByTestId('operations-heatmap')).toBeTruthy();
    expect(screen.getByTestId('operations-ai-queue')).toBeTruthy();
    expect(await screen.findByText('Centro territorial')).toBeTruthy();
    expect(screen.getByText('Mapa operativo confiable')).toBeTruthy();
    expect(screen.getAllByText('75%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cola de geocodificacion')).toBeTruthy();
    expect(screen.getByText('1 pendiente')).toBeTruthy();
    expect(screen.getByText('Av. San Martin 123, Junin')).toBeTruthy();
    expect(screen.getByText('Geocodificar direcciones pendientes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tickets reclamos y casos/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Ai risk riesgo y prioridad IA/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('premium-territory-heatmap').textContent).toContain('premium map 2 puntos');

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'alumbrado' } });

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'junin',
          categoria: 'alumbrado',
        }),
      );
    });
    expect(await screen.findByRole('button', { name: /Quitar filtro Categoria Alumbrado/i })).toBeTruthy();
  });

  it('keeps the territorial section visible when the dedicated heatmap endpoint fails', async () => {
    mocks.getOperationsHeatmapV2.mockRejectedValue(new Error('heatmap offline'));

    renderPanel();

    expect(await screen.findByTestId('operations-command-cockpit')).toBeTruthy();
    expect(await screen.findByTestId('operations-heatmap')).toBeTruthy();
    expect(screen.getByText('Mapa temporalmente no disponible')).toBeTruthy();
    expect(screen.getByText('Reintento manual disponible')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar mapa/i })).toBeTruthy();
    expect(screen.getByTestId('operations-ai-queue')).toBeTruthy();
  });

  it('renders the AI operations queue for tickets, assisted orders and surveys', async () => {
    renderPanel();

    expect(await screen.findByText('Cola IA operativa')).toBeTruthy();
    expect(screen.getAllByText('Valeria IA-Analytics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('3 items')).toBeTruthy();
    expect(screen.getByText('1 alta')).toBeTruthy();
    expect(screen.getByText('solo lectura')).toBeTruthy();
    expect(screen.getByText('Reclamo requiere revision humana')).toBeTruthy();
    expect(screen.getByText('Pedido asistido requiere revision')).toBeTruthy();
    expect(screen.getByText('Encuesta o votacion en monitoreo')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir caso/i }).getAttribute('href')).toBe(
      '/t/junin/tickets?ticket_id=1&source=tenant_ticket',
    );
    expect(screen.getByRole('link', { name: /Revisar pedido/i }).getAttribute('href')).toBe('/t/junin/pedidos/2');
    expect(screen.getByRole('link', { name: /Ver analitica/i }).getAttribute('href')).toBe('/admin/encuestas/3/analytics');
    await waitFor(() => {
      expect(mocks.getOperationsAIOpsQueueV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'junin',
          limit: 12,
        }),
      );
    });
  });

  it('keeps a professional map empty state visible when coordinates are not renderable', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(
      heatmapFixture({
        render_contract: {
          state: 'empty',
          layers: ['tickets'],
        },
        points: [],
        summary: { points: 0 },
        quality: {
          state: 'empty',
          label: 'Sin coordenadas suficientes',
          coverage_percent: 0,
          visible_points: 0,
          pending_geocode: 4,
          ticket_records_without_coordinates: 4,
        },
        geocoding: {
          status: 'pending',
          candidate_count: 4,
          candidates: [],
        },
      }),
    );

    renderPanel();

    expect(await screen.findByText('Mapa sin puntos operativos')).toBeTruthy();
    expect(screen.getByText('4 direcciones pendientes de geocodificacion antes de mejorar la cobertura.')).toBeTruthy();
    expect(screen.getByText('4 pendientes')).toBeTruthy();
    expect(screen.queryByTestId('premium-territory-heatmap')).toBeNull();
  });

  it('blocks decorative rendering when render_contract marks heatmap as not renderable', async () => {
    mocks.getOperationsHeatmapV2.mockResolvedValue(
      heatmapFixture({
        render_contract: {
          state: 'ready',
          layers: ['tickets'],
          can_render_heatmap: false,
        },
        quality: {
          state: 'ready',
          label: 'Mapa operativo confiable',
          coverage_percent: 95,
          visible_points: 2,
          can_render_heatmap: true,
        },
      }),
    );

    renderPanel();

    expect(await screen.findByText('Mapa sin puntos operativos')).toBeTruthy();
    expect(screen.getByText('El backend marco el heatmap como no renderizable para este periodo.')).toBeTruthy();
    expect(screen.queryByTestId('premium-territory-heatmap')).toBeNull();
  });

  it('keeps an actionable territorial error state when the heatmap API fails', async () => {
    mocks.getOperationsHeatmapV2.mockRejectedValue(new Error('El servidor no pudo responder correctamente.'));

    renderPanel();

    expect(await screen.findByText('Centro territorial')).toBeTruthy();
    expect(screen.getByText('mapa en recuperacion')).toBeTruthy();
    expect(screen.getByText('Mapa temporalmente no disponible')).toBeTruthy();
    expect(screen.getByText('El servidor no pudo responder correctamente.')).toBeTruthy();
    expect(screen.getByText('Esperando heatmap operativo')).toBeTruthy();
    expect(screen.getByText('No se inventan puntos ni zonas hasta que backend publique coordenadas confiables.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar mapa/i })).toBeTruthy();
    expect(screen.queryByTestId('premium-territory-heatmap')).toBeNull();
  });
});
