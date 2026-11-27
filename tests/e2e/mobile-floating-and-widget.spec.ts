import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const CAPTURE_DIR = process.env.CORTE16_CAPTURE_DIR?.trim() || '';
const CAPTURE_STAGE = process.env.CORTE16_CAPTURE_STAGE?.trim() || 'despues';
const CAPTURE_ONLY = process.env.CORTE16_CAPTURE_ONLY === '1';

const maybeCapture = async (page: Page, name: string) => {
  if (!CAPTURE_DIR) return;
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(CAPTURE_DIR, `${CAPTURE_STAGE}-${name}.png`),
    fullPage: false,
  });
};

const MOBILE_VIEWPORTS = [
  { name: '360px', width: 360, height: 800 },
  { name: '390px', width: 390, height: 844 },
  { name: '412px', width: 412, height: 915 },
] as const;

const TENANT_SLUG = 'municipio-demo';
const TENANT_ID = 22;
const TICKET_ID = 101;
const SURVEY_ID = 301;

const ADMIN_USER = {
  id: 'corte16-admin',
  name: 'Coordinación Operativa',
  nombre: 'Coordinación Operativa',
  email: 'corte16@example.com',
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
  ],
  capabilities: [
    'tickets.read',
    'tickets.write',
    'tickets.assign',
    'analytics.read',
    'surveys.read',
    'surveys.write',
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
    descripcion: 'Hace tres noches la cuadra quedó a oscuras frente a la escuela primaria.',
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
    unread_count: 1,
    has_unread: true,
    messages: [
      {
        id: 1,
        author: 'user',
        agent_name: 'María Laura Gómez',
        content: 'Buenas tardes, la luminaria de la esquina está apagada hace tres días.',
        timestamp: '2026-07-10T10:00:00Z',
        channel: 'whatsapp',
      },
      {
        id: 2,
        author: 'agent',
        agent_name: 'Guardia Eléctrica',
        content: 'Registramos el reclamo y asignamos cuadrilla para esta tarde.',
        timestamp: '2026-07-10T11:20:00Z',
        channel: 'whatsapp',
      },
    ],
  },
];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const installAdminSession = (page: Page) =>
  page.addInitScript(
    ({ user, slug }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('authToken', 'corte16-e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      window.localStorage.setItem('tenantSlug', slug);
      window.localStorage.setItem('theme', 'light');
      window.localStorage.setItem(
        'chatboc_accessibility',
        JSON.stringify({
          dyslexia: false,
          simplified: false,
          highContrast: false,
          largeControls: false,
          captions: false,
          reducedMotion: true,
        }),
      );
    },
    { user: ADMIN_USER, slug: TENANT_SLUG },
  );

const installGuestSession = (page: Page) =>
  page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('theme', 'light');
  });

const dispatchInstallPrompt = async (page: Page) => {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => undefined },
      userChoice: {
        value: Promise.resolve({ outcome: 'dismissed', platform: 'playwright' }),
      },
    });
    window.dispatchEvent(event);
  });
};

