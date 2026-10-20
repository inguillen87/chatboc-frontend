import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { E2E_VIEWPORTS, expectNoHorizontalOverflow } from './e2e-helpers';

test.describe.configure({ mode: 'serial' });

const TENANT_SLUG = 'municipio-demo';
const TICKET_ID = 101;

const operatorUser = {
  id: 'operator-e2e',
  name: 'Operador Atlas',
  email: 'operator@example.com',
  nombre_empresa: 'Municipio Demo',
  plan: 'pro',
  rol: 'tenant_admin',
  role: 'tenant_admin',
  tipo_chat: 'municipio',
  rubro: 'municipio',
  permissions: ['tickets.read', 'tickets.write', 'tickets.assign'],
  capabilities: ['tickets.read', 'tickets.write', 'tickets.assign'],
  tenantSlug: TENANT_SLUG,
  tenant_slug: TENANT_SLUG,
  tenant: { slug: TENANT_SLUG, tenant_slug: TENANT_SLUG, plan: 'pro' },
};

const tickets = Array.from({ length: 18 }, (_, index) => ({
  id: TICKET_ID + index,
  nro_ticket: `M-${TICKET_ID + index}`,
  asunto: index === 0 ? 'Luminaria apagada en avenida principal' : `Reclamo operativo ${index + 1}`,
  descripcion: index === 2
    ? 'La persona solicita una respuesta coordinada entre servicios públicos, movilidad y atención ciudadana porque el incidente afecta varios accesos y requiere seguimiento documentado sin perder información operativa.'
    : 'Solicitud con seguimiento municipal y conversacion activa.',
  estado: index % 5 === 0 ? 'en_proceso' : 'nuevo',
  fecha: new Date(Date.UTC(2026, 6, 10, 10, index)).toISOString(),
  tipo: 'municipio',
  ticket_type: 'municipio',
  source_model: 'Reclamo',
  tenant_slug: TENANT_SLUG,
  categoria: index === 2
    ? 'Infraestructura urbana, alumbrado público, seguridad peatonal y coordinación interáreas'
    : index % 2 === 0 ? 'Alumbrado' : 'Via publica',
  channel: 'whatsapp',
  display_name: `Vecino ${index + 1}`,
  name: `Vecino ${index + 1}`,
  telefono: `+549110000${String(index).padStart(4, '0')}`,
  priority: index < 3 ? 'alta' : 'normal',
  sla_status: index < 2 ? 'risk' : 'on_track',
  hasUnreadMessages: index < 6,
  collaboration_state: {
    has_unread: index < 6,
    unread_count: index < 6 ? 2 : 0,
    unread_viewer_count: 0,
  },
  allowed_actions: [
    {
      id: 'coordinate_inspection',
      label: 'Coordinar inspección conjunta y confirmar ventana estimada de resolución al ciudadano',
      href: `/admin/tickets/${TICKET_ID + index}/coordinate`,
      enabled: true,
    },
  ],
}));

const timeline = Array.from({ length: 36 }, (_, index) => ({
  id: `message-${index + 1}`,
  comentario:
    index % 2 === 0
      ? `Mensaje del vecino ${index + 1}: necesitamos una actualizacion del reclamo.`
      : `Respuesta del equipo ${index + 1}: el caso sigue en seguimiento operativo.`,
  fecha: new Date(Date.UTC(2026, 6, 10, 11, index)).toISOString(),
  es_admin: index % 2 === 1,
}));

const crmPeople = Array.from({ length: 80 }, (_, index) => ({
  id: `contact-${index + 1}`,
  contact_id: `contact-${index + 1}`,
  nombre: `Persona CRM ${String(index + 1).padStart(2, '0')}`,
  email: `persona${index + 1}@example.com`,
  telefono: `+549110001${String(index).padStart(4, '0')}`,
  canal: index % 2 === 0 ? 'whatsapp' : 'web',
  etiquetas: index % 3 === 0 ? ['reclamo', 'seguimiento'] : ['contacto'],
  marketing: index % 2 === 0,
  motivo: index % 2 === 0 ? 'Seguimiento de reclamo municipal' : 'Consulta general',
  resumen: `Contexto operativo publicado para la persona ${index + 1}.`,
  last_seen: new Date(Date.UTC(2026, 6, 18, 12, index)).toISOString(),
  created_at: new Date(Date.UTC(2026, 5, 1, 9, index)).toISOString(),
  interaction_count: index + 1,
}));

type TimelineMessage = (typeof timeline)[number];

