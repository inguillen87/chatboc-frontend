import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow } from './e2e-helpers';

const mockCommonApis = async (page: import('@playwright/test').Page) => {
  await page.route('**/auth/clerk/config*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 'auth.clerk.v1',
        enabled: false,
        environment: 'development',
        production_ready: false,
        ready_for_session_sync: false,
        social_providers: [],
      }),
    });
  });

  await page.route('**/api/public/widget-config*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 'public.widget_config.v1',
        tenant: { slug: 'chatboc-platform', nombre: 'Chatboc' },
        tenant_name: 'Chatboc',
        tipo_chat: 'pyme',
        quick_menu: [],
        support_channels: {
          whatsapp: { enabled: true, realtime_bridge: true },
          voice_call: { enabled: true, label: 'Probar llamada IA' },
        },
      }),
    });
  });

  await page.route('**/api/v2/demo/whatsapp-sandbox*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 'demo.whatsapp_sandbox_launcher.v1',
        requires_auth: false,
        session: {
          demo_session_id: 'demo-whatsapp-e2e',
          chat_session_id: 'sid_whatsapp_e2e',
          max_messages: 10,
        },
        whatsapp_sandbox: {
          contract_version: 'demo.whatsapp_sandbox.v1',
          rubro_options: [
            { id: 'comercio', label: 'Comercio', sector: 'empresas', rubro: 'comercio', description: 'Ventas y atención' },
            { id: 'bodega', label: 'Bodega', sector: 'empresas', rubro: 'bodega', description: 'Pedidos y catálogo' },
            { id: 'restaurant', label: 'Restaurante', sector: 'empresas', rubro: 'restaurant', description: 'Reservas y delivery' },
            { id: 'hotel', label: 'Hotel', sector: 'empresas', rubro: 'hotel', description: 'Reservas y huéspedes' },
            { id: 'municipio', label: 'Municipio', sector: 'gobierno', rubro: 'municipio', description: 'Atención ciudadana' },
          ],
          sandbox: {
            display_number: '+54 9 261 000-0000',
            activation_message: 'Hola, quiero probar la demo',
            requires_join_phrase: false,
            wa_deeplink: 'https://wa.me/5492610000000',
            qr_url: '/favicon/favicon-192x192.png',
          },
          trial_policy: { max_messages: 10, free_inputs: ['text', 'image', 'audio'] },
          scenario_scripts: [{ label: 'Crear pedido', message: 'Quiero pedir dos cajas' }],
          catalog: {},
          surveys_votings: { enabled: false },
        },
      }),
    });
  });

  await page.route('**/api/v2/demo/admin-preview*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/rubros/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rubros: [] }),
    });
  });

  await page.route('**/api/v2/demo/catalog*', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('response_profile')).toBe('selector');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'cache-control': 'public, max-age=300',
        etag: '"demo-selector-e2e"',
      },
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

  await page.route(/.*\/ask(\/.*)?(\?.*)?$/, async (route) => {
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

const openExecutiveConversation = async (page: import('@playwright/test').Page) => {
  const journey = page.getByRole('navigation', { name: 'Vistas de la demo ejecutiva' });
  const overview = journey.getByRole('button', { name: 'Resumen', exact: true });
  const attention = journey.getByRole('button', { name: 'Atención', exact: true });

  await expect(page.getByRole('heading', { name: 'Centro de gestión ciudadana' })).toBeVisible();
  await expect(overview).toHaveAttribute('aria-current', 'page');
  await attention.click();
  await expect(attention).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#demo-conversation-workspace')).toBeVisible();
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

    await expect(page.getByRole('heading', { name: /Converti conversaciones en operaciones reales/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Solicitar demostraci[oó]n/i }).first()).toBeVisible();
    expect(realtimeRequests).toEqual([]);
  });

  test('hero y accesos demo de login permanecen dentro de 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const heroPreview = page.locator('#inicio .chatboc-hero-preview');
    await expect(heroPreview).toBeVisible();
    const heroBox = await heroPreview.boundingBox();

    expect(heroBox).not.toBeNull();
    expect(heroBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((heroBox?.x ?? 0) + (heroBox?.width ?? 0)).toBeLessThanOrEqual(391);
    await expectNoHorizontalOverflow(page);

    await page.goto('/login');
    const demoButtons = page.getByRole('button', { name: /^Abrir Demo (colegio|gobierno|empresa)$/i });
    await expect(demoButtons).toHaveCount(3);

    for (const button of await demoButtons.all()) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(391);
    }
    await expectNoHorizontalOverflow(page);
  });

  test('demo muestra los tres pilares y abre experiencia educativa', async ({ page }) => {
    const catalogRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/api/v2/demo/catalog')) catalogRequests.push(url.toString());
    });

    await page.goto('/demo');

    await expect(page.getByRole('button', { name: /Gobiernos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Empresas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Colegios/i })).toBeVisible();

    await page.getByRole('button', { name: /Colegios/i }).click();
    await page.getByRole('button', { name: /Iniciar demo colegio/i }).click();

    await openExecutiveConversation(page);
    await expect(page.getByText('Demo Workspace', { exact: true })).toBeVisible();
    await expect(page.getByText('Recorrido listo para probar.', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mensaje' })).toBeVisible();
    await expect(page.getByText('Ámbito: Colegio demo', { exact: true })).toBeVisible();
    expect(catalogRequests).toHaveLength(1);
  });

  test('landing y recorrido demo comparten una sola carga del catalogo', async ({ page }) => {
    const catalogRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/api/v2/demo/catalog')) catalogRequests.push(url.toString());
    });

    await page.goto('/');
    const showcase = page.locator('#demos');
    await expect(showcase.getByRole('heading', { name: /Proba una conversacion real por sector/i })).toBeVisible();
    await showcase.getByRole('button', { name: /Iniciar demo colegio/i }).click();

    await expect(page).toHaveURL(/\/demo\?session=/);
    await expect(page.getByRole('heading', { name: 'Centro de gestión ciudadana' })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Vistas de la demo ejecutiva' })
        .getByRole('button', { name: 'Resumen', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    expect(catalogRequests).toHaveLength(1);
  });

  test('sandbox WhatsApp prioriza la accion y compacta perfiles en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/demo');

    const launcher = page.getByRole('region', { name: 'Probar por WhatsApp sin login' });
    await expect(launcher).toBeVisible();
    const profileGroup = launcher.getByRole('group', { name: 'Elegí un perfil' });
    const primaryLink = launcher.getByRole('link', { name: 'Abrir WhatsApp directo' });
    const numberCard = launcher.getByText('Número');

    await expect(primaryLink).toBeVisible();
    await expect(launcher.getByText('Mostrar código QR')).toBeVisible();
    const bodegaOption = profileGroup.getByRole('button', { name: /Bodega/ });
    await expect(bodegaOption).toHaveAttribute('aria-pressed', 'false');
    const selectionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/v2/demo/whatsapp-sandbox'),
    );
    await bodegaOption.click();
    await selectionResponse;
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.sessionStorage.getItem('chatboc_demo_whatsapp_profile_v1');
          return raw ? JSON.parse(raw).key : null;
        }),
      )
      .toBe('bodega');
    await expect(bodegaOption).toHaveAttribute('aria-pressed', 'true');

    await expect(profileGroup).toBeVisible();
    await expect
      .poll(() =>
        profileGroup.evaluate(
          (element) =>
            element.isConnected &&
            element.getClientRects().length > 0 &&
            element.clientHeight > 0 &&
            element.clientHeight < 150 &&
            element.scrollWidth > element.clientWidth,
        ),
      )
      .toBe(true);
    await expect.poll(() => profileGroup.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const [launcherBox, selectedBox] = await Promise.all([
          launcher.boundingBox(),
          bodegaOption.boundingBox(),
        ]);
        if (!launcherBox || !selectedBox) return false;
        const tolerance = 1;
        return (
          selectedBox.x >= launcherBox.x - tolerance &&
          selectedBox.x + selectedBox.width <= launcherBox.x + launcherBox.width + tolerance
        );
      })
      .toBe(true);

    await expect(primaryLink).toBeVisible();
    await expect
      .poll(() =>
        primaryLink.evaluate((element) =>
          element.isConnected && element.getClientRects().length > 0
            ? element.scrollWidth - element.clientWidth
            : Number.POSITIVE_INFINITY,
        ),
      )
      .toBeLessThanOrEqual(1);
    const messageBadge = launcher.getByText('mensajes').locator('..');
    await expect(messageBadge).toBeVisible();
    await expect
      .poll(() =>
        messageBadge.evaluate((element) =>
          element.isConnected && element.getClientRects().length > 0
            ? element.scrollWidth - element.clientWidth
            : Number.POSITIVE_INFINITY,
        ),
      )
      .toBeLessThanOrEqual(1);

    await expect(numberCard).toBeVisible();
    await expect
      .poll(async () => {
        const [linkBox, numberBox] = await Promise.all([primaryLink.boundingBox(), numberCard.boundingBox()]);
        return Boolean(linkBox && numberBox && linkBox.y < numberBox.y);
      })
      .toBe(true);

    const qrImages = launcher.getByAltText('Código QR para abrir la demo de WhatsApp');
    await expect(qrImages).toHaveCount(2);
    await expect(qrImages.first()).toBeHidden();
    await expect(qrImages.last()).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test('demo degrada sin mostrar error crudo cuando falla el chat backend', async ({ page }) => {
    await page.route(/.*\/ask(\/.*)?(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 404, message: 'Not found' } }),
      });
    });

    await page.goto('/demo');
    await page.getByRole('button', { name: /Colegios/i }).click();
    await page.getByRole('button', { name: /Iniciar demo colegio/i }).click();
    await openExecutiveConversation(page);
    const conversation = page.locator('#demo-conversation-workspace');
    await conversation.getByPlaceholder(/Escrib/i).last().fill('Necesito justificar una inasistencia');
    await conversation.getByRole('button', { name: /^Enviar$/i }).click();

    await expect(page.getByText(/No pudimos enviar la consulta a la demo real/i)).toBeVisible();
    await expect(page.getByText(/Error 404/i)).toHaveCount(0);
  });

  test('widget abre desde la landing con controles visibles', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Abrir chat/i }).click();

    const widget = page.getByRole('region', { name: /Chat widget/i });
    const composer = widget.getByRole('textbox', { name: /Escribir mensaje/i });
    const educationSector = widget.getByRole('button', { name: /Colegios/i });
    await expect(composer.or(educationSector)).toBeVisible();
    const composerVisible = await composer.isVisible().catch(() => false);
    const sectorSelectorVisible = await educationSector.isVisible().catch(() => false);

    expect(composerVisible || sectorSelectorVisible).toBeTruthy();

    if (composerVisible) {
      await expect(page.getByRole('button', { name: /WhatsApp/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Probar llamada IA/i })).toBeVisible();
    } else {
      await expect(widget.getByRole('heading', { name: /Qué querés probar/i })).toBeVisible();
      await expect(educationSector).toBeVisible();
      await expect(widget.getByRole('button', { name: /Empresas/i })).toBeVisible();
      await expect(widget.getByRole('button', { name: /Gobiernos/i })).toBeVisible();
    }
  });
});
