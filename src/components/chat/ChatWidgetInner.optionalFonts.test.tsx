import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import { tenantService } from '@/services/tenantService';
import { resetOptionalFontsForTests } from '@/utils/optionalFonts';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

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
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));
vi.mock('./AccessibilityToggle', () => ({ default: () => null, ACCESSIBILITY_EVENT: 'test-a11y', readAccessibilityPrefs: () => ({}) }));
vi.mock('./ChatPanel', () => ({ default: () => <section /> }));

const originalFetch = global.fetch;
const links = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[data-optional-font]')].map(link => link.dataset.optionalFont);
const mount = async (fontFamily?: string) => {
  await act(async () => {
    render(<React.Suspense fallback={null}><MemoryRouter initialEntries={['/t/qa-a']}>
      <ChatWidgetInner mode="standalone" tenantSlug="qa-a" defaultOpen={false} primaryColor="#123456" {...(fontFamily ? { fontFamily } : {})} />
    </MemoryRouter></React.Suspense>);
  });
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Abrir el asistente Asistente qa-a' })).toBeInTheDocument());
};

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, '', '/t/qa-a');
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({ matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
  vi.spyOn(tenantService, 'getPublicWidgetConfig').mockImplementation(async slug => ({
    contract_version: 'public.widget_config.v1', slug, tenant_name: 'Institución de prueba', tipo_chat: 'municipio',
    welcome_subtitle: `Asistente ${slug}`, welcome_title: 'Información de prueba',
  }) as never);
});
afterEach(() => {
  cleanup(); global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.head.querySelectorAll('link[data-optional-font]').forEach(link => link.remove());
  resetOptionalFontsForTests();
  window.history.replaceState({}, '', '/');
});

describe('widget typeface requests', () => {
  it('requests no optional typeface for a widget with the default face', async () => {
    await mount();
    expect(links()).toEqual([]);
  });
  it('requests only the typeface the organization configured', async () => {
    await mount('Montserrat');
    await vi.waitFor(() => expect(links()).toEqual(['Montserrat']));
  });
});