type WorkspaceApiCapture = {
  replies: Array<{
    url: string;
    contentType: string;
    body: string;
  }>;
  timelineReplies: Record<number, TimelineMessage[]>;
};

const timelineForTicket = (ticketId: number) => {
  if (ticketId === TICKET_ID) return timeline;
  return Array.from({ length: 36 }, (_, index) => ({
    id: `message-${ticketId}-${index + 1}`,
    comentario:
      index === 35
        ? 'Respuesta del equipo 36: el caso sigue en seguimiento operativo.'
        : index === 34
        ? `Mensaje exclusivo del reclamo M-${ticketId}: falta una respuesta del area.`
        : index % 2 === 0
          ? `Mensaje del vecino ${index + 1} para M-${ticketId}: solicita una actualizacion.`
          : `Seguimiento interno ${index + 1} confirmado para M-${ticketId}.`,
    fecha: new Date(Date.UTC(2026, 6, 17, 13, index)).toISOString(),
    es_admin: index % 2 === 1,
  }));
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const installWorkspaceSession = async (page: Page) => {
  await page.addInitScript(
    ({ user, tenantSlug }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('authToken', 'ticket-workspace-e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      window.localStorage.setItem('tenantSlug', tenantSlug);
    },
    { user: operatorUser, tenantSlug: TENANT_SLUG },
  );
};

const mockWorkspaceApis = async (page: Page, capture: WorkspaceApiCapture) => {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

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
      await json(route, operatorUser);
      return;
    }

    if (path.endsWith('/api/app/backoffice/navigation')) {
      await json(route, {
        contract_version: 'backoffice.navigation.v1',
        tenant_slug: TENANT_SLUG,
        role: 'admin',
        modules: [
          { id: 'operations', label: 'Operar reclamos', route: '/perfil?tab=tickets', enabled: true, priority: 1 },
          { id: 'reports', label: 'Reportes claros', route: '/perfil?tab=estadisticas', enabled: true, priority: 2 },
          { id: 'surveys', label: 'Encuestas y sondeos', route: '/admin/encuestas', enabled: true, priority: 3 },
          { id: 'people', label: 'Personas y accesos', route: '/empleados', enabled: true, priority: 4 },
          { id: 'maps', label: 'Mapas de calor', route: '/perfil?tab=estadisticas&view=mapas', enabled: true, priority: 5 },
          { id: 'advanced_analytics', label: 'Analítica IA', route: '/analytics?mode=advanced', enabled: true, priority: 6 },
        ],
      });
      return;
    }

    if (path.endsWith('/public/tenant')) {
      await json(route, {
        contract_version: 'public.tenant_profile.v1',
        tenant: {
          slug: TENANT_SLUG,
          nombre: 'Municipio Demo',
          tipo: 'municipio',
          tema: {},
        },
      });
      return;
    }

    if (path.endsWith('/api/tickets/workflow/metadata')) {
      await json(route, {
        contract_version: 'tickets.workflow.v1',
        request_id: 'req-workflow-e2e',
        states: ['nuevo', 'en_proceso', 'resuelto'],
      });
      return;
    }

    const replyMatch = path.match(/\/api\/tickets\/(municipio|pyme)\/(\d+)\/responder$/);
    if (replyMatch && request.method() === 'POST') {
      const ticketId = Number(replyMatch[2]);
      const body = request.postData() || '';
      const replyComment = {
        id: `reply-${9000 + ticketId}`,
        comentario: `Actualizacion operativa E2E para M-${ticketId}.`,
        fecha: new Date(Date.UTC(2026, 6, 17, 13, 10)).toISOString(),
        es_admin: true,
      };
      capture.replies.push({
        url: request.url(),
        contentType: request.headers()['content-type'] || '',
        body,
      });
      capture.timelineReplies[ticketId] = [...(capture.timelineReplies[ticketId] || []), replyComment];
      await json(route, {
        contract_version: 'tickets.agent_reply.v1',
        comment: replyComment,
        delivery: {
          contract_version: 'tickets.agent_reply_delivery.v1',
          mode: 'real_message',
          channel: 'whatsapp',
          status: 'sent',
          reason: 'provider_accepted',
          external_dispatch: true,
          socket_emitted: false,
          recipient_room_emitted: false,
          recipient_presence_confirmed: false,
          recipient_read_confirmed: false,
          reply_comment_ids: [9000 + ticketId],
          latest_reply_comment_id: 9000 + ticketId,
          timeline_updated: true,
          reply_status: 'sent_to_whatsapp',
          operator_message: 'WhatsApp acepto la respuesta del operador.',
          delivery_results: { email: false, sms: false, whatsapp: true, socket: false },
        },
      });
      return;
    }

    if (/\/api\/tickets\/(municipio|pyme)\/\d+\/send-history$/.test(path)) {
      await json(route, { status: 'sent', message: 'Historial notificado.' });
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

    if (/\/api\/tickets\/municipio\/\d+\/timeline$/.test(path)) {
      const ticketId = Number(path.match(/\/(\d+)\/timeline$/)?.[1] || TICKET_ID);
      const ticketTimeline = [...timelineForTicket(ticketId), ...(capture.timelineReplies[ticketId] || [])];
      await json(route, {
        estado_chat: 'abierto',
        historial_chat: ticketTimeline,
        timeline: [],
        unified_conversation_stream: [],
        realtime_state: { online: true },
      });
      return;
    }

    if (/\/api\/tickets\/chat\/\d+\/mensajes$/.test(path)) {
      const ticketId = Number(path.match(/\/chat\/(\d+)\/mensajes$/)?.[1] || TICKET_ID);
      await json(route, {
        mensajes: [...timelineForTicket(ticketId), ...(capture.timelineReplies[ticketId] || [])],
        realtime_state: { online: true },
      });
      return;
    }

    if (path.endsWith('/api/tickets')) {
      await json(route, {
        tickets,
        pagination: { page: 1, per_page: 18, pages: 1, total: 18, has_more: false },
        summary: { open: 18, unread: 6, sla_risk: 2, resolved: 0, unassigned: 3 },
        facets: {
          channel: [{ key: 'whatsapp', label: 'WhatsApp', count: 18 }],
          status: [{ key: 'nuevo', label: 'Nuevo', count: 14 }],
          category: [{ key: 'Alumbrado', label: 'Alumbrado', count: 9 }],
          agent: [],
          priority: [{ key: 'alta', label: 'Alta', count: 3 }],
          sla: [{ key: 'risk', label: 'En riesgo', count: 2 }],
          unread: [{ key: 'unread', label: 'No leidos', count: 6 }],
        },
      });
      return;
    }

    if (path.endsWith('/api/v2/crm/people')) {
      await json(route, {
        contract_version: 'crm.people.directory.v2',
        items: crmPeople.slice(0, 50).map((person) => ({
          id: person.id,
          contact_id: null,
          name: person.nombre.replace('Persona CRM', 'P*** C***'),
          email: `p***${person.id.split('-').at(-1)}@example.com`,
          phone: `***${person.telefono.slice(-4)}`,
          channel: person.canal,
          marketing: person.marketing,
          tags: person.etiquetas,
          last_seen: person.last_seen,
          source: 'contact',
          pii_masked: true,
          possible_duplicate: false,
        })),
        page: { limit: 50, total: 50, has_more: false, next_cursor: null },
        pii: {
          requested: false,
          masked: true,
          granted: false,
          permission: 'crm_contacts_pii_read',
          reason_code: 'pii_masked_by_default',
        },
      });
      return;
    }

    if (path.endsWith('/api/crm/clientes')) {
      await json(route, crmPeople);
      return;
    }

    if (path.endsWith('/api/v2/backoffice/operations/inbox-summary')) {
      await json(route, {
        contract_version: 'backoffice.inbox_summary.v1',
        request_id: 'req-inbox-e2e',
        summary: { open: 18, unread: 6, sla_risk: 2, resolved: 0, unassigned: 3 },
        recommended_views: [],
      });
      return;
    }

    if (path.endsWith('/analytics/identity/coverage') || path.endsWith('/api/analytics/identity/coverage')) {
      await json(route, {
        contract_version: 'analytics.identity_coverage.v1',
        request_id: 'req-coverage-e2e',
        tenant_id: 1,
        coverage_pct: 100,
        slo_status: 'ok',
        alert_count: 0,
        alerts: [],
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

const openWorkspace = async (page: Page, path: string) => {
  const capture: WorkspaceApiCapture = { replies: [], timelineReplies: {} };
  await installWorkspaceSession(page);
  await mockWorkspaceApis(page, capture);
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-workspace-shell="tickets"]')).toBeVisible();
  await expect(page.getByTestId('tickets-panel-root')).toBeVisible();
  await expect(page.getByTestId('tickets-embedded-ops-header')).toBeVisible();
  await expect(page.locator('footer.bg-muted')).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(page.locator('[data-testid="chat-widget"][data-mode="standalone"]')).toBeHidden();
  return capture;
};

const expectDocumentLocked = async (page: Page) => {
  const metrics = await page.evaluate(() => ({
    bodyOverflow: window.getComputedStyle(document.body).overflow,
    htmlOverflow: window.getComputedStyle(document.documentElement).overflow,
    bodyScrollHeight: document.body.scrollHeight,
    htmlScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    scrollY: window.scrollY,
  }));

  expect(metrics.bodyOverflow).toBe('hidden');
  expect(metrics.htmlOverflow).toBe('hidden');
  expect(metrics.scrollY).toBe(0);
  expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.htmlScrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
};

const expectScrollable = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const metrics = await locator.evaluate((element) => {
    const before = element.scrollTop;
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    element.scrollTop = before > maxScrollTop / 2 ? 0 : maxScrollTop;
    return {
      before,
      after: element.scrollTop,
      clientHeight: element.clientHeight,
      maxScrollTop,
      scrollHeight: element.scrollHeight,
      overflowY: window.getComputedStyle(element).overflowY,
    };
  });

  expect(['auto', 'scroll']).toContain(metrics.overflowY);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.maxScrollTop).toBeGreaterThan(0);
  expect(metrics.after).not.toBe(metrics.before);
};

const expectInspectorContentContained = async (inspectorRegion: Locator) => {
  const panel = inspectorRegion.getByTestId('ticket-details-panel');
  const viewport = panel.locator('[data-radix-scroll-area-viewport]').first();
  await expect(panel).toBeVisible();
  await expect(viewport).toBeVisible();

  const metrics = await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const visibleChildren = Array.from(element.querySelectorAll<HTMLElement>('*'))
      .map((child) => child.getBoundingClientRect())
      .filter((childRect) => childRect.width > 0 && childRect.height > 0);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: window.getComputedStyle(element).overflowX,
      scrollbarGutter: window.getComputedStyle(element).scrollbarGutter,
      maxChildRight: Math.max(rect.right, ...visibleChildren.map((childRect) => childRect.right)),
      minChildLeft: Math.min(rect.left, ...visibleChildren.map((childRect) => childRect.left)),
      left: rect.left,
      right: rect.right,
    };
  });

  expect(metrics.overflowX).toBe('hidden');
  expect(metrics.scrollbarGutter).toContain('stable');
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.minChildLeft).toBeGreaterThanOrEqual(metrics.left - 1);
  expect(metrics.maxChildRight).toBeLessThanOrEqual(metrics.right + 1);
};

