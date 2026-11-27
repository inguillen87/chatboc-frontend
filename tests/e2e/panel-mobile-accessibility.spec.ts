import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const CAPTURE_DIR = process.env.CORTE15_CAPTURE_DIR?.trim() || '';
const maybeCapture = async (page: Page, filename: string) => {
  if (!CAPTURE_DIR) return;
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(CAPTURE_DIR, filename), fullPage: false });
};

const TENANT_SLUG = 'municipio-demo';
const TENANT_ID = 22;
const TICKET_ID = 101;
const SURVEY_ID = 301;
const SURVEY_SLUG = 'prioridades-barriales-2026';

const VIEWPORTS = [
  { name: '390px', width: 390, height: 844, isMobile: true },
  { name: '1440px', width: 1440, height: 900, isMobile: false },
] as const;

const THEMES = ['light', 'dark'] as const;

type ThemeMode = (typeof THEMES)[number];

const ADMIN_USER = {
  id: 'panel-a11y-admin',
  name: 'Coordinación Operativa',
  nombre: 'Coordinación Operativa',
  email: 'panel-a11y@example.com',
  nombre_empresa: 'Municipio Demo',
  plan: 'pro',
  rol: 'tenant_admin',
  role: 'tenant_admin',
  tipo_chat: 'municipio',
  rubro: 'municipio',
  permissions: [
    'tickets.read',
    'tickets.write',
    'tickets.assign',
    'analytics.read',
    'surveys.read',
    'surveys.write',
    'market.orders.read',
  ],
  capabilities: [
    'tickets.read',
    'tickets.write',
    'tickets.assign',
    'analytics.read',
    'surveys.read',
    'surveys.write',
    'market.orders.read',
  ],
  tenantSlug: TENANT_SLUG,
  tenant_slug: TENANT_SLUG,
  tenant_id: TENANT_ID,
  tenant: {
    id: TENANT_ID,
    slug: TENANT_SLUG,
    tenant_slug: TENANT_SLUG,
    nombre: 'Municipio Demo',
    tipo: 'municipio',
    plan: 'pro',
  },
};

const TICKETS_FIXTURE = [
  {
    id: TICKET_ID,
    nro_ticket: `M-${TICKET_ID}`,
    asunto: 'Luminaria apagada en avenida San Martín al 1200',
    descripcion: 'Hace tres noches la cuadra quedó a oscuras frente a la escuela primaria y la parada de colectivos.',
    estado: 'en_proceso',
    fecha: '2026-07-10T10:00:00Z',
    tipo: 'municipio',
    ticket_type: 'municipio',
    source_model: 'Reclamo',
    tenant_slug: TENANT_SLUG,
    categoria: 'Alumbrado público',
    channel: 'whatsapp',
    display_name: 'María Laura Gómez',
    name: 'María Laura Gómez',
    telefono: '+5492364000101',
    email: 'vecina101@example.com',
    direccion: 'Av. San Martín 1210, Barrio Centro',
    priority: 'alta',
    sla_status: 'risk',
    sla_state: 'at_risk',
    sla_due_at: '2026-07-10T14:00:00Z',
    hasUnreadMessages: true,
    collaboration_state: {
      has_unread: true,
      unread_count: 2,
      unread_viewer_count: 0,
    },
    allowed_actions: [
      {
        id: 'coordinate_inspection',
        label: 'Coordinar cuadrilla de alumbrado',
        href: `/t/${TENANT_SLUG}/reclamos?ticket_id=${TICKET_ID}`,
        enabled: true,
      },
    ],
  },
  {
    id: TICKET_ID + 1,
    nro_ticket: `M-${TICKET_ID + 1}`,
    asunto: 'Pérdida de agua potable en esquina Rivadavia y Roque Sáenz Peña',
    descripcion: 'Pérdida constante en vereda sur que impide cruzar a pie.',
    estado: 'nuevo',
    fecha: '2026-07-10T09:15:00Z',
    tipo: 'municipio',
    ticket_type: 'municipio',
    source_model: 'Reclamo',
    tenant_slug: TENANT_SLUG,
    categoria: 'Agua y cloacas',
    channel: 'whatsapp',
    display_name: 'Carlos Pereyra',
    name: 'Carlos Pereyra',
    telefono: '+5492364000102',
    direccion: 'Rivadavia 450, Barrio Pueblo Nuevo',
    priority: 'urgente',
    sla_status: 'overdue',
    sla_state: 'breached',
    sla_due_at: '2026-07-10T08:00:00Z',
    hasUnreadMessages: true,
    collaboration_state: {
      has_unread: true,
      unread_count: 1,
      unread_viewer_count: 0,
    },
  },
  {
    id: TICKET_ID + 2,
    nro_ticket: `M-${TICKET_ID + 2}`,
    asunto: 'Recolección de ramas y poda en calle Borges',
    descripcion: 'Quedaron restos de poda en la esquina luego de la tormenta.',
    estado: 'resuelto',
    fecha: '2026-07-09T16:30:00Z',
    tipo: 'municipio',
    ticket_type: 'municipio',
    source_model: 'Reclamo',
    tenant_slug: TENANT_SLUG,
    categoria: 'Espacios verdes',
    channel: 'web',
    display_name: 'Sofía Martínez',
    name: 'Sofía Martínez',
    telefono: '+5492364000103',
    direccion: 'Borges 88, Barrio Belgrano',
    priority: 'normal',
    sla_status: 'on_track',
    sla_state: 'on_track',
    hasUnreadMessages: false,
    collaboration_state: {
      has_unread: false,
      unread_count: 0,
      unread_viewer_count: 0,
    },
  },
];

