import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const CAPTURE_DIR = process.env.CORTE17_CAPTURE_DIR?.trim() || '';

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

const AUDIO_COPY = {
  contract_version: 'chatboc.institutional_audio.v1',
  listen: 'Escuchar',
  pause: 'Pausar lectura',
  resume: 'Continuar lectura',
  stop: 'Detener lectura',
  loading: 'Preparando lectura…',
  error: 'No se pudo preparar la lectura.',
  disclosure: 'Voz generada a partir de esta respuesta publicada.',
};

const EASY_READ_COPY = {
  contract_version: 'chatboc.institutional_easy_read.v1',
  action: 'Explicámelo más simple',
  original: 'Ver la versión original',
  loading: 'Preparando una versión más simple…',
  error: 'No se pudo preparar una versión más simple.',
  disclosure: 'Versión simple generada a partir de esta respuesta.',
};

const SOURCE_DOC = {
  id: 'source-qa',
  title: 'Guía institucional de trámites de prueba',
  sha256: SOURCE_SHA,
  page_count: 4,
  pages: [2],
  url: 'https://example.org/documentos/guia-tramites.pdf',
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
    { code: '2', label: 'Canales de atención', target: 'channels' },
  ],
  sources: [SOURCE_DOC],
  links: [],
};

const REQUIREMENTS_NODE = {
  id: 'requirements',
  title: 'Documentación y requisitos de la consulta',
  text: 'Para realizar este trámite de prueba presentá:\n\n• Documento de identidad vigente.\n• Formulario de solicitud completo.\n• Constancia emitida por el área correspondiente.\n\nRecordá verificar los horarios de atención antes de acercarte.',
  actions: [{ code: '9', label: 'Volver al menú principal', target: 'start' }],
  sources: [SOURCE_DOC],
  links: [
    {
      id: 'official-guide',
      label: 'Portal oficial de trámites de prueba',
      url: 'https://example.org/tramites/requisitos',
      review_after: '2099-01-01T00:00:00Z',
    },
  ],
  acronyms: [
    { acronym: 'CUD', expansion: 'Certificado Único de Discapacidad' },
    { acronym: 'DNI', expansion: 'Documento Nacional de Identidad' },
  ],
};