const expectMobileConversationLayout = async (page: Page) => {
  const messageScroll = page.getByTestId('ticket-message-scroll');
  const replyFooter = page.getByTestId('ticket-reply-footer');
  const composerContext = page.getByTestId('ticket-composer-context');
  const composer = page.getByTestId('ticket-composer');
  const mobileViewport = page.getByTestId('tickets-mobile-viewport');

  const metrics = await page.evaluate(() => {
    const rect = (testId: string) => {
      const value = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.getBoundingClientRect();
      return value
        ? {
            top: value.top,
            right: value.right,
            bottom: value.bottom,
            left: value.left,
            width: value.width,
            height: value.height,
          }
        : null;
    };
    const messageElement = document.querySelector<HTMLElement>('[data-testid="ticket-message-scroll"]');
    const contextElement = document.querySelector<HTMLElement>('[data-testid="ticket-composer-context"]');

    return {
      message: rect('ticket-message-scroll'),
      footer: rect('ticket-reply-footer'),
      context: rect('ticket-composer-context'),
      composer: rect('ticket-composer'),
      viewport: rect('tickets-mobile-viewport'),
      messageOverflowY: messageElement ? window.getComputedStyle(messageElement).overflowY : '',
      messageOverscrollY: messageElement ? window.getComputedStyle(messageElement).overscrollBehaviorY : '',
      messageScrollbarGutter: messageElement ? window.getComputedStyle(messageElement).scrollbarGutter : '',
      contextOverflowY: contextElement ? window.getComputedStyle(contextElement).overflowY : '',
    };
  });

  expect(metrics.message).toBeTruthy();
  expect(metrics.footer).toBeTruthy();
  expect(metrics.context).toBeTruthy();
  expect(metrics.composer).toBeTruthy();
  expect(metrics.viewport).toBeTruthy();
  expect(metrics.message?.bottom || 0).toBeLessThanOrEqual((metrics.footer?.top || 0) + 1);
  expect(metrics.footer?.bottom || 0).toBeLessThanOrEqual((metrics.viewport?.bottom || 0) + 1);
  expect(metrics.composer?.bottom || 0).toBeLessThanOrEqual((metrics.footer?.bottom || 0) + 1);
  expect(metrics.context?.height || 0).toBeLessThanOrEqual(136);
  expect(metrics.footer?.height || 0).toBeLessThanOrEqual(200);
  expect(metrics.messageOverflowY).toBe('auto');
  expect(metrics.messageOverscrollY).toBe('contain');
  expect(metrics.messageScrollbarGutter).toContain('stable');
  expect(metrics.contextOverflowY).toBe('auto');

  await messageScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const lastMessage = page.getByText('Respuesta del equipo 36: el caso sigue en seguimiento operativo.');
  await expect(lastMessage).toBeVisible();
  const [lastMessageBox, messageBox] = await Promise.all([
    lastMessage.boundingBox(),
    messageScroll.boundingBox(),
  ]);
  expect(lastMessageBox).not.toBeNull();
  expect(messageBox).not.toBeNull();
  expect(lastMessageBox?.y || 0).toBeGreaterThanOrEqual(messageBox?.y || 0);
  expect((lastMessageBox?.y || 0) + (lastMessageBox?.height || 0)).toBeLessThanOrEqual(
    (messageBox?.y || 0) + (messageBox?.height || 0) + 1,
  );

  await expect(replyFooter).toBeVisible();
  await expect(composerContext).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(mobileViewport).toBeVisible();
};

