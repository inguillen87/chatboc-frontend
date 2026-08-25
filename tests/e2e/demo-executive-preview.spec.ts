import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { expectNoHorizontalOverflow } from './e2e-helpers';

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const executivePreview = {
  contract_version: 'demo.admin_preview.v1',
  presentation_mode: 'executive',
  sector: 'gobierno',
  tenant_slug: 'municipio',
  title: 'Centro de comando ciudadano',
  subtitle: 'Gobierno local',
  description: 'Monitoreo ejecutivo de atención, territorio y participación.',
  modules: [
    { id: 'summary', label: 'Resumen' },
    { id: 'claims', label: 'Reclamos' },
    { id: 'heatmap', label: 'Mapa operativo' },
    { id: 'surveys', label: 'Encuestas' },
  ],
  data_provenance: {
    contract_version: 'demo.executive_provenance.v1',
    mode: 'synthetic_demo_scenario',
    synthetic: true,
    contains_synthetic: true,
    municipal_truth: false,
    suitable_for_product_demonstration: true,
    suitable_for_government_decisions: false,
    label: 'Snapshot ilustrativo para demostrar el producto.',
    scope: 'executive_snapshot',
    scenario_scope: 'Junín, Mendoza',
  },
  metrics: [
    { id: 'claims', label: 'Reclamos ingresados', value: 184, unit: 'casos', period: 'Últimos 30 días' },
    { id: 'sla', label: 'Cumplimiento de SLA', value: 87, unit: '%' },
    { id: 'whatsapp', label: 'Primera respuesta por WhatsApp', value: 3.4, unit: 'min' },
    { id: 'survey', label: 'Participación en encuesta', value: 100, unit: 'votos' },
  ],
  timeline: [
    {
      id: 'timeline-1',
      time: '08:42',
      label: 'Ingreso por WhatsApp',
      detail: 'La IA clasificó y derivó el reclamo.',
      channel: 'WhatsApp',
      status: 'Clasificado',
      data_mode: 'synthetic_demo_scenario',
    },
  ],
  channel_summary: {
    contract_version: 'demo.channel_summary.v1',
    data_mode: 'synthetic_demo_scenario',
    total_interactions: 426,
    label: 'Canales y SLA del escenario',
    channels: [
      { id: 'whatsapp', label: 'WhatsApp', value: 298, share_pct: 70 },
      { id: 'web', label: 'Web', value: 128, share_pct: 30 },
    ],
    whatsapp: {
      conversations: 298,
      first_response_minutes: 3.4,
      resolved_without_handoff_pct: 72,
    },
  },
  cases: [
    {
      id: 'case-1',
      case_code: 'REC-2026-0184',
      title: 'Luminaria sin servicio',
      category: 'Alumbrado',
      status: 'En tratamiento',
      priority: 'Alta',
      channel: 'WhatsApp',
      zone: 'Barrio Norte',
      sla_status: 'Dentro de plazo',
      opened_at_label: 'Ingresó hace 18 min',
      data_mode: 'synthetic_demo_scenario',
    },
  ],
  case_sample: {
    contract_version: 'demo.case_sample.v1',
    sample: true,
    total_cases: 184,
    displayed_cases: 1,
    represented_cases_on_map: 18,
    label: 'Muestra del escenario; no representa el universo municipal.',
  },
  map: {
    enabled: true,
    sample: true,
    displayed_points: 1,
    represented_cases: 18,
    total_cases: 184,
    coverage_note: 'Una zona de muestra representa 18 de 184 reclamos del escenario.',
    title: 'Mapa operativo del escenario',
    label: 'Puntos simulados',
    data_mode: 'synthetic_demo_scenario',
    center: { lat: -33.144539, lng: -68.485729 },
    points: [
      { id: 'point-1', label: 'REC-2026-0184', lat: -33.144539, lng: -68.485729 },
    ],
  },
  survey_voting: {
    contract_version: 'demo.surveys_votings.v1',
    enabled: true,
    demo_mode: true,
    label: 'Encuestas y votaciones',
    description: 'Sondeos ciudadanos con resultados demo.',
    total_available: 6,
    seed_policy: { responses_per_item: 100, real_people: false, deterministic: true },
    items: [{
      id: 'survey-1',
      title: 'Votación de prioridades barriales',
      question: '¿Qué tema debería resolverse primero?',
      status: 'demo_publicada',
      demo_mode: true,
      data_provenance: { mode: 'synthetic', contains_synthetic: true },
      results: {
        total_respuestas: 100,
        options: [
          { label: 'Luminarias', count: 45, porcentaje: 45 },
          { label: 'Bacheo', count: 18, porcentaje: 18 },
          { label: 'Limpieza', count: 25, porcentaje: 25 },
          { label: 'Espacios verdes', count: 12, porcentaje: 12 },
        ],
      },
      links: { public_page_path: '/e/demo-prioridades-barriales' },
    }],
  },
};

