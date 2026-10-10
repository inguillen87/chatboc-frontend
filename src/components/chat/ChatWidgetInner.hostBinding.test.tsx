import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime } from '@/utils/tenantHostBinding';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import ChatWidgetInner from './ChatWidgetInner';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({
  tenant: { slug: 'government-east' }, currentSlug: 'government-east', hostBinding: tenantHostFixture(),
}) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('./ChatPanel', () => ({ default: ({ tenantSlug, ownerToken, welcomeTitle }: { tenantSlug?: string; ownerToken?: string; welcomeTitle?: string }) =>
  <div data-testid="bound-widget">{tenantSlug}:{welcomeTitle}<output>{ownerToken || 'public-scope'}</output></div> }));
vi.mock('./AccessibilityToggle', () => ({ default: () => <button>Accesibilidad</button>, ACCESSIBILITY_EVENT: 'test-a11y', readAccessibilityPrefs: () => ({}) }));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));
beforeEach(() => {
  localStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null }); useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  localStorage.setItem('tenantSlug', 'old-workspace');
  const original = window;
  vi.stubGlobal('window', new Proxy(original, { get(target, key) { return key === 'location'
    ? { hostname: 'atencion.example.test', origin: 'https://atencion.example.test', pathname: '/', search: '', hash: '' } : Reflect.get(target, key); } }));
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(media => ({ matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
  publishTenantHostRuntime(tenantHostFixture());
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
  vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue({ contract_version: 'public.widget_config.v1', slug: 'government-east',
    tenant_name: 'Organización de prueba', tipo_chat: 'municipio', welcome_subtitle: 'Asistente institucional', welcome_title: 'Hola, consultá la información publicada.' });
});
afterEach(() => {
  cleanup(); publishTenantHostRuntime(null); vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.clear(); delete (window as any).CHATBOC_CONFIG;
  usePanelSessionStore.setState({ authToken: null, user: null }); useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
});
describe('widget on an authoritative bound root', () => {
  it('uses the bound slug and public config despite a foreign prop, script and stored selection', async () => {
    (window as any).CHATBOC_CONFIG = { tenantSlug: 'script-workspace', entityToken: 'script-owner' };
    render(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug="foreign-prop" ownerToken="foreign-owner" /></MemoryRouter>);
    await waitFor(() => expect(tenantService.getPublicWidgetConfig).toHaveBeenCalledWith('government-east'));
    expect(await screen.findByTestId('bound-widget')).toHaveTextContent('government-east:Asistente institucional');
    expect(screen.getByTestId('bound-widget')).toHaveTextContent('public-scope');
    expect(tenantService.getPlatformWidgetConfig).not.toHaveBeenCalled();
    expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
    expect(screen.queryByText(/foreign-owner|script-owner|foreign-prop/)).not.toBeInTheDocument();
  });
});