const WORKSPACE_FIXTURE = {
  contract_version: 'chatboc.institutional_assistant.v1',
  tenant: { id: TENANT_ID, slug: TENANT_SLUG, name: 'Organización Institucional de Prueba' },
  revision: REVISION,
  visibility: 'public',
  can_edit: false,
  ui: UI_COPY,
  audio_reading: AUDIO_COPY,
  easy_read: EASY_READ_COPY,
  knowledge: {
    version: '1.0',
    start: 'start',
    node_count: 2,
    topics: [{ id: 'requirements', label: 'Documentación y requisitos' }],
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

const mockInstitutionalPortal = async (page: Page) => {
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

    if (pathname === `/api/public/tenants/${TENANT_SLUG}/institutional-assistant/nodes/requirements`) {
      await json(route, {
        contract_version: 'chatboc.institutional_assistant.v1',
        tenant: { id: TENANT_ID, slug: TENANT_SLUG },
        revision: REVISION,
        nodes: [REQUIREMENTS_NODE],
        text: REQUIREMENTS_NODE.text,
        selection_performed: false,
        business_writes_performed: false,
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

test.describe('Corte 17 · Compartir por WhatsApp e imprimir respuesta institucional', () => {
  for (const viewport of [
    { name: '390px', width: 390, height: 844 },
    { name: '1440px', width: 1440, height: 900 },
  ]) {
    test(`muestra ambos botones (>= 44px, foco visible, axe AA) y valida WhatsApp e impresión a ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('theme', 'light');
        const opened: Array<{ url: string; target?: string; features?: string }> = [];
        let printCalls = 0;
        (window as unknown as Record<string, unknown>).__corte17Opened = opened;
        (window as unknown as Record<string, unknown>).__corte17GetPrintCalls = () => printCalls;
        window.open = ((url?: string | URL, target?: string, features?: string) => {
          opened.push({ url: String(url ?? ''), target, features });
          return null;
        }) as typeof window.open;
        window.print = () => {
          printCalls += 1;
        };
      });

      await mockInstitutionalPortal(page);

      await page.goto(`/t/${TENANT_SLUG}`, { waitUntil: 'domcontentloaded' });
      const assistant = page.getByTestId('institutional-assistant');
      await expect(assistant).toBeVisible();

      // Abrir tema desde el menú inicial
      const topicButton = assistant.getByRole('button', { name: /Documentación y requisitos/i });
      await expect(topicButton).toBeVisible();
      await topicButton.click();

      await expect(assistant.getByRole('heading', { name: REQUIREMENTS_NODE.title })).toBeVisible();

      const whatsappBtn = assistant.getByRole('button', { name: 'Enviar por WhatsApp' });
      const printBtn = assistant.getByRole('button', { name: 'Imprimir o guardar en PDF' });
      await expect(whatsappBtn).toBeVisible();
      await expect(printBtn).toBeVisible();

      // Verificar tamaño táctil >= 44 px y que sean <button> reales sin overflow horizontal
      for (const [label, locator] of [
        ['Enviar por WhatsApp', whatsappBtn],
        ['Imprimir o guardar en PDF', printBtn],
      ] as const) {
        const tagName = await locator.evaluate((el) => el.tagName);
        expect(tagName, `${label} debe ser un <button> real`).toBe('BUTTON');
        const box = await locator.boundingBox();
        expect(box, `${label} debe tener caja visible`).not.toBeNull();
        expect(box!.height, `${label} altura >= 44px`).toBeGreaterThanOrEqual(44);
        expect(box!.width, `${label} ancho >= 44px`).toBeGreaterThanOrEqual(44);
      }

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

      // Foco visible al enfocar por teclado
      await whatsappBtn.focus();
      await expect(whatsappBtn).toBeFocused();
      await printBtn.focus();
      await expect(printBtn).toBeFocused();

      // Captura de los botones junto a Escuchar y Explicámelo más simple
      await whatsappBtn.scrollIntoViewIfNeeded();
      await maybeCapture(page, `botones-${viewport.name}.png`, false);

      // Verificar axe AA con los dos botones visibles
      await expectNoHighImpactA11yViolations(page);

      // Verificar acción Enviar por WhatsApp
      await whatsappBtn.click();
      const opened = await page.evaluate(
        () => (window as unknown as { __corte17Opened: Array<{ url: string; target?: string; features?: string }> }).__corte17Opened,
      );
      expect(opened).toHaveLength(1);
      expect(opened[0].url.startsWith('https://wa.me/?text=')).toBe(true);
      expect(opened[0].target).toBe('_blank');
      expect(opened[0].features).toBe('noopener,noreferrer');
      const decodedWa = decodeURIComponent(opened[0].url.slice('https://wa.me/?text='.length));
      expect(decodedWa).toContain(REQUIREMENTS_NODE.title);
      expect(decodedWa).toContain('Documento de identidad vigente.');
      expect(decodedWa).toContain('CUD: Certificado Único de Discapacidad');
      expect(decodedWa).toContain('https://example.org/tramites/requisitos');
      expect(decodedWa).toContain(`/t/${TENANT_SLUG}?tema=requirements`);

      // Verificar acción Imprimir o guardar en PDF
      await printBtn.click();
      const printCalls = await page.evaluate(
        () => (window as unknown as { __corte17GetPrintCalls: () => number }).__corte17GetPrintCalls(),
      );
      expect(printCalls).toBe(1);

      // Verificar hoja de impresión (@media print) en escritorio
      if (viewport.width === 1440) {
        await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });

        const printAudit = await page.evaluate(() => {
          const visible = (selector: string) => {
            const el = document.querySelector<HTMLElement>(selector);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          };
          const prose = document.querySelector<HTMLElement>('.institutional-assistant__prose p');
          const disclaimer = document.querySelector<HTMLElement>('.institutional-assistant__print-disclaimer');
          const printDate = document.querySelector<HTMLElement>('.institutional-assistant__print-date');
          const linkAfter = document.querySelector<HTMLElement>('.institutional-assistant__links a');
          return {
            headerVisible: visible('.institutional-assistant__header'),
            logoVisible: visible('.institutional-assistant__mark'),
            proseVisible: visible('.institutional-assistant__prose'),
            acronymsVisible: visible('.institutional-acronyms'),
            linksVisible: visible('.institutional-assistant__links'),
            citationsVisible: visible('.institutional-assistant__citations'),
            printFooterVisible: visible('.institutional-assistant__print-footer'),
            actionsHidden: !visible('.institutional-answer-actions'),
            composerHidden: !visible('.institutional-assistant__composer'),
            audioHidden: !visible('.institutional-response-audio'),
            choicesHidden: !visible('.institutional-assistant__choices'),
            a11yDockHidden: !visible('.chatboc-a11y-dock'),
            widgetHidden: !visible('.chatboc-container'),
            navbarHidden: !visible('.chatboc-brand-navbar'),
            proseFontPx: prose ? parseFloat(window.getComputedStyle(prose).fontSize) : 0,
            proseColor: prose ? window.getComputedStyle(prose).color : '',
            disclaimerFontPx: disclaimer ? parseFloat(window.getComputedStyle(disclaimer).fontSize) : 0,
            disclaimerText: disclaimer?.textContent?.trim() ?? '',
            printDateText: printDate?.textContent?.trim() ?? '',
            linkAfterContent: linkAfter ? window.getComputedStyle(linkAfter, '::after').content : '',
          };
        });

        expect(printAudit.headerVisible).toBe(true);
        expect(printAudit.logoVisible).toBe(true);
        expect(printAudit.proseVisible).toBe(true);
        expect(printAudit.acronymsVisible).toBe(true);
        expect(printAudit.linksVisible).toBe(true);
        expect(printAudit.citationsVisible).toBe(true);
        expect(printAudit.printFooterVisible).toBe(true);
        expect(printAudit.actionsHidden).toBe(true);
        expect(printAudit.composerHidden).toBe(true);
        expect(printAudit.audioHidden).toBe(true);
        expect(printAudit.choicesHidden).toBe(true);
        expect(printAudit.a11yDockHidden).toBe(true);
        expect(printAudit.widgetHidden).toBe(true);
        expect(printAudit.navbarHidden).toBe(true);
        // 12pt == 16px en CSS
        expect(printAudit.proseFontPx).toBeGreaterThanOrEqual(15.5);
        expect(printAudit.disclaimerFontPx).toBeGreaterThanOrEqual(15.5);
        expect(printAudit.proseColor).toBe('rgb(0, 0, 0)');
        expect(printAudit.disclaimerText).toBe('Información orientativa. Confirmá los requisitos con el organismo');
        expect(printAudit.printDateText).toMatch(/^Fecha de impresión:/);
        expect(printAudit.linkAfterContent).toContain('https://example.org/tramites/requisitos');

        await maybeCapture(page, 'vista-impresion.png', true);
      }
    });
  }
});