type PrepareExecutiveDemoOptions = {
  sessionDelayMs?: number;
};

const prepareExecutiveDemo = async (
  page: Page,
  previewResponse: unknown = executivePreview,
  options: PrepareExecutiveDemoOptions = {},
) => {
  const adminPreviewRequests: string[] = [];

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }
    if (path.endsWith('/api/public/widget-config')) {
      await json(route, {
        contract_version: 'public.widget_config.v1',
        tenant: { slug: 'chatboc-platform', nombre: 'Chatboc' },
        quick_menu: [],
        support_channels: {},
      });
      return;
    }
    if (path.endsWith('/api/v2/demo/whatsapp-sandbox')) {
      await json(route, {
        contract_version: 'demo.whatsapp_sandbox_launcher.v1',
        session: { demo_session_id: 'demo-whatsapp-e2e', chat_session_id: 'sid-whatsapp-e2e' },
        whatsapp_sandbox: { rubro_options: [], scenario_scripts: [], catalog: {} },
      });
      return;
    }
    if (path.endsWith('/api/v2/demo/catalog')) {
      await json(route, {
        contract_version: 'demo.catalog.v2',
        sectors: ['gobierno'],
        sector_groups: [
          {
            key: 'gobierno',
            label: 'Gobiernos',
            description: 'Gestión ciudadana y territorio.',
            cta_label: 'Iniciar demo pública',
            tenant_slug: 'municipio',
          },
        ],
        rubros: [],
      });
      return;
    }
    if (path.endsWith('/api/v2/demo/session')) {
      if (options.sessionDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.sessionDelayMs));
      }
      await json(route, {
        contract_version: 'demo.session.v2',
        demo_session_id: 'demo-government-e2e',
        chat_session_id: 'sid-government-e2e',
        tenant_slug: 'municipio',
        sector: 'gobierno',
        workspace: {
          title: 'Atención ciudadana',
          welcome_message: 'Canal listo para probar.',
          chat_bootstrap: {
            contract_version: 'demo.chat_bootstrap.v1',
            endpoint: '/ask/municipio',
            method: 'POST',
            headers: {
              'X-Chat-Session-Id': 'sid-government-e2e',
              'X-Demo-Session-Id': 'demo-government-e2e',
              'X-Tenant-Slug': 'municipio',
            },
            payload: { pregunta: '', tipo_chat: 'municipio', tenant_slug: 'municipio', demo_mode: true },
            supports: { text: true, image: true, audio: true, location: true, file: true },
          },
        },
      });
      return;
    }
    if (path.endsWith('/api/v2/demo/admin-preview')) {
      adminPreviewRequests.push(request.url());
      await json(route, previewResponse);
      return;
    }
    if (path.includes('/api/rubros/')) {
      await json(route, { rubros: [] });
      return;
    }

    await json(route, {});
  });

  return adminPreviewRequests;
};

