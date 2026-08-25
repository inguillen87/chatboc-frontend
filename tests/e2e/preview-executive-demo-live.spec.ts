import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './e2e-helpers';

const previewQaEnabled = process.env.CHATBOC_REMOTE_PREVIEW_QA === '1';
const previewOrigin = process.env.PLAYWRIGHT_BASE_URL || 'https://chatboc-r2-preview.vercel.app';
const expectedHost = process.env.CHATBOC_PREVIEW_FRONTEND_HOST || 'chatboc-r2-preview.vercel.app';
const remoteTimeout = 120_000;

test.describe('remote Preview executive government demo', () => {
  test.skip(!previewQaEnabled, 'Runs only against the explicit Vercel Preview QA target.');

  test('reconciles provenance, cases, territorial sample and survey results against the live backend', async ({ page }) => {
    test.setTimeout(300_000);
    const target = new URL(previewOrigin);
    expect(target.protocol).toBe('https:');
    expect(target.hostname).toBe(expectedHost);
    expect(target.hostname.endsWith('.vercel.app')).toBe(true);

    const browserErrors: string[] = [];
    const apiFailures: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.host === target.host && url.pathname.startsWith('/api/') && response.status() >= 400) {
        apiFailures.push(`${response.status()} ${url.pathname}`);
      }
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    const adminPreviewResponse = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/api/v2/demo/admin-preview' &&
          url.searchParams.get('presentation_mode') === 'executive' &&
          response.status() === 200
        );
      },
      { timeout: remoteTimeout },
    );
    const url = new URL('/demo', target);
    url.searchParams.set('sector', 'gobierno');
    url.searchParams.set('rubro', 'municipio');
    url.searchParams.set('tenant_slug', 'junin');
    url.searchParams.set('remote_preview_qa', '1');
    const navigation = await page.goto(url.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: remoteTimeout,
    });
    expect(navigation?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Probá una conversación real y mirá qué queda listo para operar.' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Elegí una operación real para probar' })).toHaveCount(0);

    const response = await adminPreviewResponse;
    const payload = await response.json();
    expect(payload.contract_version).toBe('demo.admin_preview.v1');
    expect(payload.presentation_mode).toBe('executive');
    expect(payload.data_provenance).toMatchObject({
      mode: 'synthetic_demo_scenario',
      synthetic: true,
      contains_synthetic: true,
      municipal_truth: false,
      requested_tenant_slug: 'junin',
      scenario_scope: 'Junín, Mendoza',
    });
    expect(payload.metrics.find((metric: { id?: string }) => metric.id === 'survey_valid_votes')?.value).toBe(
      payload.survey_voting.items[0].results.total_respuestas,
    );
    const firstSurveyOptions = payload.survey_voting.items[0].results.options as Array<{
      label: string;
      count: number;
      porcentaje: number;
    }>;
    const topSurveyOption = [...firstSurveyOptions].sort((left, right) => right.count - left.count)[0];

    const panel = page.getByRole('region', { name: 'Panel demo para gestion ciudadana' });
    await expect(panel).toBeVisible({ timeout: remoteTimeout });
    await expect(panel.getByRole('note', { name: /advertencia sobre los datos/i })).toContainText(
      'Escenario demostrativo · datos simulados',
    );
    await expect(panel.getByRole('note', { name: 'Fuentes separadas del panel demostrativo' })).toHaveCount(0);
    await expect(panel.getByText('184 casos')).toBeVisible();
    await expect(panel.getByText('100 respuestas sintéticas', { exact: true })).toBeVisible();

    await panel.getByRole('button', { name: 'Reclamos', exact: true }).click();
    await expect(panel.getByText('Casos simulados')).toBeVisible();
    await expect(panel.getByText('Muestra visible: 5 de 184 casos del escenario.')).toBeVisible();
    await expect(panel.getByText('JN-DEMO-1042')).toBeVisible();

    await panel.getByRole('button', { name: 'Mapa demostrativo', exact: true }).click();
    await expect(panel.getByRole('heading', { level: 3, name: 'Mapa demostrativo de demanda ciudadana' })).toBeVisible();
    await expect(panel.getByRole('region', { name: /5 zonas muestran 52 de 184 casos/i })).toBeVisible();
    await expect(panel.getByText(/Cinco zonas de muestra representan 52 de 184 reclamos/i)).toBeVisible();
    await expect(panel.getByText('Revisión de señalización')).toBeVisible();

    await panel.getByRole('button', { name: 'Encuestas', exact: true }).click();
    await expect(panel.getByText('6 encuestas demo')).toBeVisible();
    await expect(panel.getByText('Votacion de prioridades barriales')).toBeVisible();
    await expect(
      panel.locator('[data-demo-survey-voting] article').first().getByRole('progressbar', {
        name: new RegExp(`^${topSurveyOption.label}:`),
      }),
    ).toHaveAttribute('aria-valuenow', String(Math.round(topSurveyOption.porcentaje)));
    await expect(panel.getByRole('link', { name: 'Abrir encuesta demo' })).toHaveCount(5);

    const accessibility = await new AxeBuilder({ page })
      .include('[data-demo-admin-preview]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      accessibility.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`)),
    ).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expect(panel.getByRole('heading', { level: 3, name: 'Encuestas y votaciones' })).toBeVisible();
    expect(apiFailures, apiFailures.join('\n')).toEqual([]);
    expect(browserErrors, browserErrors.join('\n')).toEqual([]);
  });
});