test('profile home exposes role-based enterprise work areas and nests plans under Administration', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const capture: WorkspaceApiCapture = { replies: [], timelineReplies: {} };
  await installWorkspaceSession(page);
  await mockWorkspaceApis(page, capture);
  await page.goto('/perfil', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Municipio Demo', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trabajo de hoy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú Atención' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú CRM ciudadano' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú Inteligencia' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú Administración' })).toBeVisible();
  await expect(page.getByText('Configuración técnica separada de la operación diaria.')).toBeVisible();
  await expect(page.getByText(/Información operativa confirmada/)).toBeVisible();
  await expect(page.getByText(/Módulo publicado por backend/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Abrir menú Administración' }).click();
  const planItem = page.getByRole('menuitem', { name: /Planes y facturación/i });
  await expect(planItem).toBeVisible();
  await planItem.click();

  await expect(page).toHaveURL(/tab=perfil.*section=plan|section=plan.*tab=perfil/);
  await expect(page.getByText('Uso de la organización')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú Administración' })).toHaveAttribute('data-active', 'true');
  await expectNoHorizontalOverflow(page);
});

test('profile people CRM stays inside the viewport with an independently scrollable queue', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const capture: WorkspaceApiCapture = { replies: [], timelineReplies: {} };
  await installWorkspaceSession(page);
  await mockWorkspaceApis(page, capture);
  await page.goto('/perfil?tab=usuarios&tenant_slug=municipio-demo', { waitUntil: 'domcontentloaded' });

  const workspace = page.getByTestId('crm-people-workspace');
  const grid = page.getByTestId('crm-people-grid');
  await expect(page.getByTestId('profile-crm-workspace')).toBeVisible();
  await expect(workspace).toHaveAttribute('data-layout', 'embedded');
  await expect(page.getByText('Consola CRM')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'P*** C*** 01' })).toBeVisible();

  const bounds = await page.evaluate(() => {
    const read = (testId: string) => {
      const rect = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null;
    };
    return {
      workspace: read('crm-people-workspace'),
      grid: read('crm-people-grid'),
      viewportHeight: window.innerHeight,
    };
  });

  expect(bounds.workspace).not.toBeNull();
  expect(bounds.grid).not.toBeNull();
  expect(bounds.workspace?.bottom || 0).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.grid?.height || 0).toBeGreaterThan(220);
  await expectScrollable(page.locator('aside[aria-label="Lista de personas"] > div'));
  await expectNoHorizontalOverflow(page);
  await expectDocumentLocked(page);
});

