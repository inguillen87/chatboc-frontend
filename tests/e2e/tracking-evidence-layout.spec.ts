import { expect, test, type Page, type Route } from '@playwright/test';

const trackingPayload = {
  contract_version: 'tracking.experience.v1',
  request_id: 'req-evidence-e2e',
  kind: 'claim',
  tenant: { slug: 'junin', nombre: 'Municipalidad de Junin' },
  resource: {
    code: 'M-123456',
    subject: 'Arreglo de calle',
    category: 'Arreglo de calle',
    channel: 'WhatsApp',
    created_at: '17 de julio, 10:30',
    updated_at: '17 de julio, 10:42',
  },
  status: {
    current_stage: 'en_proceso',
    label: 'En proceso',
    detail: 'El equipo municipal esta revisando la evidencia recibida.',
  },
  location: { address: 'Don Bosco 55, Junin, Mendoza, AR' },
  milestones: [
    { key: 'recibido', label: 'Recibido' },
    { key: 'en_proceso', label: 'En proceso' },
    { key: 'resuelto', label: 'Resuelto' },
  ],
  timeline: [
    {
      id: 'created',
      label: 'Ticket creado',
      detail: 'Reclamo recibido por WhatsApp.',
      timestamp: '17 de julio, 10:30',
    },
    {
      id: 'evidence',
      label: 'Evidencia incorporada',
      detail: 'Se agregaron 2 archivos al historial.',
      timestamp: '17 de julio, 10:42',
    },
  ],
  attachments: [
    {
      id: 91,
      name: 'bache-frente-casa.jpg',
      url: 'tenant/junin/private/bache-frente-casa.jpg',
      download_url: 'https://signed.example/bache-frente-casa.jpg?token=safe',
      thumbnail_url: 'https://signed.example/bache-thumb.webp?token=safe',
      mime_type: 'image/jpeg',
      size: 248_576,
      source: 'whatsapp_flow',
      storage_access: 'signed',
      status: 'ready',
    },
    {
      id: 92,
      name: 'nota-del-vecino.pdf',
      url: 'tenant/junin/private/nota-del-vecino.pdf',
      download_url: 'https://signed.example/nota-del-vecino.pdf?token=safe',
      mime_type: 'application/pdf',
      size: 821_248,
      source: 'whatsapp_flow',
      storage_access: 'signed',
      status: 'ready',
    },
  ],
  map: { can_render: false, fallback_when_no_coordinates: 'timeline_only' },
  support: {
    enabled: true,
    mode: 'offline',
    availability: {
      label: 'Mesa de ayuda offline',
      description: 'Deja un mensaje asociado a este ticket.',
    },
    live_chat: { enabled: true, available: false, mode: 'offline' },
    ticket: { id: 42, requires_pin: true },
    endpoints: { send_message: '/api/public/tracking/claims/42/messages' },
    service_window: {
      accepts_messages: true,
      offline_queue_enabled: true,
      next_action: 'queue_ticket_comment',
    },
    webview_policy: { stay_inside_tracking: true, external_redirect_required: false },
    conversation: { messages: [] },
    polling: { interval_ms: 60_000 },
    socket: { enabled: false },
  },
};

const evidencePreview = `
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="#dce8df"/>
    <rect y="315" width="960" height="225" fill="#596168"/>
    <path d="M80 430 C260 335 490 520 880 370" fill="none" stroke="#2c3135" stroke-width="95"/>
    <ellipse cx="488" cy="425" rx="95" ry="48" fill="#191d20"/>
    <text x="48" y="70" fill="#163525" font-size="32" font-family="Arial">Evidencia del reclamo</text>
  </svg>
`;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockTrackingApis = async (page: Page) => {
  await page.route('https://signed.example/bache-thumb.webp?token=safe', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: evidencePreview }),
  );
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }
    const path = new URL(request.url()).pathname.toLowerCase();
    if (path.endsWith('/api/public/tracking/experience')) {
      await json(route, trackingPayload);
      return;
    }
    if (path.endsWith('/auth/clerk/config')) {
      await json(route, { enabled: false, publishable_key: '', social_providers: [] });
      return;
    }
    await json(route, {});
  });
};

for (const viewport of [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
]) {
  test(`claim evidence stays readable on ${viewport.label}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockTrackingApis(page);
    await page.goto('/tracking/claim?code=M-123456&pin=654321&tenant_slug=junin', {
      waitUntil: 'domcontentloaded',
    });

    const evidence = page.getByTestId('tracking-evidence');
    await expect(evidence).toBeVisible();
    await expect(evidence.getByRole('heading', { name: 'Evidencia del reclamo' })).toBeVisible();
    await expect(evidence.getByText('bache-frente-casa.jpg', { exact: true })).toBeVisible();
    await expect(evidence.getByText('nota-del-vecino.pdf', { exact: true })).toBeVisible();
    await expect(evidence.getByText(/^Enviado por WhatsApp/)).toHaveCount(2);
    await expect(evidence.getByText('Acceso seguro', { exact: true })).toHaveCount(2);
    await expect(evidence.getByRole('link', { name: 'Abrir bache-frente-casa.jpg' })).toHaveAttribute(
      'href',
      'https://signed.example/bache-frente-casa.jpg?token=safe',
    );
    await expect(page.getByText('tenant/junin/private/bache-frente-casa.jpg')).toHaveCount(0);

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      evidenceRect: document.querySelector('[data-testid="tracking-evidence"]')?.getBoundingClientRect(),
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.evidenceRect?.width || 0).toBeGreaterThan(0);
    expect(layout.evidenceRect?.left || 0).toBeGreaterThanOrEqual(0);
    expect(layout.evidenceRect?.right || 0).toBeLessThanOrEqual(viewport.width + 1);

    await page.screenshot({
      path: testInfo.outputPath(`tracking-evidence-${viewport.label}.png`),
      fullPage: true,
    });
  });
}