const TICKET_TIMELINE = [
  {
    id: 'msg-1',
    comentario: 'Hola, la luminaria frente a la escuela está apagada desde el lunes.',
    fecha: '2026-07-10T10:05:00Z',
    es_admin: false,
  },
  {
    id: 'msg-2',
    comentario: 'Gracias por avisarnos. Derivamos el reclamo a la cuadrilla de alumbrado.',
    fecha: '2026-07-10T10:12:00Z',
    es_admin: true,
  },
  {
    id: 'msg-3',
    comentario: '¿Tienen horario estimado para pasar por la cuadra?',
    fecha: '2026-07-10T10:25:00Z',
    es_admin: false,
  },
];

const SURVEY_SCOPE_COMPATIBLE = {
  contract_version: 'surveys.admin_scope.v1',
  jurisdiction: {
    contract_version: 'surveys.admin_jurisdiction_scope.v1',
    status: 'compatible',
    compatible: true,
    reason_code: 'survey_jurisdiction_compatible',
    action_hint: null,
    tenant_verified_ref: 'ar:ba:municipio-demo',
    survey_ref: 'ar:ba:municipio-demo',
    authoritative_source: 'server_owned_persisted_refs',
    content_review_included: false,
  },
  separation: { required: false, reason_code: null },
};

const buildSurveyLifecycle = (
  surveyId: number,
  phase: 'collecting' | 'draft' | 'closed',
  kind: 'survey' | 'voting' = 'survey',
) => ({
  contract_version: 'surveys.admin_lifecycle.v1',
  instrument_kind: kind,
  phase,
  persisted_state: phase === 'draft' ? 'borrador' : phase === 'closed' ? 'cerrada' : 'publicada',
  accepts_responses: phase === 'collecting',
  operational_block: null,
  jurisdiction: {
    status: 'compatible',
    reason_code: 'survey_jurisdiction_compatible',
    content_review_included: false,
  },
  government_survey_evidence_gate: {
    contract_version: 'surveys.government_evidence_gate.v1',
    required: true,
    ready: true,
    reason_code: 'survey_government_evidence_ready',
    next_action: null,
  },
  schedule: {
    opens_at: '2026-01-01T00:00:00Z',
    closes_at: '2026-12-31T23:59:59Z',
    evaluated_at: '2026-07-10T12:00:00Z',
  },
  participation: {
    responses: phase === 'draft' ? 0 : 124,
    unique_participants: phase === 'draft' ? 0 : 118,
    responses_last_24h: phase === 'collecting' ? 19 : 0,
    last_response_at: phase === 'draft' ? null : '2026-07-10T11:40:00Z',
    eligible_population: null,
    participation_rate: null,
    abstentions: null,
    denominator_status: { available: false, reason_code: 'survey_eligible_population_not_configured' },
  },
  capabilities: {
    can_publish: phase === 'draft',
    can_close: phase === 'collecting',
    can_delete: phase === 'draft',
    can_share: phase === 'collecting',
    can_view_results: true,
  },
  actions: {
    publish: {
      method: 'POST',
      endpoint: `/api/v2/surveys/${surveyId}/publish`,
      enabled: phase === 'draft',
      disabled_reason_code: phase === 'draft' ? null : 'survey_already_published',
    },
    close: {
      method: 'POST',
      endpoint: `/api/v2/surveys/${surveyId}/close`,
      enabled: phase === 'collecting',
      confirmation_required: true,
      irreversible: true,
      required_capabilities: ['survey.close'],
      disabled_reason_code: phase === 'collecting' ? null : 'survey_not_published',
    },
  },
});

const SURVEYS_FIXTURE = [
  {
    id: SURVEY_ID,
    tenant_id: TENANT_ID,
    tenant_slug: TENANT_SLUG,
    slug: SURVEY_SLUG,
    slug_publico: SURVEY_SLUG,
    canonical_slug: SURVEY_SLUG,
    titulo: 'Prioridades barriales 2026',
    descripcion: 'Consulta ciudadana para priorizar obras de alumbrado, veredas y espacios verdes.',
    tipo: 'votacion',
    estado: 'publicada',
    esta_activa: true,
    es_votacion_envivo: true,
    mostrar_resultados_envivo: true,
    permitir_comentarios: true,
    inicio_at: '2026-01-01T00:00:00Z',
    fin_at: '2026-12-31T23:59:59Z',
    politica_unicidad: 'libre',
    anonimo_permitido: true,
    requiere_datos_contacto: false,
    structure_guard: { locked: true, reason: 'survey_has_responses' },
    metricas: {
      total_respuestas: 124,
      participantes_unicos: 118,
      respuestas_con_coordenadas: 86,
      respuestas_ultimas_24h: 19,
    },
    preguntas: [
      {
        id: 1001,
        orden: 1,
        tipo: 'opcion_unica',
        texto: '¿Qué obra debería ejecutarse primero en tu barrio?',
        obligatoria: true,
        opciones: [
          { id: 1, orden: 1, texto: 'Alumbrado LED en corredores escolares' },
          { id: 2, orden: 2, texto: 'Reparación de veredas y rampas accesibles' },
          { id: 3, orden: 3, texto: 'Plazas y juegos inclusivos' },
        ],
      },
      {
        id: 1002,
        orden: 2,
        tipo: 'texto_libre',
        texto: '¿Qué calle o esquina necesita atención urgente?',
        obligatoria: false,
        opciones: [],
      },
    ],
    admin_scope: SURVEY_SCOPE_COMPATIBLE,
    admin_lifecycle: buildSurveyLifecycle(SURVEY_ID, 'collecting', 'voting'),
    public_access: {
      contract_version: 'surveys.public_access.v1',
      allowed: true,
      reason_code: null,
      next_action: null,
    },
  },
  {
    id: SURVEY_ID + 1,
    tenant_id: TENANT_ID,
    tenant_slug: TENANT_SLUG,
    slug: 'transporte-nocturno-borrador',
    slug_publico: 'transporte-nocturno-borrador',
    canonical_slug: 'transporte-nocturno-borrador',
    titulo: 'Frecuencias de transporte nocturno',
    descripcion: 'Borrador en preparación para validar horarios de colectivos.',
    tipo: 'opinion',
    estado: 'borrador',
    esta_activa: false,
    es_votacion_envivo: false,
    mostrar_resultados_envivo: false,
    permitir_comentarios: true,
    inicio_at: null,
    fin_at: null,
    politica_unicidad: 'libre',
    anonimo_permitido: true,
    metricas: {
      total_respuestas: 0,
      participantes_unicos: 0,
      respuestas_con_coordenadas: 0,
      respuestas_ultimas_24h: 0,
    },
    preguntas: [
      {
        id: 1003,
        orden: 1,
        tipo: 'opcion_unica',
        texto: '¿En qué franja horaria necesitás más frecuencia?',
        obligatoria: true,
        opciones: [
          { id: 4, orden: 1, texto: '21:00 a 23:00' },
          { id: 5, orden: 2, texto: '23:00 a 01:00' },
        ],
      },
    ],
    admin_scope: SURVEY_SCOPE_COMPATIBLE,
    admin_lifecycle: buildSurveyLifecycle(SURVEY_ID + 1, 'draft', 'survey'),
  },
];