test('profile people CRM keeps record actions and summary reachable at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const capture: WorkspaceApiCapture = { replies: [], timelineReplies: {} };
  await installWorkspaceSession(page);
  await mockWorkspaceApis(page, capture);
  await page.goto('/perfil?tab=usuarios&tenant_slug=municipio-demo', { waitUntil: 'domcontentloaded' });

  const workspace = page.getByTestId('crm-people-workspace');
  const grid = page.getByTestId('crm-people-grid');
  const recordHeader = page.getByTestId('crm-person-header');
  const recordTabs = page.getByTestId('crm-person-tabs');
  const recordScroll = page
    .getByTestId('crm-person-scroll')
    .locator('[data-radix-scroll-area-viewport]')
    .first();

  await expect(workspace).toHaveAttribute('data-layout', 'embedded');
  await expect(page.getByRole('combobox', { name: 'Vista operativa de personas' })).toBeVisible();
  await expect(page.locator('aside[aria-label="Lista de personas"]')).toBeHidden();
  const recordActions = page.getByRole('button', { name: 'Más acciones' });
  await expect(recordActions).toBeVisible();
  await recordActions.click();
  const protectedCaseAction = page.getByRole('menuitem', { name: 'Sin caso exacto' });
  await expect(protectedCaseAction).toBeVisible();
  await expect(protectedCaseAction).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir panel contextual' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Resumen', exact: true })).toBeVisible();
  await expect(page.getByText('Datos protegidos. El detalle requiere un permiso explícito y una identidad resoluble publicada por el backend.')).toBeVisible();

  const layout = await page.evaluate(() => {
    const read = (testId: string) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      const rect = element?.getBoundingClientRect();
      return element && rect
        ? {
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }
        : null;
    };
    return {
      grid: read('crm-people-grid'),
      recordHeader: read('crm-person-header'),
      recordTabs: read('crm-person-tabs'),
      areaNavigation: read('crm-area-navigation'),
      queueControls: read('crm-queue-controls'),
      viewportHeight: window.innerHeight,
    };
  });

  expect(layout.grid).not.toBeNull();
  expect(layout.grid?.height || 0).toBeGreaterThan(180);
  expect(layout.grid?.bottom || 0).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.recordHeader?.bottom || 0).toBeLessThanOrEqual((layout.grid?.bottom || 0) + 1);
  expect(layout.recordTabs?.bottom || 0).toBeLessThanOrEqual((layout.grid?.bottom || 0) + 1);
  for (const region of [layout.areaNavigation, layout.queueControls, layout.recordHeader, layout.recordTabs]) {
    expect(region).not.toBeNull();
    expect(region?.scrollWidth || 0).toBeLessThanOrEqual((region?.clientWidth || 0) + 1);
  }

  await expect(recordHeader).toBeInViewport();
  await expect(recordTabs).toBeInViewport();
  await expect(recordScroll).toBeVisible();
  const scrollMetrics = await recordScroll.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollMetrics.clientHeight).toBeGreaterThan(60);
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await expectNoHorizontalOverflow(page);
  await expectDocumentLocked(page);
});