const mockAllApis = async (page: Page) => {
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.toLowerCase();
    const isLocalOrigin = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

    // Vite dev server proxies `/admin` and `/estadisticas`; serve the SPA shell locally.
    if (
      isLocalOrigin &&
      request.resourceType() === 'document' &&
      (pathname.startsWith('/admin') || pathname.startsWith('/estadisticas'))
    ) {
      const appShell = await route.fetch({ url: new URL('/', request.url()).toString() });
      await route.fulfill({ response: appShell });
      return;
    }

    // Let Vite serve app routes, HTML, JS, CSS, fonts, images.
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

    if (pathname.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }
    if (pathname === '/api/me' || pathname === '/me' || pathname === '/api/auth/me') {
      await json(route, ADMIN_USER);
      return;
    }
    if (pathname.includes('/pwa/public/tenant-info') || pathname.includes(`/api/public/tenants/${TENANT_SLUG}/info`)) {
      await json(route, {
        id: TENANT_ID,
        slug: TENANT_SLUG,
        tenant_slug: TENANT_SLUG,
        nombre: 'Municipio Demo',
        tipo: 'municipio',
        primary_color: '#0f766e',
        secondary_color: '#0ea5e9',
      });
      return;
    }
    if (pathname.includes('/institutional-assistant')) {
      await json(route, { reason_code: 'knowledge_not_available' }, 404);
      return;
    }
    if (pathname.includes('/widget-config')) {
      await json(route, {
        contract_version: 'public.widget_config.v1',
        tenant: {
          id: TENANT_ID,
          slug: TENANT_SLUG,
          nombre: 'Municipio Demo',
          tipo: 'municipio',
        },
        tenant_name: 'Municipio Demo',
        tipo_chat: 'municipio',
        primary_color: '#0f766e',
        secondary_color: '#0ea5e9',
        welcome_title: 'Consultá trámites, reclamos y servicios municipales',
        welcome_subtitle: 'Asistente de Municipio Demo',
        quick_menu: [
          {
            texto: 'Consultar estado de reclamo',
            action: 'check_claim',
            description: 'Seguimiento con número de trámite',
          },
          {
            texto: 'Información de luminarias',
            action: 'lighting_info',
            description: 'Reportar fallas en vía pública',
          },
        ],
        support_channels: {},
      });
      return;
    }
    if (pathname.includes('/tickets')) {
      if (pathname.endsWith(`/${TICKET_ID}`) || pathname.includes(`/${TICKET_ID}/`)) {
        await json(route, { ticket: TICKETS_FIXTURE[0], ...TICKETS_FIXTURE[0] });
        return;
      }
      await json(route, { tickets: TICKETS_FIXTURE, items: TICKETS_FIXTURE, total: TICKETS_FIXTURE.length });
      return;
    }
    if (pathname.includes('/admin/encuestas') || pathname.includes('/surveys')) {
      if (pathname.includes(`/${SURVEY_ID}`)) {
        await json(route, {
          id: SURVEY_ID,
          slug: 'prioridades-barriales-2026',
          titulo: 'Prioridades barriales 2026',
          descripcion: 'Consulta anual de prioridades en el barrio.',
          tipo: 'encuesta',
          estado: 'publicada',
          preguntas: [
            {
              id: 1,
              orden: 1,
              tipo: 'opcion_unica',
              texto: '¿Qué obra priorizarías?',
              obligatoria: true,
              opciones: [
                { id: 'op1', orden: 1, texto: 'Alumbrado LED' },
                { id: 'op2', orden: 2, texto: 'Bacheo de calles' },
              ],
            },
          ],
        });
        return;
      }
      await json(route, {
        encuestas: [
          {
            id: SURVEY_ID,
            slug: 'prioridades-barriales-2026',
            titulo: 'Prioridades barriales 2026',
            estado: 'publicada',
            tipo: 'encuesta',
            total_respuestas: 42,
          },
        ],
        items: [
          {
            id: SURVEY_ID,
            slug: 'prioridades-barriales-2026',
            titulo: 'Prioridades barriales 2026',
            estado: 'publicada',
            tipo: 'encuesta',
            total_respuestas: 42,
          },
        ],
      });
      return;
    }
    if (pathname.includes('/estadisticas') || pathname.includes('/analytics') || pathname.includes('/operations')) {
      await json(route, {
        summary: { total_tickets: 12, open_tickets: 4, resolved_tickets: 8 },
        tickets_by_status: [],
        tickets_by_category: [],
        recent_tickets: TICKETS_FIXTURE,
      });
      return;
    }
    if (pathname.includes('/portal') || pathname.includes('/commerce') || pathname.includes('/claims')) {
      await json(route, {
        tenant: { id: TENANT_ID, slug: TENANT_SLUG, nombre: 'Municipio Demo', tipo: 'municipio' },
        notifications: [],
        events: [],
        news: [],
        catalog: [{ id: 1, nombre: 'Solicitud de poda', descripcion: 'Trámite municipal' }],
        activities: [],
        surveys: [],
        claims: TICKETS_FIXTURE,
        orders: [],
      });
      return;
    }
    if (pathname.includes('/ask')) {
      let body: { pregunta?: string; action?: string; action_id?: string } | null = null;
      try {
        body = request.postDataJSON() as { pregunta?: string; action?: string; action_id?: string } | null;
      } catch {
        body = null;
      }
      const asked = `${body?.pregunta || ''} ${body?.action || ''} ${body?.action_id || ''}`.toLowerCase();
      if (asked.includes('largo') || asked.includes('luminaria') || asked.includes('lighting_info')) {
        const longText = [
          'INICIO_RESPUESTA_LARGA: Guía completa de alumbrado público y reclamos vecinales para Municipio Demo.',
          ...Array.from({ length: 14 }, (_, idx) => (
            `Paso ${idx + 1}: Verificá la ubicación exacta de la columna afectada, anotá la altura catastral y describí si el inconveniente afecta a toda la cuadra o a una sola luminaria. Enlace de referencia: https://municipio-demo.gob.ar/servicios/alumbrado-publico/guia-operativa-completa-2026-seccion-${idx + 1}.`
          )),
          'FIN_RESPUESTA_LARGA: Si ya tenés el número de reclamo podés consultarlo desde las opciones rápidas.',
        ].join('\n\n');
        await json(route, {
          respuesta_usuario: longText,
          contexto_actualizado: {},
          botones: [
            { texto: 'Consultar otro reclamo', action: 'check_claim' },
            { texto: 'Ver requisitos completos', action: 'view_requirements' },
          ],
        });
        return;
      }

      if (asked.includes('check_claim') || asked.includes('consultar estado')) {
        await json(route, {
          respuesta_usuario:
            'Recibimos tu selección correctamente. Podés elegir una acción rápida o escribir el número de trámite para continuar.',
          contexto_actualizado: {},
          botones: [
            { texto: 'Ver guía larga de luminarias', action: 'lighting_info' },
            { texto: 'Consultar estado de reclamo', action: 'check_claim' },
          ],
        });
        return;
      }

      // Initial welcome/menu response
      await json(route, {
        respuesta_usuario: 'Hola, soy el asistente virtual de Municipio Demo. Elegí una opción para comenzar:',
        contexto_actualizado: {},
        botones: [
          { texto: 'Consultar estado de reclamo', action: 'check_claim' },
          { texto: 'Ver guía larga de luminarias', action: 'lighting_info' },
        ],
      });
      return;
    }

    await json(route, {});
  });
};