const OPERATIONS_DASHBOARD_FIXTURE = {
  contract_version: 'operations.dashboard.v1',
  tenant: { slug: TENANT_SLUG, id: TENANT_ID },
  summary: {
    open_tickets: 18,
    survey_responses: 124,
    whatsapp_messages: 312,
    assisted_orders: 4,
    orders_needing_review: 1,
    unmatched_order_items: 2,
    employees: 9,
    map_points: 14,
  },
  alerts: [
    {
      id: 'sla-alert-1',
      title: '2 reclamos con SLA en riesgo',
      severity: 'warning',
      description: 'Alumbrado y agua potable requieren respuesta operativa hoy.',
      frontend_path: `/t/${TENANT_SLUG}/reclamos`,
    },
  ],
  next_best_actions: [
    {
      id: 'open-tickets',
      label: 'Atender reclamos prioritarios',
      description: 'Revisá los casos con SLA próximo a vencer.',
      frontend_path: `/t/${TENANT_SLUG}/reclamos`,
    },
  ],
  tickets: {
    summary: { open_tickets: 18, resolved_tickets: 42, sla_risk: 2 },
    by_status: [
      { key: 'nuevo', label: 'Nuevo', count: 8 },
      { key: 'en_proceso', label: 'En proceso', count: 10 },
      { key: 'resuelto', label: 'Resuelto', count: 42 },
    ],
    by_category: [
      { key: 'alumbrado', label: 'Alumbrado público', count: 9 },
      { key: 'agua', label: 'Agua y cloacas', count: 5 },
      { key: 'verdes', label: 'Espacios verdes', count: 4 },
    ],
  },
  surveys: {
    summary: { responses: 124, active: 1 },
  },
  chats: {
    summary: { whatsapp_messages: 312, web_messages: 96 },
  },
  commerce: {
    contract_version: 'operations.commerce.v1',
    summary: {
      orders: 4,
      source_records: 4,
      deduplicated_mirrors: 0,
      assisted_orders: 2,
      orders_needing_review: 1,
      unmatched_items: 2,
      total_monetary: 52500,
      currency: 'ARS',
      currencies: 1,
    },
    by_origin: [{ key: 'whatsapp', label: 'WhatsApp', count: 4 }],
    by_source_model: [{ key: 'Order', label: 'Order', count: 4 }],
    by_request_kind: [{ key: 'order_note', label: 'Nota de pedido', count: 2 }],
    totals_by_currency: [{ key: 'ARS', label: 'ARS', currency: 'ARS', amount: 52500, count: 4 }],
    review_items: [],
  },
  employees: {
    summary: { employees: 9, active: 7 },
    by_agent: [
      { key: 'op-1', label: 'Ana López', count: 14 },
      { key: 'op-2', label: 'Diego Ruiz', count: 11 },
    ],
  },
  frontend_contract: {
    primary_refresh_seconds: 60,
  },
};

const OPERATIONS_HEATMAP_FIXTURE = {
  contract_version: 'operations.heatmap.v1',
  render_contract: { state: 'ready', layers: ['tickets'] },
  summary: { points: 2 },
  quality: {
    state: 'ready',
    label: 'Mapa operativo confiable',
    coverage_percent: 82,
    visible_points: 2,
    total_ticket_records: 18,
    ticket_records_with_coordinates: 15,
    ticket_records_without_coordinates: 3,
    pending_geocode: 1,
  },
  realtime: {
    poll_seconds: 60,
    latest_event_at: '2026-07-10T11:45:00Z',
    socket_events: ['ticket.updated'],
    sources: ['tickets', 'whatsapp'],
  },
  facets: [
    {
      key: 'categoria',
      field: 'categoria',
      query_param: 'categoria',
      label: 'Categoría',
      values: [
        { key: 'alumbrado', label: 'Alumbrado público', count: 9 },
        { key: 'agua', label: 'Agua y cloacas', count: 5 },
      ],
    },
  ],
  points: [
    {
      id: 'pt-1',
      lat: -34.5838,
      lng: -60.9433,
      weight: 3,
      categoria: 'Alumbrado público',
      barrio: 'Centro',
      estado: 'en_proceso',
      source: 'ticket',
    },
    {
      id: 'pt-2',
      lat: -34.5912,
      lng: -60.9511,
      weight: 2,
      categoria: 'Agua y cloacas',
      barrio: 'Pueblo Nuevo',
      estado: 'nuevo',
      source: 'ticket',
    },
  ],
  geocoding: {
    status: 'pending',
    candidate_count: 1,
    candidates: [
      {
        record_id: 101,
        address: 'Av. San Martín 1210, Barrio Centro',
        category: 'Alumbrado público',
        source: 'ticket',
        reason_code: 'address_without_coordinates',
      },
    ],
  },
};