const desktopPaths = [
  '/perfil?tab=tickets&ticket_id=101&channel=whatsapp&focus=heatmap',
  '/t/municipio-demo/reclamos?ticket_id=101&channel=whatsapp&focus=heatmap',
];

for (const path of desktopPaths) {
  test(`ticket workspace is full-height at 1440x900: ${path.split('?')[0]}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, path);

    await expect(page.getByTestId('tickets-desktop-grid')).toBeVisible();
    await expect(page.getByTestId('tickets-list-region')).toBeVisible();
    await expect(page.getByTestId('tickets-conversation-region')).toBeVisible();
    await expect(page.getByTestId('tickets-detail-region')).toBeVisible();
    await expect(page.getByTestId('ticket-composer')).toBeVisible();

    const composerBox = await page.getByTestId('ticket-composer').boundingBox();
    expect(composerBox).not.toBeNull();
    expect((composerBox?.y || 0) + (composerBox?.height || 0)).toBeLessThanOrEqual(900);

    await expectScrollable(
      page.getByTestId('tickets-list-region').locator('[data-radix-scroll-area-viewport]').first(),
    );
    await expectScrollable(
      page.getByTestId('tickets-conversation-region').locator('.overflow-y-auto').first(),
    );
    await expectScrollable(
      page.getByTestId('tickets-detail-region').locator('[data-radix-scroll-area-viewport]').first(),
    );
    await expectDocumentLocked(page);
  });
}

for (const viewport of [
  { width: 1920, height: 1080, label: '1920x1080' },
  { width: 1600, height: 900, label: '1600x900' },
  { width: 1366, height: 768, label: '1366x768' },
]) {
  test(`enterprise ticket inspector preserves the conversation at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorkspace(
      page,
      '/perfil?tab=tickets&ticket_id=101&channel=whatsapp&focus=heatmap',
    );

    const grid = page.getByTestId('tickets-desktop-grid');
    const conversation = page.getByTestId('tickets-conversation-region');
    const detail = page.getByTestId('tickets-detail-region');
    await expect(grid).toHaveAttribute('data-detail-presentation', 'column');
    await expect(detail).toBeVisible();

    if (viewport.width < 1440) {
      await expect(page.getByTestId('tickets-list-region')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('tickets-list-region')).toBeVisible();
    }

    const [conversationBox, detailBox] = await Promise.all([
      conversation.boundingBox(),
      detail.boundingBox(),
    ]);
    expect(conversationBox).not.toBeNull();
    expect(detailBox).not.toBeNull();
    expect(conversationBox?.width || 0).toBeGreaterThanOrEqual(560);
    expect(detailBox?.width || 0).toBeGreaterThanOrEqual(340);
    expect(detailBox?.width || 0).toBeLessThanOrEqual(520);

    await expect(page.getByText(/Coordinar inspección conjunta y confirmar ventana estimada/i)).toBeVisible();
    await expectInspectorContentContained(detail);
    await expectNoHorizontalOverflow(page);
    await expectDocumentLocked(page);

    if (viewport.width === 1920) {
      const separator = detail.getByRole('separator', { name: /ajustar ancho del inspector/i });
      await separator.press('End');
      await expect(separator).toHaveAttribute('aria-valuenow', '520');
      await expect(detail).toHaveAttribute('data-inspector-width', '520');
      await expect.poll(() => page.evaluate(() => JSON.parse(
        window.localStorage.getItem('chatboc:tickets:inspector-layout:municipio-demo:operator-e2e') || '{}',
      ))).toEqual({ open: true, width: 520 });
    }

    if (viewport.width === 1366) {
      await page.getByRole('button', { name: 'Mostrar lista de tickets' }).click();
      await expect(page.getByTestId('tickets-list-region')).toBeVisible();
      await expect(page.getByTestId('tickets-detail-region')).toHaveCount(0);
      await expect(grid).toHaveAttribute('data-detail-presentation', 'collapsed');

      await page.getByRole('button', { name: 'Ver detalles del ticket' }).click();
      await expect(page.getByTestId('tickets-list-region')).toHaveCount(0);
      await expect(page.getByTestId('tickets-detail-region')).toBeVisible();
      await expect(grid).toHaveAttribute('data-detail-presentation', 'column');
    }
  });
}

