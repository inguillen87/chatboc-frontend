import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const CAPTURE_DIR = process.env.CORTE18_CAPTURE_DIR?.trim() || '';

const maybeCapture = async (page: Page, filename: string, fullPage = false) => {
  if (!CAPTURE_DIR) return;
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(CAPTURE_DIR, filename),
    fullPage,
  });
};

const TENANT_SLUG = 'org-prueba';
const TENANT_ID = 701;
const REVISION = 'b'.repeat(64);
const SOURCE_SHA = 'a'.repeat(64);

const UI_COPY = {
  heading: 'Información y orientación',
  description: 'Consultá por tema o escribí tu pregunta.',
  topics: 'Temas de consulta',
  sources: 'Documentos y fuentes',
  source_details: 'Consultar fuentes',
  question: 'Escribí tu consulta',
  placeholder: '¿Sobre qué necesitás información?',
  send: 'Consultar',
  back: 'Volver',
  home: 'Todos los temas',
  loading: 'Consultando la información…',
  unknown: 'Esta información no está incluida en las fuentes disponibles. Podés elegir otro tema.',
  error: 'No se pudo completar la consulta. Volvé a intentarlo o elegí un tema.',
  retry: 'Volver a consultar',
  import: 'Incorporar conocimiento',
  import_help: 'Cargá la versión integrada de documentos, respuestas y menús de esta organización.',
  empty: 'Todavía no se incorporó una versión de conocimiento en este espacio.',
  choose_file: 'Seleccionar versión',
  private: 'Uso interno',
  public: 'Disponible para consultas',
  publish: 'Habilitar en el agente',
  retire: 'Retirar del agente',
  confirm: 'Confirmar cambio',
  cancel: 'Cancelar',
  confirm_publish: 'Las respuestas quedarán disponibles en el agente.',
  confirm_retire: 'El agente dejará de utilizar esta versión.',
  version: 'Versión',
  preview: 'Probar respuestas',
  large_text: 'Texto ampliado',
  answer: 'Respuesta',
  evidence: 'Información respaldada por documentos',
  close: 'Cerrar fuentes',
  pending: 'El cambio no está confirmado.',
  acronyms: 'Siglas',
  more_options: 'Más opciones',
  previous_options: 'Opciones anteriores',
  options_page: 'Opciones: grupo {current} de {total}',
};

const SOURCE_DOC = {
  id: 'source-qa',
  title: 'Guía institucional de orientación de prueba',
  sha256: SOURCE_SHA,
  page_count: 3,
  pages: [1],
  url: 'https://example.org/documentos/guia-orientacion.pdf',
  source_authority: 'operational_document',
  format: 'pdf',
  mime_type: 'application/pdf',
  pagination: 'native',
  review_status: 'reviewed',
  current_validity: 'official_text_observed',
  document_visibility: 'public',
};

const START_NODE = {
  id: 'start',
  title: '¿Sobre qué tema necesitás orientación?',
  text: 'Elegí un tema publicado o escribí tu consulta para leer la guía correspondiente.',
  actions: [
    { code: '1', label: 'Documentación y requisitos', target: 'requirements' },
    { code: '2', label: 'Turnos y horarios', target: 'appointments' },
    { code: '3', label: 'Contactos y atención humana', target: 'contactos' },
  ],
  sources: [SOURCE_DOC],
  links: [],
};

const CONTACT_NODE = {
  id: 'contactos',
  title: 'Contactos y atención humana',
  text: 'Podés comunicarte con la mesa de orientación en los canales publicados por el organismo de prueba.',
  actions: [{ code: '9', label: 'Volver al menú principal', target: 'start' }],
  sources: [SOURCE_DOC],
  links: [],
};