const SURVEY_ANALYTICS_SUMMARY = {
  total_respuestas: 124,
  participantes_unicos: 118,
  tasa_completitud: 94.5,
  respuestas_ultimas_24h: 19,
  preguntas: [
    {
      id: 1001,
      texto: '¿Qué obra debería ejecutarse primero en tu barrio?',
      tipo: 'opcion_unica',
      total_respuestas: 124,
      opciones: [
        { id: 1, texto: 'Alumbrado LED en corredores escolares', respuestas: 58, porcentaje: 46.8 },
        { id: 2, texto: 'Reparación de veredas y rampas accesibles', respuestas: 41, porcentaje: 33.1 },
        { id: 3, texto: 'Plazas y juegos inclusivos', respuestas: 25, porcentaje: 20.1 },
      ],
    },
  ],
  canales: [
    { canal: 'WhatsApp', respuestas: 78, porcentaje: 62.9 },
    { canal: 'Web pública', respuestas: 34, porcentaje: 27.4 },
    { canal: 'QR territorial', respuestas: 12, porcentaje: 9.7 },
  ],
  utms: [
    { utm_source: 'whatsapp', respuestas: 78 },
    { utm_source: 'web', respuestas: 46 },
  ],
  demografia: {
    barrio: [
      { etiqueta: 'Centro', respuestas: 52, porcentaje: 41.9 },
      { etiqueta: 'Pueblo Nuevo', respuestas: 40, porcentaje: 32.3 },
      { etiqueta: 'Belgrano', respuestas: 32, porcentaje: 25.8 },
    ],
    rango_etario: [
      { etiqueta: '18-29', respuestas: 34, porcentaje: 27.4 },
      { etiqueta: '30-49', respuestas: 54, porcentaje: 43.5 },
      { etiqueta: '50+', respuestas: 36, porcentaje: 29.1 },
    ],
  },
};

const SURVEY_TIMESERIES = [
  { fecha: '2026-07-06', respuestas: 18 },
  { fecha: '2026-07-07', respuestas: 24 },
  { fecha: '2026-07-08', respuestas: 31 },
  { fecha: '2026-07-09', respuestas: 28 },
  { fecha: '2026-07-10', respuestas: 23 },
];

const SURVEY_RECENT_RESPONSES = [
  {
    id: 5001,
    respuesta_id: 5001,
    created_at: '2026-07-10T11:35:00Z',
    canal: 'whatsapp',
    barrio: 'Centro',
    respuestas: [
      {
        pregunta: '¿Qué obra debería ejecutarse primero en tu barrio?',
        respuesta: 'Alumbrado LED en corredores escolares',
      },
      {
        pregunta: '¿Qué calle o esquina necesita atención urgente?',
        respuesta: 'Av. San Martín al 1200 frente a la escuela.',
      },
    ],
  },
  {
    id: 5002,
    respuesta_id: 5002,
    created_at: '2026-07-10T10:50:00Z',
    canal: 'web',
    barrio: 'Pueblo Nuevo',
    respuestas: [
      {
        pregunta: '¿Qué obra debería ejecutarse primero en tu barrio?',
        respuesta: 'Reparación de veredas y rampas accesibles',
      },
    ],
  },
];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const installPanelSession = async (page: Page, theme: ThemeMode) => {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ user, tenantSlug, mode }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('authToken', 'panel-a11y-e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      window.localStorage.setItem('tenantSlug', tenantSlug);
      window.localStorage.setItem('theme', mode);
      const applyTheme = () => {
        if (!document.documentElement) return;
        if (mode === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };
      applyTheme();
      window.addEventListener('DOMContentLoaded', applyTheme, { once: true });
    },
    { user: ADMIN_USER, tenantSlug: TENANT_SLUG, mode: theme },
  );
};