test('ticket inspector becomes a contained drawer at 1024px and restores the queue on close', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openWorkspace(
    page,
    '/perfil?tab=tickets&ticket_id=101&channel=whatsapp&focus=heatmap',
  );

  const grid = page.getByTestId('tickets-desktop-grid');
  await expect(grid).toHaveAttribute('data-detail-presentation', 'collapsed');
  await expect(page.getByTestId('tickets-list-region')).toBeVisible();

  const detailsTrigger = page.getByRole('button', { name: 'Ver detalles del ticket' });
  await detailsTrigger.click();
  const drawer = page.getByTestId('tickets-detail-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('role', 'dialog');
  await expect(drawer).toHaveAttribute('aria-modal', 'false');
  await expect(grid).toHaveAttribute('data-detail-presentation', 'drawer');
  await expect(page.getByTestId('tickets-list-region')).toHaveCount(0);
  const resizeHandle = drawer.getByRole('separator', { name: /ajustar ancho del inspector/i });
  await expect(resizeHandle).toHaveAttribute('aria-valuemax', '464');
  await expect(drawer.getByRole('button', { name: 'Cerrar detalles del ticket' })).toBeFocused();

  const [conversationBox, drawerBox] = await Promise.all([
    page.getByTestId('tickets-conversation-region').boundingBox(),
    drawer.boundingBox(),
  ]);
  expect(conversationBox).not.toBeNull();
  expect(drawerBox).not.toBeNull();
  expect((conversationBox?.width || 0) - (drawerBox?.width || 0)).toBeGreaterThanOrEqual(560);
  await expectInspectorContentContained(drawer);
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('tickets-list-region')).toBeVisible();
  await expect(grid).toHaveAttribute('data-detail-presentation', 'collapsed');
  await expect(detailsTrigger).toBeFocused();
});

const mobilePaths = [
  '/perfil?tab=tickets&ticket_id=101&channel=whatsapp&focus=heatmap',
  '/t/municipio-demo/reclamos?ticket_id=101&channel=whatsapp&focus=heatmap',
];