type RectInfo = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const rectsIntersect = (a: RectInfo, b: RectInfo, tolerance = 1) =>
  a.x + tolerance < b.x + b.width &&
  a.x + a.width > b.x + tolerance &&
  a.y + tolerance < b.y + b.height &&
  a.y + a.height > b.y + tolerance;

const checkFloatingGeometry = async (
  page: Page,
  contextLabel: string,
  viewport: { width: number; height: number },
) => {
  const report = await page.evaluate(() => {
    const isVisible = (el: Element | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };

    const toRect = (id: string, el: HTMLElement): RectInfo => {
      const r = el.getBoundingClientRect();
      return {
        id,
        x: Math.round(r.left * 10) / 10,
        y: Math.round(r.top * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      };
    };

    const inViewport = (r: RectInfo) =>
      r.y + r.height > 0 && r.y < window.innerHeight && r.x + r.width > 0 && r.x < window.innerWidth;

    const floatings: RectInfo[] = [];
    const a11yBtn = document.querySelector<HTMLElement>('.chatboc-a11y-dock__button');
    if (isVisible(a11yBtn)) floatings.push(toRect('a11y-button', a11yBtn));

    const pwaPrompt = document.querySelector<HTMLElement>('.chatboc-pwa-install');
    if (isVisible(pwaPrompt)) floatings.push(toRect('pwa-install', pwaPrompt));

    const widgetContainer = document.querySelector<HTMLElement>('.chatboc-container[data-mode="standalone"]');
    if (isVisible(widgetContainer)) {
      const launcherBtn = widgetContainer.querySelector<HTMLElement>('.chatboc-toggle-btn');
      if (isVisible(launcherBtn)) {
        floatings.push(toRect('widget-launcher', launcherBtn));
      }
    }

    const scrollTopBtn = document.querySelector<HTMLElement>('button[aria-label="Volver arriba"]');
    if (isVisible(scrollTopBtn)) floatings.push(toRect('scroll-top', scrollTopBtn));

    const protectedTargets: RectInfo[] = [];

    // Fixed bars
    const mobileTicketBar = document.querySelector<HTMLElement>('[data-testid="mobile-ticket-action-bar"]');
    if (isVisible(mobileTicketBar)) protectedTargets.push(toRect('fixed:mobile-ticket-action-bar', mobileTicketBar));

    const portalBottomNav = document.querySelector<HTMLElement>('nav[aria-label="Navegación principal del portal"]');
    if (isVisible(portalBottomNav)) protectedTargets.push(toRect('fixed:portal-bottom-nav', portalBottomNav));

    // Headings in main content and embedded workspace headers (excluding sr-only)
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main h1, main h2, [data-testid="tickets-panel-root"] h1, [data-testid="tickets-panel-root"] h2, [data-testid="tickets-embedded-ops-header"]',
      ),
    );
    headings.forEach((heading, idx) => {
      if (!isVisible(heading)) return;
      if (heading.classList.contains('sr-only')) return;
      const rect = toRect(`heading:${idx}:${(heading.textContent || '').trim().slice(0, 32)}`, heading);
      if (inViewport(rect)) protectedTargets.push(rect);
    });

    // Active writing fields / composers
    const inputs = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main textarea, main input[type="text"], main input[type="search"], main input:not([type]), [data-testid="tickets-panel-root"] textarea',
      ),
    );
    inputs.forEach((input, idx) => {
      if (!isVisible(input)) return;
      const label = input.getAttribute('aria-label') || input.getAttribute('placeholder') || `input-${idx}`;
      const rect = toRect(`input:${label.slice(0, 32)}`, input);
      if (inViewport(rect)) protectedTargets.push(rect);
    });

    // Navbar controls (must not overlap with a11y button)
    const headerControls = Array.from(
      document.querySelectorAll<HTMLElement>('header button, header a[href]'),
    );
    headerControls.forEach((ctrl, idx) => {
      if (!isVisible(ctrl)) return;
      if (ctrl.closest('.chatboc-a11y-dock')) return;
      const label = ctrl.getAttribute('aria-label') || (ctrl.textContent || '').trim() || `header-ctrl-${idx}`;
      const rect = toRect(`header:${label.slice(0, 28)}`, ctrl);
      if (inViewport(rect)) protectedTargets.push(rect);
    });

    return {
      floatings,
      protectedTargets,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });

  const collisions: string[] = [];

  // 1. Floating elements must stay inside viewport bounds
  for (const item of report.floatings) {
    if (
      item.x < -1 ||
      item.y < -1 ||
      item.x + item.width > viewport.width + 1 ||
      item.y + item.height > viewport.height + 1
    ) {
      collisions.push(`out-of-bounds: ${item.id} (${JSON.stringify(item)}) vs ${viewport.width}x${viewport.height}`);
    }
  }

  // 2. Floating elements must NOT intersect each other
  for (let i = 0; i < report.floatings.length; i += 1) {
    for (let j = i + 1; j < report.floatings.length; j += 1) {
      const a = report.floatings[i];
      const b = report.floatings[j];
      if (rectsIntersect(a, b)) {
        collisions.push(`floating-vs-floating: ${a.id} (${JSON.stringify(a)}) overlaps ${b.id} (${JSON.stringify(b)})`);
      }
    }
  }

  // 3. Floating elements must NOT intersect headings, fixed bars, header controls, or writing fields
  for (const floating of report.floatings) {
    for (const target of report.protectedTargets) {
      if (rectsIntersect(floating, target)) {
        collisions.push(
          `floating-vs-content: ${floating.id} (${JSON.stringify(floating)}) overlaps ${target.id} (${JSON.stringify(target)})`,
        );
      }
    }
  }

  if (!CAPTURE_ONLY) {
    expect(report.scrollWidth, `[${contextLabel}] horizontal overflow`).toBeLessThanOrEqual(report.innerWidth + 1);
    expect(collisions, `[${contextLabel}] geometry collisions:\n${collisions.join('\n')}`).toEqual([]);
  }
};