const WORKSPACE_FIXTURE = {
  contract_version: 'chatboc.institutional_assistant.v1',
  tenant: { id: TENANT_ID, slug: TENANT_SLUG, name: 'Organización Institucional de Prueba' },
  revision: REVISION,
  visibility: 'public',
  can_edit: false,
  ui: UI_COPY,
  knowledge: {
    version: '1.0',
    start: 'start',
    node_count: 3,
    topics: [
      { id: 'requirements', label: 'Documentación y requisitos' },
      { id: 'appointments', label: 'Turnos y horarios' },
      { id: 'contactos', label: 'Contactos y atención humana' },
    ],
    sources: [SOURCE_DOC],
    initial: START_NODE,
  },
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const mockInstitutionalPortalAndWidget = async (page: Page) => {
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.toLowerCase();
    const isLocalOrigin = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      if (!isLocalOrigin) {
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

    if (pathname.includes('/pwa/public/tenant-info') || pathname.includes(`/api/public/tenants/${TENANT_SLUG}/info`)) {
      await json(route, {
        id: TENANT_ID,
        slug: TENANT_SLUG,
        tenant_slug: TENANT_SLUG,
        nombre: 'Organización Institucional de Prueba',
        tipo: 'municipio',
        logo_url: '/favicon/favicon-192x192.png',
        primary_color: '#0f766e',
        secondary_color: '#0ea5e9',
      });
      return;
    }

    if (pathname.includes(`/api/public/tenants/${TENANT_SLUG}/navigation`)) {
      await json(route, { items: [] });
      return;
    }

    if (pathname === `/api/public/tenants/${TENANT_SLUG}/institutional-assistant`) {
      await json(route, WORKSPACE_FIXTURE);
      return;
    }

    if (pathname === `/api/public/tenants/${TENANT_SLUG}/institutional-assistant/answer`) {
      await json(route, {
        contract_version: 'chatboc.institutional_assistant.v1',
        tenant: { id: TENANT_ID, slug: TENANT_SLUG },
        revision: REVISION,
        nodes: [],
        text: UI_COPY.unknown,
        selection_performed: true,
        business_writes_performed: false,
      });
      return;
    }

    if (pathname === `/api/public/tenants/${TENANT_SLUG}/institutional-assistant/nodes/contactos`) {
      await json(route, {
        contract_version: 'chatboc.institutional_assistant.v1',
        tenant: { id: TENANT_ID, slug: TENANT_SLUG },
        revision: REVISION,
        nodes: [CONTACT_NODE],
        text: CONTACT_NODE.text,
        selection_performed: false,
        business_writes_performed: false,
      });
      return;
    }

    if (pathname.includes('/ask')) {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      const actionId = typeof body?.action_id === 'string' ? body.action_id : '';
      if (actionId.endsWith(':contactos')) {
        await json(route, {
          fuente: 'institutional_knowledge',
          context_revision: REVISION,
          knowledge_tenant: { id: TENANT_ID, slug: TENANT_SLUG },
          knowledge_nodes: [CONTACT_NODE],
          knowledge_sources: CONTACT_NODE.sources,
          message_body: CONTACT_NODE.text,
          botones: CONTACT_NODE.actions.map((action) => ({
            texto: action.label,
            action_id: `knowledge:${REVISION.slice(0, 16)}:${action.target}`,
          })),
        });
        return;
      }
      await json(route, {
        fuente: 'institutional_knowledge_unknown_question',
        context_revision: REVISION,
        knowledge_tenant: { id: TENANT_ID, slug: TENANT_SLUG },
        message_body: UI_COPY.unknown,
        botones: [],
      });
      return;
    }

    if (pathname.includes('/widget-config')) {
      await json(route, {
        contract_version: 'public.widget_config.v1',
        tenant: { id: TENANT_ID, slug: TENANT_SLUG, nombre: 'Organización Institucional de Prueba', tipo: 'municipio' },
        quick_menu: [],
        support_channels: {},
      });
      return;
    }

    await json(route, {});
  });
};

const expectNoHighImpactA11yViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe[src*="challenges.cloudflare.com"]')
    .analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `  - ${node.target.join(' ')} | ${node.failureSummary}`).join('\n'),
  );
  expect(summary, summary.join('\n')).toEqual([]);
};