for (const path of mobilePaths) {
  test(`ticket workspace keeps the composer visible at 390x844: ${path.split('?')[0]}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkspace(page, path);

    const mobileLayout = page.getByTestId('tickets-mobile-layout');
    await expect(mobileLayout).toBeVisible();
    const mobileTabs = mobileLayout.getByRole('tablist', { name: 'Vistas de tickets' });
    const ticketsTab = mobileTabs.getByRole('tab', { name: 'Tickets', exact: true });
    const chatTab = mobileTabs.getByRole('tab', { name: 'Chat', exact: true });
    const infoTab = mobileTabs.getByRole('tab', { name: 'Info', exact: true });

    await expect(chatTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Chat' })).toBeVisible();
    await ticketsTab.click();
    await expect(ticketsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Tickets' })).toBeVisible();
    await expectScrollable(
      page.getByTestId('tickets-mobile-viewport').locator('[data-radix-scroll-area-viewport]').first(),
    );

    await chatTab.click();
    await page.waitForTimeout(300);
    await expect(chatTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Responder ticket' })).toBeVisible();
    await expect(page.getByTestId('ticket-composer')).toBeVisible();
    await expectScrollable(page.getByTestId('ticket-message-scroll'));
    await expectMobileConversationLayout(page);

    const composerBox = await page.getByTestId('ticket-composer').boundingBox();
    expect(composerBox).not.toBeNull();
    expect((composerBox?.y || 0) + (composerBox?.height || 0)).toBeLessThanOrEqual(844);

    await chatTab.press('ArrowRight');
    await page.waitForTimeout(300);
    await expect(infoTab).toHaveAttribute('aria-selected', 'true');
    await expect(infoTab).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Info' })).toBeVisible();
    await expectScrollable(
      page.getByTestId('tickets-mobile-viewport').locator('[data-radix-scroll-area-viewport]').first(),
    );

    await infoTab.press('ArrowLeft');
    await page.waitForTimeout(300);
    await expect(chatTab).toHaveAttribute('aria-selected', 'true');
    await expect(chatTab).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Responder ticket' })).toBeVisible();
    await expectMobileConversationLayout(page);
    await expectDocumentLocked(page);
  });
}

for (const viewport of E2E_VIEWPORTS) {
  test(`CRM reclamos selects list, detail and sends composer reply on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const capture = await openWorkspace(page, '/t/municipio-demo/reclamos');

    const mobileLayout = page.getByTestId('tickets-mobile-layout');
    if (viewport.label === 'mobile') {
      const mobileTabs = mobileLayout.getByRole('tablist', { name: 'Vistas de tickets' });
      await mobileTabs.getByRole('tab', { name: 'Tickets', exact: true }).click();
    }

    const secondTicket = page.getByRole('button', { name: 'Abrir ticket M-102' });
    await secondTicket.click();
    await expect(secondTicket).toHaveAttribute('aria-pressed', 'true');

    if (viewport.label === 'mobile') {
      const mobileTabs = mobileLayout.getByRole('tablist', { name: 'Vistas de tickets' });
      const infoTab = mobileTabs.getByRole('tab', { name: 'Info', exact: true });
      const chatTab = mobileTabs.getByRole('tab', { name: 'Chat', exact: true });

      await infoTab.click();
      const infoPanel = page.getByRole('tabpanel', { name: 'Info' });
      await expect(infoPanel).toContainText('#M-102');
      await expect(infoPanel).toContainText('Reclamo operativo 2');
      await expect(infoPanel).toContainText('Vecino 2');
      await expect(infoPanel).toContainText('Via publica');
      await chatTab.click();
    } else {
      const detailRegion = page.getByTestId('tickets-detail-region');
      await expect(detailRegion).toContainText('#M-102');
      await expect(detailRegion).toContainText('Reclamo operativo 2');
      await expect(detailRegion).toContainText('Vecino 2');
      await expect(detailRegion).toContainText('Via publica');
    }

    await expect(page.getByText('Mensaje exclusivo del reclamo M-102: falta una respuesta del area.')).toBeVisible();

    const composer = page.getByRole('textbox', { name: 'Responder ticket' });
    await composer.fill('Actualizacion operativa E2E para M-102.');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect.poll(() => capture.replies.length).toBe(1);
    expect(capture.replies[0].url).toContain('/api/tickets/municipio/102/responder');
    expect(capture.replies[0].contentType).toContain('multipart/form-data');
    expect(capture.replies[0].body).toContain('name="comentario"');
    expect(capture.replies[0].body).toContain('Actualizacion operativa E2E para M-102.');

    const deliveryStatus = page.getByTestId('ticket-reply-delivery-status');
    await expect(deliveryStatus).toContainText('Estado de entrega por confirmar');
    await expect(deliveryStatus).toContainText('WhatsApp');
    await expect(deliveryStatus).toContainText('WhatsApp acepto la respuesta del operador.');
    await expect(
      page
        .getByTestId('ticket-message-scroll')
        .locator('.chat-message')
        .filter({ hasText: 'Actualizacion operativa E2E para M-102.' })
        .last(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectDocumentLocked(page);
  });
}