const mockPanelApis = async (page: Page) => {
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();
    const isLocalOrigin = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

    // Vite dev server proxies `/admin` and `/estadisticas` to the backend.
    // For SPA document navigations in mocked E2E, serve the local app shell
    // so tests never hit production and still exercise the exact route URL.
    if (
      isLocalOrigin &&
      request.resourceType() === 'document' &&
      (path.startsWith('/admin') || path.startsWith('/estadisticas'))
    ) {
      const appShell = await route.fetch({ url: new URL('/', request.url()).toString() });
      await route.fulfill({ response: appShell });
      return;
    }

    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      if (!isLocalOrigin) {
        if (request.resourceType() === 'image') {
          await route.fulfill({ status: 204, body: '' });
          return;
        }
        await route.abort();
        return;
      }
      await route.continue();
      return;
    }

    if (path.endsWith('/auth/clerk/config')) {
      await json(route, {
        contract_version: 'auth.clerk.v1',
        enabled: false,
        environment: 'development',
        production_ready: false,
        ready_for_session_sync: false,
        publishable_key: '',
        social_providers: [],
      });
      return;
    }

    if (path === '/api/me' || path === '/me') {
      await json(route, ADMIN_USER);
      return;
    }

    if (path.endsWith('/public/tenant') || path.includes('/pwa/public/tenant-info')) {
      await json(route, {
        contract_version: 'public.tenant_profile.v1',
        slug: TENANT_SLUG,
        nombre: 'Municipio Demo',
        tipo: 'municipio',
        tenant: {
          id: TENANT_ID,
          slug: TENANT_SLUG,
          nombre: 'Municipio Demo',
          tipo: 'municipio',
          tema: {},
        },
      });
      return;
    }

    if (path.endsWith('/api/app/backoffice/navigation')) {
      await json(route, {
        contract_version: 'backoffice.navigation.v1',
        tenant_slug: TENANT_SLUG,
        role: 'admin',
        modules: [
          { id: 'operations', label: 'Operar reclamos', route: `/t/${TENANT_SLUG}/reclamos`, enabled: true, priority: 1 },
          { id: 'reports', label: 'Estadísticas', route: '/estadisticas', enabled: true, priority: 2 },
          { id: 'surveys', label: 'Encuestas', route: '/admin/encuestas', enabled: true, priority: 3 },
        ],
      });
      return;
    }

    if (path === '/api/public/widget-config') {
      await json(route, {
        contract_version: 'public.widget_config.v1',
        tenant: { slug: TENANT_SLUG, nombre: 'Municipio Demo' },
        quick_menu: [],
        support_channels: {},
      });
      return;
    }

    // --- Tickets ---
    if (path.endsWith('/api/tickets/workflow/metadata')) {
      await json(route, {
        contract_version: 'tickets.workflow.v1',
        request_id: 'req-workflow-a11y',
        states: ['nuevo', 'en_proceso', 'resuelto'],
      });
      return;
    }

    if (/\/api\/tickets\/municipio\/\d+\/timeline$/.test(path)) {
      await json(route, {
        estado_chat: 'abierto',
        historial_chat: TICKET_TIMELINE,
        timeline: [],
        unified_conversation_stream: [],
        realtime_state: { online: true },
      });
      return;
    }

    if (/\/api\/tickets\/chat\/\d+\/mensajes$/.test(path)) {
      await json(route, {
        mensajes: TICKET_TIMELINE,
        realtime_state: { online: true },
      });
      return;
    }

    if (/\/api\/tickets\/(municipio|pyme)\/\d+\/read-state$/.test(path)) {
      await json(route, {
        realtime_state: {
          viewers: [],
          active_viewers: [],
          read_states: [],
          summary: { active_count: 0, idle_count: 0, read_count: 0 },
        },
      });
      return;
    }

    if (path.endsWith('/api/tickets')) {
      await json(route, {
        tickets: TICKETS_FIXTURE,
        pagination: { page: 1, per_page: 20, pages: 1, total: TICKETS_FIXTURE.length, has_more: false },
        summary: { open: 2, unread: 2, sla_risk: 2, resolved: 1, unassigned: 1 },
        facets: {
          channel: [
            { key: 'whatsapp', label: 'WhatsApp', count: 2 },
            { key: 'web', label: 'Web', count: 1 },
          ],
          status: [
            { key: 'nuevo', label: 'Nuevo', count: 1 },
            { key: 'en_proceso', label: 'En proceso', count: 1 },
            { key: 'resuelto', label: 'Resuelto', count: 1 },
          ],
          category: [
            { key: 'Alumbrado público', label: 'Alumbrado público', count: 1 },
            { key: 'Agua y cloacas', label: 'Agua y cloacas', count: 1 },
          ],
          agent: [],
          priority: [{ key: 'alta', label: 'Alta', count: 1 }],
          sla: [{ key: 'risk', label: 'En riesgo', count: 2 }],
          unread: [{ key: 'unread', label: 'No leídos', count: 2 }],
        },
      });
      return;
    }

    if (path.endsWith('/api/v2/backoffice/operations/inbox-summary')) {
      await json(route, {
        contract_version: 'backoffice.inbox_summary.v1',
        request_id: 'req-inbox-a11y',
        summary: { open: 2, unread: 2, sla_risk: 2, resolved: 1, unassigned: 1 },
        recommended_views: [],
      });
      return;
    }

    // --- Operations / Estadísticas ---
    if (path.endsWith('/api/v2/analytics/operations/dashboard')) {
      await json(route, OPERATIONS_DASHBOARD_FIXTURE);
      return;
    }
    if (path.endsWith('/api/v2/analytics/operations/heatmap')) {
      await json(route, OPERATIONS_HEATMAP_FIXTURE);
      return;
    }
    if (path.endsWith('/api/v2/analytics/operations/action-center')) {
      await json(route, {
        contract_version: 'operations.action_center.v1',
        items: [
          {
            id: 'ac-1',
            title: 'Revisar 2 reclamos con SLA vencido o en riesgo',
            priority: 'high',
            category: 'tickets',
            action_label: 'Abrir reclamos',
            frontend_path: `/t/${TENANT_SLUG}/reclamos`,
          },
        ],
      });
      return;
    }
    if (path.endsWith('/api/v2/analytics/operations/ai-brief')) {
      await json(route, {
        contract_version: 'operations.ai_brief.v1',
        headline: 'Alumbrado público concentra el 50% de los reclamos abiertos.',
        summary: 'Se recomienda priorizar la zona Centro durante las próximas 24 horas.',
        highlights: ['2 casos con SLA en riesgo', '124 respuestas ciudadanas en encuestas'],
      });
      return;
    }
    if (path.endsWith('/api/v2/analytics/operations/ai-ops-queue')) {
      await json(route, { contract_version: 'operations.ai_ops_queue.v1', items: [] });
      return;
    }
    if (path.endsWith('/api/v2/analytics/operations/ai-provider-status')) {
      await json(route, {
        contract_version: 'operations.ai_provider_status.v1',
        provider: 'local_fallback',
        status: 'ready',
      });
      return;
    }
    if (path.endsWith('/api/v2/analytics/operations/freshness')) {
      await json(route, {
        contract_version: 'operations.freshness.v1',
        generated_at: '2026-07-10T12:00:00Z',
        freshness_seconds: 15,
        status: 'fresh',
      });
      return;
    }
    if (path.endsWith('/api/map/config')) {
      await json(route, {
        contract_version: 'map.config.v1',
        default_provider: 'maplibre',
        providers: ['maplibre'],
        center: { lat: -34.5838, lng: -60.9433, zoom: 13 },
      });
      return;
    }

    // --- Surveys ---
    if (path.startsWith('/api/v2/surveys/editorial-relocations')) {
      await json(route, { items: [], available: false });
      return;
    }

    if (path === `/api/v2/surveys/${SURVEY_ID}/releases`) {
      await json(route, { releases: [], items: [] });
      return;
    }

    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/dashboard`)) {
      await json(route, {
        summary: SURVEY_ANALYTICS_SUMMARY,
        timeseries: SURVEY_TIMESERIES,
        heatmap: { points: [], metadata: {} },
        executive_summary: {
          headline: 'Alumbrado LED lidera con 46,8% de las preferencias.',
          total_responses: 124,
        },
        admin_operations: {
          contract_version: 'surveys.operations.v2',
          survey_id: SURVEY_ID,
          public_token: SURVEY_SLUG,
          tenant_slug: TENANT_SLUG,
        },
        survey_publication: {
          contract_version: 'survey.publication.v1',
          public_state: 'published',
          is_published: true,
          live_results_enabled: true,
          is_live_vote: true,
          slug_publico: SURVEY_SLUG,
          links: {
            public_page_path: `/e/${SURVEY_SLUG}`,
            copy_url: `/e/${SURVEY_SLUG}`,
          },
        },
      });
      return;
    }

    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/resumen`)) {
      await json(route, SURVEY_ANALYTICS_SUMMARY);
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/series`)) {
      await json(route, { series: SURVEY_TIMESERIES, points: SURVEY_TIMESERIES });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/heatmap`)) {
      await json(route, { points: [], metadata: {} });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/forecast`)) {
      await json(route, {
        forecast: [
          { fecha: '2026-07-11', estimado: 26 },
          { fecha: '2026-07-12', estimado: 29 },
        ],
        summary: 'Tendencia estable de participación.',
      });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/alerts`)) {
      await json(route, { alerts: [] });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/brief`)) {
      await json(route, { summary: 'Participación activa en 3 barrios.', highlights: ['46,8% elige alumbrado LED'] });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/anomalies`)) {
      await json(route, { anomalies: [] });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/segments/suggestions`)) {
      await json(route, { suggestions: [] });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/analytics/segments/compare`)) {
      await json(route, { comparison: [] });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/respuestas`)) {
      await json(route, { data: SURVEY_RECENT_RESPONSES, total: SURVEY_RECENT_RESPONSES.length });
      return;
    }
    if (path.includes(`/encuestas/${SURVEY_ID}/comentarios`)) {
      await json(route, [
        {
          id: 901,
          autor: 'Vecina del centro',
          texto: 'Muy necesario reforzar el alumbrado cerca de la escuela.',
          estado: 'publicado',
          created_at: '2026-07-10T11:20:00Z',
        },
      ]);
      return;
    }

    if (path.includes(`/public/surveys/${SURVEY_SLUG}/live-results`) || path.includes(`/public/encuestas/v1/${SURVEY_SLUG}/live-results`)) {
      await json(route, {
        total_respuestas: 124,
        preguntas: SURVEY_ANALYTICS_SUMMARY.preguntas,
        actualizado_at: '2026-07-10T11:55:00Z',
      });
      return;
    }

    if (path === `/api/admin/encuestas/${SURVEY_ID}` || path === `/admin/encuestas/${SURVEY_ID}`) {
      await json(route, SURVEYS_FIXTURE[0]);
      return;
    }

    if (path === '/api/admin/encuestas' || path === '/admin/encuestas') {
      await json(route, {
        contract_version: 'surveys.admin_list.v2',
        tenant: { id: TENANT_ID, slug: TENANT_SLUG },
        tenant_slug: TENANT_SLUG,
        freshness: {
          generated_at: '2026-07-10T12:00:00Z',
          source: 'db',
          synthetic: false,
        },
        resumen: {
          total: SURVEYS_FIXTURE.length,
          por_estado: { publicada: 1, borrador: 1 },
          activas: 1,
          con_respuestas: 1,
          total_respuestas: 124,
          respuestas_con_coordenadas: 86,
          respuestas_ultimas_24h: 19,
          accepting_responses: 1,
          por_tipo_instrumento: { survey: 1, voting: 1 },
          participation_denominator: { available: false, reason_code: 'survey_eligible_population_not_configured' },
        },
        pagination: {
          contract_version: 'surveys.pagination.v1',
          limit: 50,
          page: 1,
          cursor: null,
          next_cursor: null,
          next_page: null,
          has_more: false,
          returned: SURVEYS_FIXTURE.length,
          total_items: SURVEYS_FIXTURE.length,
          ordering: 'id_desc',
        },
        encuestas: SURVEYS_FIXTURE,
      });
      return;
    }

    if (path.endsWith('/admin/employees') || path.endsWith('/empleados') || path.endsWith('/municipal/usuarios')) {
      await json(route, { employees: [] });
      return;
    }

    if (path.endsWith('/api/live-chat/schedule')) {
      await json(route, { enabled: true, is_open: true, status: 'open' });
      return;
    }

    await json(route, {});
  });
};

const expectNoHighImpactAxeViolations = async (page: Page, contextLabel: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe[src*="challenges.cloudflare.com"]')
    .analyze();

  const violations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  const summaries = violations.map(
    (violation) =>
      `[${contextLabel}] ${violation.id} (${violation.impact}): ${violation.help} (${violation.nodes.length})\n` +
      violation.nodes
        .slice(0, 6)
        .map(
          (node) =>
            `  - ${node.target.join(' ')} | ${node.html.slice(0, 140)} | ${node.failureSummary?.replace(/\s+/g, ' ')}`,
        )
        .join('\n'),
  );

  expect.soft(summaries, summaries.join('\n')).toEqual([]);
};

const expectNoHorizontalOverflow = async (page: Page, contextLabel: string) => {
  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect.soft(
    metrics.documentWidth,
    `[${contextLabel}] document scrollWidth (${metrics.documentWidth}) exceeded viewport (${metrics.viewportWidth})`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect.soft(
    metrics.bodyWidth,
    `[${contextLabel}] body scrollWidth (${metrics.bodyWidth}) exceeded viewport (${metrics.viewportWidth})`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
};

const expectMinimumTouchTargets = async (page: Page, contextLabel: string, minPx = 24) => {
  const offenders = await page.evaluate((minSize) => {
    const selector = [
      'button:not([disabled])',
      'a[href]',
      'summary',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="tab"]',
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
    ].join(',');

    const issues: string[] = [];
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      // Inline links inside prose paragraphs are exempt under WCAG 2.5.8.
      const isInlineProseLink =
        el.tagName === 'A' &&
        style.display === 'inline' &&
        Boolean(el.closest('p, li, dd'));
      if (isInlineProseLink) continue;

      if (rect.width < minSize - 0.5 || rect.height < minSize - 0.5) {
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent?.trim().slice(0, 40) ||
          el.tagName;
        issues.push(`${el.tagName.toLowerCase()} "${label}" (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
      }
    }

    return issues.slice(0, 15);
  }, minPx);

  expect.soft(offenders, `[${contextLabel}] Touch targets below ${minPx}px:\n${offenders.join('\n')}`).toEqual([]);
};

