import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OperationsAIOpsQueueV1,
  OperationsAIProviderStatusV1,
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
  getOperationsAIProviderStatusV2: vi.fn(),
  getOperationsFreshnessV2: vi.fn(),
  getPublicMapConfigV1: vi.fn(),
}));

const socketMocks = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload?: unknown) => void>>();
  return {
    handlers,
    socket: {
      on: vi.fn((eventName: string, handler: (payload?: unknown) => void) => {
        const current = handlers.get(eventName) ?? new Set<(payload?: unknown) => void>();
        current.add(handler);
        handlers.set(eventName, current);
      }),
      off: vi.fn((eventName: string, handler: (payload?: unknown) => void) => {
        const current = handlers.get(eventName);
        current?.delete(handler);
      }),
    },
    emit: (eventName: string, payload?: unknown) => {
      handlers.get(eventName)?.forEach((handler) => handler(payload));
    },
    reset: () => {
      handlers.clear();
    },
  };
});

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: socketMocks.socket, isConnected: true }),
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
  },
}));

vi.mock('./PremiumTerritoryMap', () => ({
  PremiumTerritoryHeatmap: ({
    points,
    activeFilters,
    heatmap,
    labels,
  }: {
    points: unknown[];
    activeFilters?: Array<{ label: string; value: string }>;
    heatmap?: { contract_version?: string };
    labels?: Record<string, string>;
  }) => (
    <div data-testid="premium-territory-heatmap" data-contract={heatmap?.contract_version ?? ''}>
      premium map {points.length} puntos
      <span>{labels?.premium_heatmap_title ?? ''}</span>
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
  getOperationsAIProviderStatusV2: mocks.getOperationsAIProviderStatusV2,
  getOperationsFreshnessV2: mocks.getOperationsFreshnessV2,
  getPublicMapConfigV1: mocks.getPublicMapConfigV1,
}));

const dashboardFixture = (): OperationsDashboardV1 => ({
  contract_version: 'operations.dashboard.v1',
  summary: {
    open_tickets: 12,
    survey_responses: 44,
    whatsapp_messages: 90,
    assisted_orders: 2,
    orders_needing_review: 1,
    unmatched_order_items: 3,
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
  commerce: {
    contract_version: 'operations.commerce.v1',
    summary: {
      orders: 4,
      source_records: 5,
      deduplicated_mirrors: 1,
      assisted_orders: 2,
      orders_needing_review: 1,
      unmatched_items: 3,
      total_monetary: 52500,
      currency: 'ARS',
      currencies: 1,
    },
    by_origin: [{ key: 'marketplace_upload', label: 'marketplace_upload', count: 2 }],
    by_source_model: [
      { key: 'Order', label: 'Order', count: 2 },
      { key: 'PedidoConversacional', label: 'PedidoConversacional', count: 2 },
    ],
    by_request_kind: [{ key: 'order_note', label: 'order_note', count: 2 }],
    totals_by_currency: [{ key: 'ARS', label: 'ARS', currency: 'ARS', amount: 52500, count: 4 }],
    review_items: [
      {
        id: 'assisted_order:2',
        title: 'Pedido asistido requiere revision',
        priority: 'high',
        origin: 'marketplace_upload',
        detected: 5,
        matched: 2,
        unmatched: 3,
        frontend_path: '/perfil?tab=pedidos&order_id=conversational%3A2&focus=assisted_order_queue',
      },
    ],
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
  ai_status: {
    contract_version: 'operations.heatmap_ai_status.v1',
    provider_family: 'huggingface',
    mode: 'municipal_risk_detection',
    status: 'local_fallback',
    configured: true,
    zero_shot_enabled: true,
    used_hf: false,
    safe_to_render_without_hf_token: true,
    ai_layers_ready: true,
    map_layer_hints: ['ai_risk_pulses', 'whatsapp_activity', 'survey_participation'],
  },
  ai_layers: {
    contract_version: 'huggingface.map_ai_layers.v1',
    provider_family: 'huggingface',
    status: 'ready',
    mode: 'map_ai_layers',
    layers: [
      { key: 'risk_pulses', label: 'Pulsos de riesgo IA', count: 1 },
      { key: 'whatsapp_activity', label: 'Actividad WhatsApp', count: 2 },
    ],
    recommendations: [{ id: 'open_ai_summary', label: 'Mantener monitoreo IA', priority: 'low' }],
    frontend_contract: {
      advisory_only: true,
      map_engines: ['maplibre', 'deckgl'],
      layer_groups: ['ai_risk_layers', 'whatsapp_activity'],
    },
  },
  ai_insights: {
    contract_version: 'huggingface.ai_insights.v1',
    provider_family: 'huggingface',
    mode: 'deterministic_local_fallback',
    domain: 'operations',
    hf_status: {
      configured: true,
      zero_shot_enabled: true,
      used: false,
      fallback_reason: 'zero_shot_disabled_or_unavailable',
    },
    advisory_policy: {
      mutates_operational_state: false,
    },
    summary: {
      dominant_intent: 'public_service_claim',
      dominant_intent_label: 'reclamo de servicio publico',
      risk_level: 'high',
      risk_signal: 'high_priority',
      sentiment: 'neutral',
      requires_human_attention: true,
    },
    collection: {
      items_analyzed: 8,
      text_items_analyzed: 7,
    },
    recommended_actions: [
      { id: 'open_human_review_queue', label: 'Revisar conversaciones con riesgo', priority: 'high' },
      { id: 'request_or_validate_location', label: 'Validar ubicaciones exactas', priority: 'medium' },
    ],
    frontend_contract: {
      advisory_only: true,
      safe_to_render_without_hf_token: true,
    },
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

const aiProviderStatusFixture = (): OperationsAIProviderStatusV1 => ({
  contract_version: 'ai.provider_status_public.v1',
  generated_at: '2026-06-27T12:00:00Z',
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
    openai: {
      provider: 'openai',
      configured: true,
      chat_default: true,
    },
    huggingface: {
      provider: 'huggingface',
      configured: true,
      enabled: true,
      runtime_status: 'degraded',
      quota_depleted: true,
      fallback_behavior: 'deterministic_local_fallback',
      last_failure: {
        reason_code: 'huggingface_quota_or_payment_required',
        task: 'zero_shot',
        error_type: 'RuntimeError',
      },
    },
  },
  model_policy: {
    task_type: 'analytics',
    primary_provider: 'gemini',
    selected_provider: 'fallback',
  },
  frontend_contract: {
    render_as: 'operations_ai_provider_status',
    advisory_only: true,
  },
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
    socketMocks.reset();
    mocks.getOperationsDashboardV2.mockResolvedValue(dashboardFixture());
    mocks.getOperationsHeatmapV2.mockResolvedValue(heatmapFixture());
    mocks.getOperationsActionCenterV2.mockResolvedValue(actionCenterFixture());
    mocks.getOperationsAIBriefV2.mockResolvedValue(null);
    mocks.getOperationsAIOpsQueueV2.mockResolvedValue(aiOpsQueueFixture());
    mocks.getOperationsAIProviderStatusV2.mockResolvedValue(aiProviderStatusFixture());
    mocks.getOperationsFreshnessV2.mockResolvedValue(freshnessFixture());
    mocks.getPublicMapConfigV1.mockResolvedValue(mapConfigFixture());
  });

  it('surfaces territorial quality, layers, filters and geocoding queue around the premium map', async () => {
    renderPanel();

    expect(await screen.findByTestId('operations-command-cockpit')).toBeTruthy();
    expect(screen.getByText('Cabina de mando')).toBeTruthy();
    expect(screen.getByText('Vista ejecutiva para operar ahora')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir bandeja de reclamos/i }).getAttribute('href')).toBe('/perfil?tab=tickets');
    expect(screen.getByRole('link', { name: /Abrir pedidos asistidos/i }).getAttribute('href')).toBe('/perfil?tab=orders&focus=assisted');
    expect(screen.getByRole('link', { name: /Ver mapa de calor/i }).getAttribute('href')).toBe('#operations-heatmap');
    expect(screen.getByRole('link', { name: /Revisar cola IA/i }).getAttribute('href')).toBe('#operations-ai-queue');
    expect(screen.getByRole('link', { name: /Ver encuestas/i }).getAttribute('href')).toBe('/perfil?tab=analytics&focus=surveys');
    expect(screen.getByTestId('operations-heatmap')).toBeTruthy();
    expect(screen.getByTestId('operations-ai-queue')).toBeTruthy();
    const commercePanel = screen.getByTestId('operations-commerce');
    expect(commercePanel).toHaveTextContent('Pedidos y ventas');
    expect(commercePanel).toHaveTextContent('1 a revisar');
    expect(commercePanel).toHaveTextContent('1 espejo unificado');
    expect(commercePanel).toHaveTextContent('52.500');
    expect(commercePanel).toHaveTextContent('Pedidos asistidos 2');
    expect(commercePanel).toHaveTextContent('Pedido asistido requiere revision');
    expect(commercePanel).toHaveTextContent('5 detectados');
    expect(commercePanel).toHaveTextContent('3 sin resolver');
    expect(commercePanel.querySelector('a')?.getAttribute('href')).toBe(
      '/perfil?tab=pedidos&order_id=conversational%3A2&focus=assisted_order_queue',
    );
    expect(await screen.findByText('Centro territorial')).toBeTruthy();
    const decisionBrief = screen.getByTestId('territorial-decision-brief');
    expect(decisionBrief).toHaveTextContent('Mesa territorial inteligente');
    expect(decisionBrief).toHaveTextContent('Donde actuar, por que y con que prioridad');
    expect(decisionBrief).toHaveTextContent('Prioridad territorial');
    expect(decisionBrief).toHaveTextContent('Lectura IA');
    expect(decisionBrief).toHaveTextContent('Que hacer ahora');
    expect(decisionBrief).toHaveTextContent('Alumbrado');
    expect(decisionBrief).toHaveTextContent('High');
    expect(decisionBrief).toHaveTextContent('Revisar conversaciones con riesgo');
    const aiCockpit = screen.getByTestId('territorial-ai-cockpit');
    expect(aiCockpit).toBeTruthy();
    expect(aiCockpit.textContent).toContain('IA territorial');
    expect(aiCockpit.textContent).toContain('fallback local');
    expect(aiCockpit.textContent).toContain('Huggingface');
    expect(aiCockpit.textContent).toContain('Reclamo de servicio publico');
    expect(aiCockpit.textContent).toContain('High');
    expect(aiCockpit.textContent).toContain('8');
    expect(aiCockpit.textContent).toContain('Revisar conversaciones con riesgo');
    expect(aiCockpit.textContent).toContain('Validar ubicaciones exactas');
    expect(aiCockpit.textContent).toContain('Pulsos de riesgo IA');
    expect(screen.getByText('Mapa operativo confiable')).toBeTruthy();
    expect(screen.getAllByText('75%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cola de geocodificación')).toBeTruthy();
    expect(screen.getByText('1 pendiente')).toBeTruthy();
    expect(screen.getByText('Av. San Martin 123, Junin')).toBeTruthy();
    expect(screen.getByText('Geocodificar direcciones pendientes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tickets reclamos y casos/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Ai risk riesgo y prioridad IA/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('premium-territory-heatmap').textContent).toContain('premium map 2 puntos');

    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'alumbrado' } });

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'junin',
          include_ai: 0,
          categoria: 'alumbrado',
        }),
      );
    });
    expect(await screen.findByRole('button', { name: /Quitar filtro Categoría Alumbrado/i })).toBeTruthy();
  });

  it('uses the fastest live contract interval for operational refreshes', async () => {
    const intervalSpy = vi.spyOn(window, 'setInterval');

    try {
      renderPanel();

      expect(await screen.findByText('Centro territorial')).toBeTruthy();
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 20_000);
    } finally {
      intervalSpy.mockRestore();
    }
  });

  it('refreshes operational analytics immediately when a realtime heatmap event arrives', async () => {
    renderPanel();

    expect(await screen.findByText('Centro territorial')).toBeTruthy();
    const initialHeatmapCalls = mocks.getOperationsHeatmapV2.mock.calls.length;
    const initialDashboardCalls = mocks.getOperationsDashboardV2.mock.calls.length;
    expect(socketMocks.socket.on).toHaveBeenCalledWith('ticket.updated', expect.any(Function));

    socketMocks.emit('ticket.updated', {
      tenant_slug: 'junin',
      payload: { ticket_id: 'M-378430' },
    });

    await waitFor(() => {
      expect(mocks.getOperationsHeatmapV2.mock.calls.length).toBeGreaterThan(initialHeatmapCalls);
      expect(mocks.getOperationsDashboardV2.mock.calls.length).toBeGreaterThan(initialDashboardCalls);
    });
  });

  it('ignores realtime operations events scoped to another tenant', async () => {
    renderPanel();

    expect(await screen.findByText('Centro territorial')).toBeTruthy();
    const initialHeatmapCalls = mocks.getOperationsHeatmapV2.mock.calls.length;

    socketMocks.emit('ticket.updated', {
      tenant_slug: 'otro-tenant',
      payload: { ticket_id: 'M-000001' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.getOperationsHeatmapV2.mock.calls.length).toBe(initialHeatmapCalls);
  });

  it('keeps the territorial section visible when the dedicated heatmap endpoint fails', async () => {
    mocks.getOperationsHeatmapV2.mockRejectedValue(new Error('heatmap offline'));

    renderPanel();

    expect(await screen.findByTestId('operations-command-cockpit')).toBeTruthy();
    expect(await screen.findByTestId('operations-heatmap')).toBeTruthy();
    expect(screen.getByText('Mapa temporalmente no disponible')).toBeTruthy();
    expect(screen.getByText('Reintento manual disponible')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar mapa/i })).toBeTruthy();
    const recoveryMap = screen.getByTestId('premium-territory-heatmap');
    expect(recoveryMap.getAttribute('data-contract')).toBe('operations.heatmap.recovery.v1');
    expect(recoveryMap.textContent).toContain('premium map 0 puntos');
    expect(recoveryMap.textContent).toContain('Mapa territorial en recuperacion');
    expect(screen.getByTestId('operations-ai-queue')).toBeTruthy();
  });

  it('keeps the cockpit, map and AI queue usable when the main dashboard summary times out', async () => {
    mocks.getOperationsDashboardV2.mockRejectedValue(new Error('operations_dashboard_timeout'));

    renderPanel();

    expect(await screen.findByTestId('operations-dashboard-degraded')).toBeTruthy();
    expect(screen.getByText('Tablero en continuidad operativa')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Refrescar resumen/i })).toBeTruthy();
    expect(screen.getByTestId('operations-command-cockpit')).toBeTruthy();
    expect(screen.getByTestId('operations-heatmap')).toBeTruthy();
    expect(screen.getByText('Centro territorial')).toBeTruthy();
    expect(screen.getByTestId('operations-ai-queue')).toBeTruthy();
    expect(screen.getByText('continuidad activa')).toBeTruthy();
  });

  it('renders the AI operations queue for tickets, assisted orders and surveys', async () => {
    renderPanel();

    expect(await screen.findByText('Cola IA operativa')).toBeTruthy();
    expect(screen.getAllByText('Valeria IA-Analytics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('3 items')).toBeTruthy();
    expect(screen.getByText('1 alta')).toBeTruthy();
    expect(screen.getAllByText('solo lectura').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reclamo requiere revision humana')).toBeTruthy();
    expect(screen.getAllByText('Pedido asistido requiere revision').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Encuesta o votacion en monitoreo')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir caso/i }).getAttribute('href')).toBe(
      '/t/junin/tickets?ticket_id=1&source=tenant_ticket',
    );
    expect(screen.getByRole('link', { name: /Revisar pedido/i }).getAttribute('href')).toBe('/t/junin/pedidos/2');
    expect(screen.getByRole('link', { name: /Ver analitica/i }).getAttribute('href')).toBe('/admin/encuestas/3/analytics?focus=live');
    await waitFor(() => {
      expect(mocks.getOperationsAIOpsQueueV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'junin',
          limit: 12,
        }),
      );
    });
  });

  it('renders tenant scoped AI provider status without exposing internals', async () => {
    renderPanel();

    const panel = await screen.findByTestId('operations-ai-provider-status');
    expect(panel.textContent).toContain('IA operacional');
    expect(panel.textContent).toContain('Gemini');
    expect(panel.textContent).toContain('Hugging Face');
    expect(panel.textContent).toContain('chat listo');
    expect(panel.textContent).toContain('IA especializada degradada');
    expect(panel.textContent).toContain('solo lectura');
    expect(panel.textContent).toContain('Fallback local seguro');
    expect(panel.textContent).toContain('deterministic local fallback');
    expect(panel.textContent).toContain('huggingface quota or payment required');
    expect(panel.textContent).not.toContain('sk-');
    expect(panel.textContent).not.toContain('hf_');
    await waitFor(() => {
      expect(mocks.getOperationsAIProviderStatusV2).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantSlug: 'junin',
        }),
      );
    });
  });

  it('keeps provider status as a recoverable card when the endpoint fails', async () => {
    mocks.getOperationsAIProviderStatusV2.mockRejectedValue(new Error('operations_ai_provider_status_timeout'));

    renderPanel();

    const panel = await screen.findByTestId('operations-ai-provider-status');
    expect(panel.textContent).toContain('Estado IA no disponible');
    expect(panel.textContent).toContain('fallback seguro');
    expect(screen.getByTestId('operations-ai-queue')).toBeTruthy();
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
    expect(screen.getByText('4 direcciones pendientes de geocodificación antes de mejorar la cobertura.')).toBeTruthy();
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
    expect(screen.getByText('El backend marcó el heatmap como no renderizable para este periodo.')).toBeTruthy();
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
    const recoveryMap = screen.getByTestId('premium-territory-heatmap');
    expect(recoveryMap.getAttribute('data-contract')).toBe('operations.heatmap.recovery.v1');
    expect(recoveryMap.textContent).toContain('premium map 0 puntos');
  });
});
