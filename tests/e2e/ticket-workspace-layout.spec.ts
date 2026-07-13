import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

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
  descripcion: 'Solicitud con seguimiento municipal y conversacion activa.',
  estado: index % 5 === 0 ? 'en_proceso' : 'nuevo',
  fecha: new Date(Date.UTC(2026, 6, 10, 10, index)).toISOString(),
  tipo: 'municipio',
  ticket_type: 'municipio',
  source_model: 'Reclamo',
  tenant_slug: TENANT_SLUG,
  categoria: index % 2 === 0 ? 'Alumbrado' : 'Via publica',
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

const mockWorkspaceApis = async (page: Page) => {
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

    if (/\/api\/tickets\/municipio\/\d+\/timeline$/.test(path)) {
      await json(route, {
        estado_chat: 'abierto',
        historial_chat: timeline,
        timeline: [],
        unified_conversation_stream: [],
        realtime_state: { online: true },
      });
      return;
    }

    if (/\/api\/tickets\/chat\/\d+\/mensajes$/.test(path)) {
      await json(route, { mensajes: timeline, realtime_state: { online: true } });
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
  await installWorkspaceSession(page);
  await mockWorkspaceApis(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-workspace-shell="tickets"]')).toBeVisible();
  await expect(page.getByTestId('tickets-panel-root')).toBeVisible();
  await expect(page.getByTestId('tickets-embedded-ops-header')).toBeVisible();
  await expect(page.locator('footer.bg-muted')).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(page.locator('[data-testid="chat-widget"][data-mode="standalone"]')).toBeHidden();
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