const expectPrimaryActionTargets = async (locators: Locator[], contextLabel: string, minPx = 44) => {
  for (const locator of locators) {
    await expect(locator, `[${contextLabel}] primary action must be visible`).toBeVisible();
    const box = await locator.boundingBox();
    expect.soft(box, `[${contextLabel}] primary action bounding box missing`).not.toBeNull();
    if (box) {
      expect.soft(
        Math.min(box.width, box.height),
        `[${contextLabel}] primary action too small (${Math.round(box.width)}x${Math.round(box.height)}px < ${minPx}px)`,
      ).toBeGreaterThanOrEqual(minPx - 0.5);
    }
  }
};

const expectVisibleKeyboardFocus = async (page: Page, contextLabel: string) => {
  // Press Tab several times and confirm at least one interactive element receives a visible focus indicator.
  const observed: Array<{ tag: string; label: string; visible: boolean; outline: string; shadow: string }> = [];

  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || active === document.documentElement) return null;
      const rect = active.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const style = window.getComputedStyle(active);
      const outlineWidth = parseFloat(style.outlineWidth || '0');
      const hasOutline = style.outlineStyle !== 'none' && outlineWidth >= 1;
      const hasShadow = style.boxShadow !== 'none' && style.boxShadow.trim().length > 0;
      return {
        tag: active.tagName.toLowerCase(),
        label: active.getAttribute('aria-label') || active.textContent?.trim().slice(0, 40) || active.tagName,
        visible: hasOutline || hasShadow,
        outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
        shadow: style.boxShadow,
      };
    });
    if (info) {
      observed.push(info);
    }
  }

  expect.soft(observed.length, `[${contextLabel}] Expected keyboard Tab to reach focusable elements`).toBeGreaterThan(0);
  const invisible = observed.filter((item) => !item.visible);
  expect.soft(
    invisible,
    `[${contextLabel}] Focused elements without visible focus indicator: ${JSON.stringify(invisible)}`,
  ).toEqual([]);
};

