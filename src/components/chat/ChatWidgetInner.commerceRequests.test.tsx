import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

const cartCount = vi.hoisted(() => vi.fn((_enabled?: boolean) => 0));

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));
vi.mock('@/utils/widgetTelemetry', () => ({ trackWidgetEvent: vi.fn() }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null, currentSlug: null }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: (enabled?: boolean) => cartCount(enabled) }));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));
vi.mock('./AccessibilityToggle', () => ({ default: () => null, ACCESSIBILITY_EVENT: 'test-a11y', readAccessibilityPrefs: () => ({}) }));
vi.mock('./ChatPanel', () => ({ default: () => <section /> }));

const originalFetch = global.fetch;
const profile = (slug: string, tipo: string) => ({
  contract_version: 'public.widget_config.v1', slug, tenant_name: 'Institución de prueba', tipo_chat: tipo,
  welcome_subtitle: `Asistente ${slug}`, welcome_title: 'Información de prueba',
});
const requestedUrls = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input instanceof Request ? input.url : input));
const cartRequests = () => requestedUrls().filter(url => /cart|carrito/i.test(url));
const mountWidget = async (tipo: string) => {
  vi.spyOn(tenantService, 'getPublicWidgetConfig').mockImplementation(async slug => profile(slug, tipo));
  await act(async () => {
    render(<React.Suspense fallback={null}><MemoryRouter initialEntries={['/t/qa-a']}>
      <ChatWidgetInner mode="standalone" tenantSlug="qa-a" defaultOpen={false} />
    </MemoryRouter></React.Suspense>);
  });
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Abrir el asistente Asistente qa-a' })).toBeInTheDocument());
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
};

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); cartCount.mockClear();
  window.history.replaceState({}, '', '/t/qa-a');
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({ matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  global.fetch = vi.fn().mockImplementation(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.clear(); sessionStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  window.history.replaceState({}, '', '/');
});

describe('cart requests follow the commerce controls', () => {
  it('reads no cart for a government space that publishes no catalog', async () => {
    await mountWidget('municipio');
    expect(cartCount).toHaveBeenCalled();
    expect(cartCount.mock.calls.every(([enabled]) => enabled === false)).toBe(true);
    expect(cartRequests()).toEqual([]);
  });

  it('keeps reading the cart where commerce controls are offered', async () => {
    await mountWidget('pyme');
    expect(cartCount).toHaveBeenLastCalledWith(true);
    expect(cartRequests().some(url => url.includes('/cart/summary'))).toBe(true);
  });
});