test.describe('Corte 16 · Floating elements safe-zone coordination (360, 390, 412 px)', () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`panel routes have zero floating collisions at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installAdminSession(page);
      await mockAllApis(page);

      // 1. Reclamos · Bandeja
      await page.goto(`/t/${TENANT_SLUG}/reclamos`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('tickets-panel-root')).toBeVisible();
      await expect(page.getByText('Luminaria apagada en avenida San Martín al 1200').first()).toBeVisible();
      await dispatchInstallPrompt(page);
      if (viewport.width === 390) {
        await maybeCapture(page, 'reclamos-bandeja-390px');
      }
      await checkFloatingGeometry(page, `reclamos-bandeja-${viewport.name}`, viewport);

      // 2. Reclamos · Chat (composer + fixed mobile-ticket-action-bar)
      await page.getByText('Luminaria apagada en avenida San Martín al 1200').first().click();
      const actionBar = page.getByTestId('mobile-ticket-action-bar');
      await expect(actionBar).toBeVisible();
      if (viewport.width === 390) {
        await maybeCapture(page, 'reclamos-chat-390px');
      }
      await checkFloatingGeometry(page, `reclamos-chat-${viewport.name}`, viewport);

      // 3. Reclamos · Ficha (details + fixed mobile-ticket-action-bar)
      await actionBar.getByRole('button', { name: 'Ficha' }).click();
      await expect(page.getByTestId('ticket-details-panel')).toBeVisible();
      await checkFloatingGeometry(page, `reclamos-ficha-${viewport.name}`, viewport);

      // 4. /estadisticas
      await page.goto('/estadisticas', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Actividad y prioridades/i })).toBeVisible();
      await dispatchInstallPrompt(page);
      await checkFloatingGeometry(page, `estadisticas-${viewport.name}`, viewport);

      // 5. /admin/encuestas
      await page.goto('/admin/encuestas', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Encuestas y votaciones/i })).toBeVisible();
      await dispatchInstallPrompt(page);
      await checkFloatingGeometry(page, `encuestas-${viewport.name}`, viewport);
    });

    test(`public portal and landing routes have zero floating collisions at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installGuestSession(page);
      await mockAllApis(page);

      // 1. Portal público · Dashboard (BottomNavigationBar + widget launcher + PWA prompt + a11y button)
      await page.goto(`/t/${TENANT_SLUG}/portal/dashboard`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('navigation', { name: 'Navegación principal del portal' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir ajustes de accesibilidad' })).toBeVisible();
      await expect(page.locator('.chatboc-container[data-mode="standalone"] .chatboc-toggle-btn')).toBeVisible();
      await dispatchInstallPrompt(page);
      await expect(page.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeVisible();
      if (viewport.width === 390) {
        await maybeCapture(page, 'portal-dashboard-390px');
      }
      await checkFloatingGeometry(page, `portal-dashboard-${viewport.name}`, viewport);

      // 2. Portal público · Reclamos
      await page.goto(`/t/${TENANT_SLUG}/portal/reclamos`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('navigation', { name: 'Navegación principal del portal' })).toBeVisible();
      await expect(page.locator('.chatboc-container[data-mode="standalone"] .chatboc-toggle-btn')).toBeVisible();
      await dispatchInstallPrompt(page);
      await expect(page.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeVisible();
      await checkFloatingGeometry(page, `portal-reclamos-${viewport.name}`, viewport);

      // 3. Landing pública (/)
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Convertí conversaciones en operaciones reales/i })).toBeVisible();
      await dispatchInstallPrompt(page);
      await expect(page.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeVisible();
      if (viewport.width === 390) {
        await maybeCapture(page, 'landing-390px');
      }
      await checkFloatingGeometry(page, `landing-${viewport.name}`, viewport);
    });
  }
});

