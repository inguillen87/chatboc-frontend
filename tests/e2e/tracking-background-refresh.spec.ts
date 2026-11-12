import { expect, test, type Route } from '@playwright/test';
import { E2E_VIEWPORTS } from './e2e-helpers';

// Synthetic transport, real page and native browser focus. No production reads
// or message writes are needed to reproduce a polling interruption.
const trackingPayload = {
  contract_version: 'tracking.experience.v1',
  kind: 'claim',
  tenant: { slug: 'qa-tracking-continuity', nombre: 'Organización de prueba' },
  resource: { code: 'M-qa-continuity', subject: 'Seguimiento de prueba', category: 'Solicitud', channel: 'web' },
  status: { current_stage: 'asignado', label: 'Asignado' },
  milestones: [{ key: 'recibido', label: 'Recibido' }, { key: 'asignado', label: 'Asignado' }],
  timeline: [{ id: 'received', label: 'Solicitud recibida', timestamp: '2026-11-12T12:00:00Z' }],
  map: { can_render: false },
  support: {
    enabled: true,
    mode: 'offline',
    live_chat: { enabled: true, available: false, mode: 'offline' },
    ticket: { id: 421, requires_pin: true },
    endpoints: { send_message: '/api/public/tracking/claims/421/messages' },
    service_window: { accepts_messages: true, offline_queue_enabled: true },
    conversation: { messages: [] },
    polling: { interval_ms: 15_000 },
    socket: { enabled: false },
  },
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

for (const viewport of E2E_VIEWPORTS) {
  test(`automatic refresh preserves native composer focus on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.install();
    let trackingReads = 0;
    let pendingRefresh: Route | undefined;
    const writes: string[] = [];
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType())) {
        await route.continue();
        return;
      }
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET') writes.push(path);
      if (path.endsWith('/api/public/tracking/experience')) {
        trackingReads += 1;
        if (trackingReads === 1) await json(route, trackingPayload);
        else pendingRefresh = route;
        return;
      }
      if (path.endsWith('/auth/clerk/config')) {
        await json(route, { enabled: false, publishable_key: '', social_providers: [] });
        return;
      }
      await json(route, {});
    });
    await page.goto('/tracking/claim?code=M-qa-continuity&tenant_slug=qa-tracking-continuity#pin=888888', {
      waitUntil: 'domcontentloaded',
    });

    const composer = page.getByRole('textbox', { name: 'Mensaje para la mesa de ayuda' });
    await expect(composer).toBeVisible();
    await composer.fill('Estoy describiendo el problema');
    await composer.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(6, 17));
    const originalComposer = await composer.elementHandle();
    await expect(composer).toBeFocused();

    await page.clock.runFor(15_000);
    await expect.poll(() => trackingReads).toBe(2);
    await expect(page.getByText('Consultando seguimiento…')).toBeAttached();
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    expect(await originalComposer!.evaluate(element => element.isConnected)).toBe(true);
    expect(await composer.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([6, 17]);
    await expect(composer).toHaveValue('Estoy describiendo el problema');

    await json(pendingRefresh!, { ...trackingPayload, status: { current_stage: 'asignado', label: 'Asignado al equipo' } });
    await expect(page.getByText('Consultando seguimiento…')).toHaveCount(0);
    await expect(composer).toBeFocused();
    expect(await originalComposer!.evaluate(element => element.isConnected)).toBe(true);
    expect(await composer.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([6, 17]);
    await expect(composer).toHaveValue('Estoy describiendo el problema');
    expect(writes).toEqual([]);
  });
}
