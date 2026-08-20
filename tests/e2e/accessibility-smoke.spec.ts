import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const SURVEY_SLUG = 'consulta-accesible';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockPublicApis = async (page: Page) => {
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    const path = new URL(request.url()).pathname.toLowerCase();
    if (path.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }
    if (path.includes('/pwa/public/tenant-info')) {
      await json(route, { slug: 'junin', nombre: 'Municipalidad de Junín', tipo: 'municipio' });
      return;
    }
    if (path === `/api/v2/public/surveys/${SURVEY_SLUG}`) {
      await json(route, {
        contract_version: 'encuestas.public.v1',
        instrument_revision: 1,
        slug: SURVEY_SLUG,
        titulo: 'Consulta ciudadana accesible',
        descripcion: 'Elegí la prioridad que considerás más importante.',
        tipo: 'encuesta',
        inicio_at: '2026-01-01T00:00:00Z',
        fin_at: '2026-12-31T23:59:59Z',
        politica_unicidad: 'libre',
        anonimo_permitido: true,
        preguntas: [
          {
            id: 101,
            orden: 1,
            tipo: 'opcion_unica',
            texto: '¿Qué servicio deberíamos priorizar?',
            obligatoria: true,
            opciones: [
              { id: 'alumbrado', orden: 1, texto: 'Alumbrado público' },
              { id: 'calles', orden: 2, texto: 'Mantenimiento de calles' },
            ],
          },
        ],
      });
      return;
    }
    if (path === '/api/public/widget-config') {
      await json(route, {
        contract_version: 'public.widget_config.v1',
        tenant: { slug: 'chatboc-platform', nombre: 'Chatboc' },
        quick_menu: [],
        support_channels: {},
      });
      return;
    }

    await json(route, {});
  });
};

const expectNoHighImpactAccessibilityViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Turnstile is a cross-origin security control owned by Cloudflare. The
    // host document remains in scope; only that third-party iframe is excluded.
    .exclude('iframe[src*="challenges.cloudflare.com"]')
    .analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  const summaries = violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
  );

  expect(
    summaries,
    summaries.join('\n'),
  ).toEqual([]);
};

test.describe('public accessibility smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await mockPublicApis(page);
  });

  test('landing has no critical or serious WCAG violations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Converti conversaciones en operaciones reales/i })).toBeVisible();

    await expectNoHighImpactAccessibilityViolations(page);
  });

  test('public survey has no critical or serious WCAG violations', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`/e/${SURVEY_SLUG}?tenant_slug=junin`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Consulta ciudadana accesible' })).toBeVisible();

    await expectNoHighImpactAccessibilityViolations(page);
  });
});
