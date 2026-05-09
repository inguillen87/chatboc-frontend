import { test, expect } from '@playwright/test';

const mockCommonApis = async (page: import('@playwright/test').Page) => {
  await page.route('**/api/v2/demo/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 'demo.catalog.v2',
        sectors: ['gobierno', 'empresas', 'educacion'],
        sector_groups: [
          {
            key: 'gobierno',
            label: 'Gobiernos',
            description: 'Municipios, concejos y atencion publica.',
            cta_label: 'Iniciar demo publica',
            tenant_slug: 'municipio-demo',
          },
          {
            key: 'empresas',
            label: 'Empresas',
            description: 'Comercios, servicios y ventas.',
            cta_label: 'Iniciar demo empresa',
            tenant_slug: 'bodega-demo',
          },
          {
            key: 'educacion',
            label: 'Colegios',
            description: 'Instituciones, familias y casos escolares.',
            cta_label: 'Iniciar demo colegio',
            tenant_slug: 'colegio-demo',
          },
        ],
        rubros: [],
      }),
    });
  });

  await page.route('**/api/v2/demo/session', async (route) => {
    const requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 'demo.session.v2',
        demo_session_id: 'demo-e2e-session',
        tenant_slug: requestBody?.tenant_slug || 'colegio-demo',
        workspace: {
          title: 'Demo Workspace',
          welcome_message: 'Recorrido listo para probar.',
          media_capabilities: {
            version: 'media.capabilities.v1',
            input_modes: {
              text: { enabled: true },
              image: { enabled: true },
              audio: { enabled: true },
              location: { enabled: true },
              file: { enabled: true },
            },
          },
          chat_bootstrap: {
            contract_version: 'demo.chat_bootstrap.v1',
            endpoint: '/ask/pyme',
            method: 'POST',
            headers: {
              'X-Chat-Session-Id': 'demo-e2e-session',
              'X-Tenant-Slug': requestBody?.tenant_slug || 'colegio-demo',
            },
            query: { tenant_slug: requestBody?.tenant_slug || 'colegio-demo' },
            payload: {
              pregunta: '',
              tipo_chat: requestBody?.sector === 'gobierno' ? 'municipio' : 'pyme',
              tenant_slug: requestBody?.tenant_slug || 'colegio-demo',
              demo_mode: true,
            },
            supports: { text: true, image: true, audio: true, location: true, file: true },
          },
        },
      }),
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
};

test.describe('Chatboc smoke e2e', () => {
  test.beforeEach(async ({ page }) => {
    await mockCommonApis(page);
  });

  test('landing carga hero principal sin depender de realtime global', async ({ page }) => {
    const realtimeRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/realtime/voice-capabilities')) {
        realtimeRequests.push(request.url());
      }
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Agentes IA para operar conversaciones/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Probar demo/i }).first()).toBeVisible();
    expect(realtimeRequests).toEqual([]);
  });

  test('demo muestra los tres pilares y abre experiencia educativa', async ({ page }) => {
    await page.goto('/demo');

    await expect(page.getByRole('button', { name: /Gobiernos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Empresas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Colegios/i })).toBeVisible();

    await page.getByRole('button', { name: /Colegios/i }).click();
    await page.getByRole('button', { name: /Iniciar demo colegio/i }).click();

    await expect(page.getByRole('heading', { name: /Demo Workspace/i })).toBeVisible();
    await expect(page.getByText(/Catalogo demo/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Descargar PDF/i })).toHaveAttribute('href', /colegio-demo\.pdf/);
  });

  test('demo degrada sin mostrar error crudo cuando falla el chat backend', async ({ page }) => {
    await page.route('**/ask/**', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 404, message: 'Not found' } }),
      });
    });

    await page.goto('/demo');
    await page.getByRole('button', { name: /Colegios/i }).click();
    await page.getByRole('button', { name: /Iniciar demo colegio/i }).click();
    await page.getByPlaceholder(/Escrib/i).last().fill('Necesito justificar una inasistencia');
    await page.getByRole('button', { name: /Enviar mensaje/i }).click();

    await expect(page.getByText(/La demo quedo activa en modo guiado/i)).toBeVisible();
    await expect(page.getByText(/Error 404/i)).toHaveCount(0);
  });

  test('widget abre desde la landing con controles visibles', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Abrir chat/i }).click();

    await expect(page.getByText(/Asistente Virtual/i)).toBeVisible();

    const composer = page.getByRole('textbox', { name: /Escribir mensaje/i });
    const educationSector = page.getByRole('button', { name: /Colegios e instituciones educativas/i });
    const composerVisible = await composer.isVisible().catch(() => false);
    const sectorSelectorVisible = await educationSector.isVisible().catch(() => false);

    expect(composerVisible || sectorSelectorVisible).toBeTruthy();

    if (composerVisible) {
      await expect(page.getByRole('button', { name: /WhatsApp/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Probar llamada IA/i })).toBeVisible();
    } else {
      await expect(educationSector).toBeVisible();
      await expect(page.getByRole('button', { name: /Empresas y comercios/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Gobiernos y sector publico/i })).toBeVisible();
    }
  });
});