test.describe('Corte 18 · Bloque Otras formas de seguir cuando no hay respuesta', () => {
  for (const viewport of [
    { name: '390px', width: 390, height: 844 },
    { name: '1440px', width: 1440, height: 900 },
  ]) {
    test(`portal y widget muestran Otras formas de seguir (>= 44px, foco, contacto primero, axe AA) a ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('theme', 'light');
      });

      await mockInstitutionalPortalAndWidget(page);
      await page.goto(`/t/${TENANT_SLUG}`, { waitUntil: 'domcontentloaded' });

      const assistant = page.getByTestId('institutional-assistant');
      await expect(assistant).toBeVisible();

      // Una respuesta con nodos (inicio) no muestra el bloque Otras formas de seguir.
      await expect(assistant.getByTestId('institutional-no-answer')).toHaveCount(0);

      // Escribir una consulta sin respuesta y enviarla.
      const composer = assistant.getByLabel('Escribí tu consulta');
      await composer.fill('¿Dónde puedo tramitar un permiso no publicado?');
      await composer.press('Enter');

      // El foco debe ir al texto del resultado (no al principio de la página).
      const notice = assistant.locator('.institutional-assistant__uncovered');
      await expect(notice).toBeVisible();
      await expect(notice).toBeFocused();

      // Bloque Otras formas de seguir con aria-live="polite" una sola vez.
      const fallback = assistant.getByTestId('institutional-no-answer');
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveAttribute('aria-live', 'polite');
      await expect(fallback.locator('[aria-live]')).toHaveCount(0);
      await expect(fallback.getByRole('heading', { name: 'Otras formas de seguir' })).toBeVisible();

      // La opción de contacto aparece destacada primero seguida del resto de los temas iniciales.
      const topicButtons = fallback.locator('[data-no-answer-actions] button');
      await expect(topicButtons).toHaveCount(3);
      await expect(topicButtons.nth(0)).toHaveAttribute('data-contact-action', 'true');
      await expect(topicButtons.nth(0)).toContainText('Contactos y atención humana');
      await expect(topicButtons.nth(1)).toContainText('Documentación y requisitos');
      await expect(topicButtons.nth(2)).toContainText('Turnos y horarios');

      const rewriteButton = fallback.getByRole('button', { name: 'Escribir la consulta de otra forma' });
      await expect(rewriteButton).toBeVisible();

      // Todos los botones cumplen >= 44px y no hay overflow horizontal.
      const allFallbackButtons = fallback.locator('button');
      const count = await allFallbackButtons.count();
      for (let i = 0; i < count; i += 1) {
        const button = allFallbackButtons.nth(i);
        const box = await button.boundingBox();
        expect(box, `botón ${i} debe ser visible`).not.toBeNull();
        expect(box!.height, `botón ${i} altura >= 44px`).toBeGreaterThanOrEqual(44);
        expect(box!.width, `botón ${i} ancho >= 44px`).toBeGreaterThanOrEqual(44);
      }

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

      // Captura del bloque en el portal mostrando el texto del backend y Otras formas de seguir.
      await notice.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }));
      await maybeCapture(page, `portal-sin-respuesta-${viewport.name}.png`, false);

      // Validación axe AA con el bloque visible.
      await expectNoHighImpactA11yViolations(page);

      // El botón «Escribir la consulta de otra forma» devuelve el foco al campo de texto.
      await rewriteButton.click();
      await expect(composer).toBeFocused();

      // Al elegir la opción de contacto, abre el nodo y desaparece el bloque de respaldo.
      await topicButtons.nth(0).click();
      await expect(assistant.getByRole('heading', { name: CONTACT_NODE.title })).toBeVisible();
      await expect(assistant.getByTestId('institutional-no-answer')).toHaveCount(0);

      // Verificar también el flujo real en el widget flotante en escritorio.
      if (viewport.width === 1440) {
        const launcher = page.locator('.chatboc-toggle-btn').first();
        await expect(launcher).toBeVisible();
        await launcher.click();
        const widget = page.getByTestId('chat-widget');
        await expect(widget).toBeVisible();
        await expect(widget.getByRole('button', { name: /Documentación y requisitos/i })).toBeVisible();

        const widgetInput = widget.locator('input[type="text"], input:not([type]), textarea').first();
        await expect(widgetInput).toBeVisible();
        await widgetInput.fill('Consulta sin respuesta en widget');
        await widgetInput.press('Enter');

        const widgetFallback = widget.getByTestId('institutional-no-answer');
        await expect(widgetFallback).toBeVisible();
        await expect(widgetFallback).toHaveAttribute('aria-live', 'polite');
        await expect(widgetFallback.locator('[aria-live]')).toHaveCount(0);
        await expect(widgetFallback.getByRole('heading', { name: 'Otras formas de seguir' })).toBeVisible();

        const widgetTopicButtons = widgetFallback.locator('[data-no-answer-actions] button');
        await expect(widgetTopicButtons).toHaveCount(3);
        await expect(widgetTopicButtons.nth(0)).toHaveAttribute('data-contact-action', 'true');
        await expect(widgetTopicButtons.nth(0)).toContainText('Contactos y atención humana');
        await expect(widget.locator('[data-institutional-uncovered-text]')).toBeFocused();

        const widgetButtons = widgetFallback.locator('button');
        const widgetButtonCount = await widgetButtons.count();
        for (let i = 0; i < widgetButtonCount; i += 1) {
          const box = await widgetButtons.nth(i).boundingBox();
          expect(box, `botón widget ${i} visible`).not.toBeNull();
          expect(box!.height, `botón widget ${i} altura >= 44px`).toBeGreaterThanOrEqual(44);
          expect(box!.width, `botón widget ${i} ancho >= 44px`).toBeGreaterThanOrEqual(44);
        }

        await maybeCapture(page, 'widget-sin-respuesta-1440px.png', false);
        await expectNoHighImpactA11yViolations(page);

        await widgetFallback.getByRole('button', { name: 'Escribir la consulta de otra forma' }).click();
        await expect(widgetInput).toBeFocused();
      }
    });
  }
});
