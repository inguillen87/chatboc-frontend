import { test, expect } from '@playwright/test';

const mockCommonApis = async (page: import('@playwright/test').Page) => {
  await page.route('**/api/v2/demo/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sectors: ['gobierno', 'empresas'],
        rubros: [
          { id: 'municipio', nombre: 'Municipio' },
          { id: 'comercio', nombre: 'Comercio' },
        ],
      }),
    });
  });

  await page.route('**/api/v2/demo/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ demo_session_id: 'demo-e2e-session' }),
    });
  });

  await page.route('**/ask/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        respuesta_usuario: 'Respuesta demo mock',
        contexto_actualizado: {},
        botones: [{ texto: 'Consultar estado', action: 'check_status' }],
      }),
    });
  });

  await page.route('**/api/v2/tickets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route('**/api/v2/analytics/overview**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: 12,
        open_tickets: 2,
        overdue_tickets: 1,
        response_time: '2m',
        survey_responses: 8,
        nps: 65,
      }),
    });
  });

  await page.route('**/api/v2/surveys/draft', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/login**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Credenciales inválidas (mock)' }),
    });
  });
};

test.describe('Chatboc smoke e2e', () => {
  test.beforeEach(async ({ page }) => {
    await mockCommonApis(page);
  });

  test('demo público (gobierno) abre chat y envía mensaje', async ({ page }) => {
    await page.goto('/demo');

    await page.getByRole('button', { name: /Gobierno/i }).click();
    await page.getByRole('button', { name: /Municipio/i }).first().click();

    await expect(page.getByLabel('Panel de chat')).toBeVisible();
    await page.getByRole('button', { name: /Quiero hacer un reclamo/i }).click();
    await expect(page.getByText('Quiero hacer un reclamo')).toBeVisible();
  });

  test('demo pyme muestra quick replies comerciales', async ({ page }) => {
    await page.goto('/demo');

    await page.getByRole('button', { name: /Empresas/i }).click();
    await page.getByRole('button', { name: /Comercio/i }).first().click();

    await expect(page.getByRole('button', { name: /Consultar precios/i })).toBeVisible();
    await page.getByRole('button', { name: /Pedir presupuesto/i }).click();
    await expect(page.getByText('Pedir presupuesto')).toBeVisible();
  });

  test('login panel con credenciales inválidas muestra error', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill('invalid@example.com');
    await page.getByPlaceholder(/contraseña|password/i).fill('wrong-password');
    await page.getByRole('button', { name: /ingresar|iniciar sesión|login/i }).first().click();

    await expect(page.getByText(/credenciales inválidas|error/i)).toBeVisible();
  });

  test('tickets muestra estado vacío profesional', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByText(/Sin tickets para mostrar|tickets/i)).toBeVisible();
  });

  test('surveys carga builder base', async ({ page }) => {
    await page.goto('/surveys');
    await expect(page.getByText(/Survey Builder/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Guardar draft/i })).toBeVisible();
  });

  test('widget abre y cierra en página principal', async ({ page }) => {
    await page.goto('/');

    const widgetButton = page.locator('.chatboc-toggle-btn').first();
    await expect(widgetButton).toBeVisible({ timeout: 10_000 });
    await widgetButton.click();

    await expect(page.locator('.chatboc-widget-window')).toBeVisible();

    const closeButton = page.getByRole('button', { name: /cerrar/i }).first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await widgetButton.click();
    }
  });
});