test.describe('Corte 16 · Public widget in iframe on mobile (390 px)', () => {
  test('keeps composer visible with virtual keyboard, unclipped bubbles, >=44px options, focus return and stable long-message scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Install a controllable visualViewport mock so we can simulate a real mobile virtual keyboard.
    await page.addInitScript(() => {
      const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
      const vv = {
        width: window.innerWidth,
        height: window.innerHeight,
        offsetLeft: 0,
        offsetTop: 0,
        pageLeft: 0,
        pageTop: 0,
        scale: 1,
        addEventListener(type: string, cb: EventListenerOrEventListenerObject) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(cb);
        },
        removeEventListener(type: string, cb: EventListenerOrEventListenerObject) {
          listeners.get(type)?.delete(cb);
        },
        dispatchEvent(event: Event) {
          listeners.get(event.type)?.forEach((cb) => {
            if (typeof cb === 'function') cb.call(vv, event);
            else cb.handleEvent(event);
          });
          return true;
        },
      };
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        get: () => vv,
      });
      (window as unknown as Record<string, unknown>).__setSimulatedVisualViewport = (
        next: { height: number; offsetTop?: number; width?: number },
      ) => {
        vv.height = next.height;
        if (typeof next.offsetTop === 'number') vv.offsetTop = next.offsetTop;
        if (typeof next.width === 'number') vv.width = next.width;
        vv.dispatchEvent(new Event('resize'));
        vv.dispatchEvent(new Event('scroll'));
      };
    });

    await mockAllApis(page);

    const iframeUrl = `/iframe?${new URLSearchParams({
      defaultOpen: '1',
      tenant: TENANT_SLUG,
      endpoint: 'municipio',
      primaryColor: '#0f766e',
      accentColor: '#0ea5e9',
      welcomeTitle: 'Asistente de Municipio Demo',
      welcomeSubtitle: 'Consultá trámites y reclamos',
      openWidth: '460',
      openHeight: '780',
    }).toString()}`;

    await page.goto(iframeUrl, { waitUntil: 'domcontentloaded' });

    const composerInput = page.getByRole('textbox', { name: 'Escribir mensaje' });
    await expect(composerInput).toBeVisible();

    // Verify organization brand token (--primary) was applied from #0f766e (~175deg hue)
    const primaryToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
    );
    if (!CAPTURE_ONLY) {
      expect(primaryToken).toMatch(/^17\d\s+/);
    }

    // Verify option buttons are visible and >= 44px high
    const firstOption = page.getByRole('button', { name: /Consultar estado de reclamo/i }).first();
    await expect(firstOption).toBeVisible();
    const firstOptionBox = await firstOption.boundingBox();
    expect(firstOptionBox).not.toBeNull();
    if (!CAPTURE_ONLY) {
      expect(firstOptionBox!.height, 'Initial option button must be >= 44px high').toBeGreaterThanOrEqual(44);
    }

    await maybeCapture(page, 'widget-iframe-opciones-390px');

    // Click option -> verify bot reply renders with >= 44px option buttons AND focus returns to composer
    await firstOption.click();
    const longGuideOption = page.getByRole('button', { name: /Ver guía larga de luminarias/i }).first();
    await expect(longGuideOption).toBeVisible();

    const chatOptionBox = await longGuideOption.boundingBox();
    expect(chatOptionBox).not.toBeNull();
    if (!CAPTURE_ONLY) {
      expect(chatOptionBox!.height, 'ChatButtons option must be >= 44px high').toBeGreaterThanOrEqual(44);
      await expect(composerInput, 'Focus must return to composer after choosing an option').toBeFocused();
    }

    // Trigger a LONG bot message -> verify unclipped bubbles and stable reading scroll (no jump to bottom)
    await longGuideOption.click();
    await expect(page.getByText(/INICIO_RESPUESTA_LARGA/)).toBeVisible();
    // Wait past the 100ms auto-scroll timer
    await page.waitForTimeout(250);

    await maybeCapture(page, 'widget-iframe-mensaje-largo-390px');

    const bubbleMetrics = await page.evaluate(() => {
      const scrollArea = document.querySelector<HTMLElement>('.chatboc-chat-scrollarea');
      const scrollRect = scrollArea?.getBoundingClientRect();
      const bubbles = Array.from(document.querySelectorAll<HTMLElement>('.chat-bubble-bot, .chat-bubble-user'));
      const clipped = bubbles
        .map((bubble) => {
          const r = bubble.getBoundingClientRect();
          const textOverflow = bubble.scrollWidth > bubble.clientWidth + 2;
          const rightOverflow = scrollRect ? r.right > scrollRect.right + 2 : false;
          const leftOverflow = scrollRect ? r.left < scrollRect.left - 2 : false;
          return {
            text: (bubble.textContent || '').slice(0, 32),
            textOverflow,
            rightOverflow,
            leftOverflow,
            width: Math.round(r.width),
            scrollRight: scrollRect ? Math.round(scrollRect.right) : 0,
            bubbleRight: Math.round(r.right),
          };
        })
        .filter((item) => item.textOverflow || item.rightOverflow || item.leftOverflow);

      const longBubble = bubbles.find((b) => (b.textContent || '').includes('INICIO_RESPUESTA_LARGA'));
      const longRect = longBubble?.getBoundingClientRect();
      const topVisibleOffset =
        scrollRect && longRect ? Math.round(longRect.top - scrollRect.top) : null;

      return {
        clipped,
        scrollWidth: scrollArea?.scrollWidth ?? 0,
        clientWidth: scrollArea?.clientWidth ?? 0,
        scrollTop: scrollArea?.scrollTop ?? 0,
        scrollHeight: scrollArea?.scrollHeight ?? 0,
        clientHeight: scrollArea?.clientHeight ?? 0,
        topVisibleOffset,
      };
    });

    if (!CAPTURE_ONLY) {
      expect(bubbleMetrics.clipped, `Clipped chat bubbles: ${JSON.stringify(bubbleMetrics.clipped)}`).toEqual([]);
      expect(bubbleMetrics.scrollWidth, 'Scroll area must not overflow horizontally').toBeLessThanOrEqual(
        bubbleMetrics.clientWidth + 2,
      );
      // Long message should anchor near its top so the user reads from the beginning, NOT jumped past it
      expect(bubbleMetrics.topVisibleOffset).not.toBeNull();
      expect(
        bubbleMetrics.topVisibleOffset!,
        `Long bot message top should stay visible at the reading edge (got offset ${bubbleMetrics.topVisibleOffset}px)`,
      ).toBeGreaterThanOrEqual(-16);
    }

    // Scroll manually partway into the long message and ensure there is no scroll jump afterward
    const scrollAfterManual = await page.evaluate(async () => {
      const scrollArea = document.querySelector<HTMLElement>('.chatboc-chat-scrollarea')!;
      const targetTop = Math.max(0, scrollArea.scrollTop + 120);
      scrollArea.scrollTop = targetTop;
      scrollArea.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 250));
      return { targetTop, actualTop: scrollArea.scrollTop };
    });
    if (!CAPTURE_ONLY) {
      expect(Math.abs(scrollAfterManual.actualTop - scrollAfterManual.targetTop)).toBeLessThanOrEqual(4);
    }

    // Simulate mobile virtual keyboard opening (visualViewport shrinks from 844px -> 430px, offsetTop: 28)
    await composerInput.focus();
    await page.evaluate(() => {
      const setVv = (window as unknown as Record<string, (next: { height: number; offsetTop: number }) => void>)
        .__setSimulatedVisualViewport;
      setVv({ height: 430, offsetTop: 28 });
    });
    await page.waitForTimeout(120);

    await maybeCapture(page, 'widget-iframe-teclado-390px');

    const composerBoxWithKeyboard = await composerInput.boundingBox();
    expect(composerBoxWithKeyboard).not.toBeNull();
    if (!CAPTURE_ONLY) {
      expect(
        composerBoxWithKeyboard!.y,
        'Composer top must remain below visualViewport.offsetTop',
      ).toBeGreaterThanOrEqual(28);
      expect(
        composerBoxWithKeyboard!.y + composerBoxWithKeyboard!.height,
        'Composer bottom must remain visible above the mobile virtual keyboard (28 + 430 = 458px)',
      ).toBeLessThanOrEqual(458 + 2);
    }
  });
});