const expectThemeApplied = async (page: Page, theme: ThemeMode) => {
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  }
};

test.describe('Panel mobile responsiveness and WCAG 2.1 AA', () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const label = `${viewport.name}-${theme}`;

      test(`reclamos bandeja y detalle (${label})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPanelSession(page, theme);
        await mockPanelApis(page);

        await page.goto(`/t/${TENANT_SLUG}/reclamos`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('tickets-panel-root')).toBeVisible();
        await expect(page.getByText('Luminaria apagada en avenida San Martín al 1200').first()).toBeVisible();
        await expectThemeApplied(page, theme);

        await expectNoHorizontalOverflow(page, `tickets-inbox-${label}`);
        await expectMinimumTouchTargets(page, `tickets-inbox-${label}`, 24);
        await expectVisibleKeyboardFocus(page, `tickets-inbox-${label}`);
        await expectNoHighImpactAxeViolations(page, `tickets-inbox-${label}`);
        if (viewport.isMobile) {
          await maybeCapture(page, `despues-reclamos-bandeja-${label}.png`);
        }

        if (viewport.isMobile) {
          // Open ticket detail (chat & details) on 390px
          await page.getByText('Luminaria apagada en avenida San Martín al 1200').first().click();
          const actionBar = page.getByTestId('mobile-ticket-action-bar');
          await expect(actionBar).toBeVisible();
          await expectPrimaryActionTargets(
            [
              actionBar.getByRole('button', { name: 'Bandeja' }),
              actionBar.getByRole('button', { name: 'Responder' }),
              actionBar.getByRole('button', { name: 'Ficha' }),
            ],
            `tickets-detail-actionbar-${label}`,
            44,
          );
          await expectNoHorizontalOverflow(page, `tickets-chat-${label}`);
          await expectMinimumTouchTargets(page, `tickets-chat-${label}`, 24);
          await expectNoHighImpactAxeViolations(page, `tickets-chat-${label}`);
          await maybeCapture(page, `despues-reclamos-chat-${label}.png`);

          // Switch to Ficha / Detalles via the fixed mobile bottom bar
          await actionBar.getByRole('button', { name: 'Ficha' }).click();
          await expect(page.getByTestId('ticket-details-panel')).toBeVisible();
          await expectNoHorizontalOverflow(page, `tickets-details-${label}`);
          await expectMinimumTouchTargets(page, `tickets-details-${label}`, 24);
          await expectNoHighImpactAxeViolations(page, `tickets-details-${label}`);
          await maybeCapture(page, `despues-reclamos-ficha-${label}.png`);
        }
      });

      test(`/estadisticas (${label})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPanelSession(page, theme);
        await mockPanelApis(page);

        await page.goto('/estadisticas', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: /Métricas, mapas y prioridades/i })).toBeVisible();
        await expectThemeApplied(page, theme);

        if (viewport.isMobile) {
          await expectPrimaryActionTargets(
            [page.locator('.operations-global-refresh').first()],
            `estadisticas-primary-${label}`,
            44,
          );
          await maybeCapture(page, `despues-estadisticas-${label}.png`);
        }

        await expectNoHorizontalOverflow(page, `estadisticas-${label}`);
        await expectMinimumTouchTargets(page, `estadisticas-${label}`, 24);
        await expectVisibleKeyboardFocus(page, `estadisticas-${label}`);
        await expectNoHighImpactAxeViolations(page, `estadisticas-${label}`);
      });

      test(`/admin/encuestas (${label})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPanelSession(page, theme);
        await mockPanelApis(page);

        await page.goto('/admin/encuestas', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: /Encuestas y votaciones/i })).toBeVisible();
        await expect(page.getByText('Prioridades barriales 2026').first()).toBeVisible();
        await expectThemeApplied(page, theme);

        if (viewport.isMobile) {
          await expectPrimaryActionTargets(
            [page.getByRole('button', { name: /Nueva encuesta/i })],
            `encuestas-list-primary-${label}`,
            44,
          );
          // Expand the mobile collapsible filters disclosure and verify no overflow or small targets.
          const filtersSummary = page.locator('summary', { hasText: 'Filtros de estado y tipo' });
          await expect(filtersSummary).toBeVisible();
          await filtersSummary.click();
          await maybeCapture(page, `despues-encuestas-listado-${label}.png`);
        }

        await expectNoHorizontalOverflow(page, `encuestas-list-${label}`);
        await expectMinimumTouchTargets(page, `encuestas-list-${label}`, 24);
        await expectVisibleKeyboardFocus(page, `encuestas-list-${label}`);
        await expectNoHighImpactAxeViolations(page, `encuestas-list-${label}`);
      });

      test(`/admin/encuestas/:id (${label})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPanelSession(page, theme);
        await mockPanelApis(page);

        await page.goto(`/admin/encuestas/${SURVEY_ID}`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: /Editar encuesta/i })).toBeVisible();
        await expectThemeApplied(page, theme);

        if (viewport.isMobile) {
          await expectPrimaryActionTargets(
            [page.getByRole('button', { name: /Guardar cambios/i })],
            `encuestas-detail-primary-${label}`,
            44,
          );
          await maybeCapture(page, `despues-encuestas-editar-${label}.png`);
        }

        await expectNoHorizontalOverflow(page, `encuestas-detail-${label}`);
        await expectMinimumTouchTargets(page, `encuestas-detail-${label}`, 24);
        await expectVisibleKeyboardFocus(page, `encuestas-detail-${label}`);
        await expectNoHighImpactAxeViolations(page, `encuestas-detail-${label}`);
      });

      test(`/admin/encuestas/:id/analytics (${label})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installPanelSession(page, theme);
        await mockPanelApis(page);

        await page.goto(`/admin/encuestas/${SURVEY_ID}/analytics`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Prioridades barriales 2026').first()).toBeVisible();
        await expectThemeApplied(page, theme);

        if (viewport.isMobile) {
          await expectPrimaryActionTargets(
            [page.getByRole('link', { name: /WhatsApp/i }).first()],
            `encuestas-analytics-primary-${label}`,
            44,
          );
          await maybeCapture(page, `despues-encuestas-analytics-${label}.png`);
        }

        await expectNoHorizontalOverflow(page, `encuestas-analytics-${label}`);
        await expectMinimumTouchTargets(page, `encuestas-analytics-${label}`, 24);
        await expectVisibleKeyboardFocus(page, `encuestas-analytics-${label}`);
        await expectNoHighImpactAxeViolations(page, `encuestas-analytics-${label}`);
      });
    }
  }
});