test.describe('government executive demo preview', () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps provenance and landmarks explicit at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const adminPreviewRequests = await prepareExecutiveDemo(page);

      await page.goto('/demo', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Gobiernos/i }).click();
      await page.getByRole('button', { name: /Iniciar demo pública/i }).click();

      const panel = page.getByRole('region', { name: 'Centro de comando ciudadano' });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('note', { name: /advertencia sobre los datos/i })).toContainText(
        'Escenario demostrativo · datos simulados',
      );
      await expect(panel.getByText('No representa datos oficiales ni relevamiento municipal.')).toBeVisible();
      await expect(panel.getByRole('heading', { level: 3, name: 'Canales y SLA del escenario' })).toBeVisible();
      await expect(panel.locator('[data-demo-kpi-list]')).toHaveClass(/grid-cols-2/);
      await expect(panel.locator('[data-demo-kpi-list]')).toHaveClass(/2xl:grid-cols-4/);

      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('main main')).toHaveCount(0);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(panel.getByRole('navigation', { name: 'Secciones del panel ejecutivo' })).toBeVisible();
      await expect(panel.getByRole('note', { name: 'Fuentes separadas del panel demostrativo' })).toHaveCount(0);
      expect(adminPreviewRequests.length).toBeGreaterThan(0);
      expect(
        adminPreviewRequests.every(
          (requestUrl) => new URL(requestUrl).searchParams.get('presentation_mode') === 'executive',
        ),
      ).toBe(true);

      await panel.getByRole('button', { name: 'Reclamos', exact: true }).click();
      await expect(panel.getByText('Casos simulados')).toBeVisible();
      await expect(panel.getByText('Muestra visible: 1 de 184 casos del escenario.')).toBeVisible();

      await panel.getByRole('button', { name: 'Mapa operativo', exact: true }).click();
      await expect(panel.getByText('Una zona de muestra representa 18 de 184 reclamos del escenario.')).toBeVisible();
      await expect(panel.getByRole('region', { name: /1 zonas muestran 18 de 184 casos/i })).toBeVisible();

      await panel.getByRole('button', { name: 'Encuestas', exact: true }).click();
      await expect(panel.getByText('Base sintética determinística: las respuestas no pertenecen a personas reales ni representan opinión pública municipal.')).toBeVisible();
      await expect(panel.getByText('Votación de prioridades barriales')).toBeVisible();
      await expect(panel.getByRole('progressbar', { name: 'Luminarias: 45 %' })).toHaveAttribute('aria-valuenow', '45');

      const axe = await new AxeBuilder({ page })
        .include('[data-demo-admin-preview]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('iframe[src*="challenges.cloudflare.com"]')
        .analyze();
      const serious = axe.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.flatMap((violation) =>
          violation.nodes.map((node) => `${violation.id}: ${violation.help} @ ${node.target.join(' ')}`),
        ),
      ).toEqual([]);
    });
  }

  test('reconciles the synthetic base and durable Preview participation without calling it citizen truth', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const baselineSurvey = executivePreview.survey_voting.items[0];
    const partitionedPreview = {
      ...executivePreview,
      survey_voting: {
        ...executivePreview.survey_voting,
        durable_demo_participation: true,
        municipal_truth: false,
        verified_citizen_responses: 0,
        items: [{
          ...baselineSurvey,
          seeded_responses: 100,
          interactive_demo_responses: 2,
          total_respuestas: 102,
          verified_citizen_responses: 0,
          results: {
            ...baselineSurvey.results,
            seeded_responses: 100,
            interactive_demo_responses: 2,
            total_respuestas: 102,
            verified_citizen_responses: 0,
            options: [
              { label: 'Luminarias', count: 47, porcentaje: 46.08 },
              ...baselineSurvey.results.options.slice(1),
            ],
          },
        }],
      },
    };
    await prepareExecutiveDemo(page, partitionedPreview);

    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Gobiernos/i }).click();
    await page.getByRole('button', { name: /Iniciar demo pública/i }).click();

    const panel = page.getByRole('region', { name: 'Centro de comando ciudadano' });
    await panel.getByRole('button', { name: 'Encuestas', exact: true }).click();
    const composition = panel.getByRole('note', {
      name: 'Composición de respuestas de Votación de prioridades barriales',
    });
    await expect(composition).toContainText('100 base sintética + 2 participaciones demo = 102 total');
    await expect(composition).toContainText('0 respuestas ciudadanas verificadas');
    await expect(panel.getByText('102 respuestas demo', { exact: true })).toBeVisible();
    await expect(panel.getByText('102 respuestas sintéticas', { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('preserves the selected executive panel while a delayed session hydrates', async ({ page }) => {
    const adminPreviewRequests = await prepareExecutiveDemo(page, executivePreview, {
      sessionDelayMs: 1_200,
    });
    const sessionBoundPreview = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/api/v2/demo/admin-preview') &&
        url.searchParams.get('chat_session_id') === 'sid-government-e2e' &&
        response.status() === 200
      );
    });

    await page.goto('/demo?sector=gobierno&rubro=municipio&tenant_slug=municipio', {
      waitUntil: 'domcontentloaded',
    });

    const panel = page.getByRole('region', { name: 'Centro de comando ciudadano' });
    await expect(panel).toBeVisible();
    const mapButton = panel.getByRole('button', { name: 'Mapa operativo', exact: true });
    await mapButton.click();
    await expect(mapButton).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('region', { name: /1 zonas muestran 18 de 184 casos/i })).toBeVisible();

    await sessionBoundPreview;
    await expect
      .poll(() =>
        adminPreviewRequests.some((requestUrl) => {
          const url = new URL(requestUrl);
          return url.searchParams.get('chat_session_id') === 'sid-government-e2e';
        }),
      )
      .toBe(true);
    await expect(mapButton).toHaveAttribute('aria-current', 'page');
    await expect(panel.getByRole('region', { name: /1 zonas muestran 18 de 184 casos/i })).toBeVisible();
  });

  test('keeps real session activity separate from the synthetic survey partition', async ({ page }) => {
    const mixedPreview = {
      ...executivePreview,
      data_provenance: {
        ...executivePreview.data_provenance,
        mode: 'mixed_partitioned',
        synthetic: false,
        contains_synthetic: true,
        source_partitions: {
          session_activity: { mode: 'session_generated_events' },
          survey_voting: { mode: 'synthetic_demo_scenario' },
        },
      },
      session_activity: { has_session_data: true, items: [{ id: 'session-case-1' }] },
      metrics: [
        {
          id: 'claims',
          label: 'Reclamos de esta sesión',
          value: 1,
          unit: 'caso',
          data_mode: 'session_generated_events',
        },
        {
          id: 'survey',
          label: 'Participación en encuesta',
          value: 100,
          unit: 'votos',
          data_mode: 'synthetic_demo_scenario',
        },
      ],
      channel_summary: {
        contract_version: 'demo.channel_summary.v1',
        data_mode: 'session_generated_events',
        total_interactions: null,
        total_cases: 1,
        observed_cases: 1,
        note: 'Solo actividad observada en esta sesión.',
        channels: [],
      },
    };
    await prepareExecutiveDemo(page, mixedPreview);

    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Gobiernos/i }).click();
    await page.getByRole('button', { name: /Iniciar demo pública/i }).click();

    const panel = page.getByRole('region', { name: 'Centro de comando ciudadano' });
    const provenance = panel.getByRole('note', { name: 'Fuentes separadas del panel demostrativo' });
    await expect(provenance).toContainText('Actividad de esta sesión + encuesta demo separada');
    await expect(provenance).toContainText('partición sintética separada');
    await expect(panel.getByText('Fuentes separadas')).toBeVisible();
    await expect(panel.getByText('Sesión actual')).toBeVisible();
    await expect(panel.getByText('Demo sintética')).toBeVisible();
    await expect(panel.getByText('100 votos')).toBeVisible();
    await expect(panel.locator('[data-demo-channel-summary]')).toContainText('Casos observados');
    await expect(panel.locator('[data-demo-channel-summary]')).toContainText('1');

    const axe = await new AxeBuilder({ page })
      .include('[data-demo-admin-preview]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = axe.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      serious.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id}: ${violation.help} @ ${node.target.join(' ')}`),
      ),
    ).toEqual([]);
  });
});
