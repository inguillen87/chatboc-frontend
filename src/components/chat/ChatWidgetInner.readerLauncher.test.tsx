import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import ProactiveBubble from './ProactiveBubble';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
// The signal a published reader leaves on the page (see InstitutionalAssistant).
const hasEmbeddedInstitutionalReader = () => document.documentElement.hasAttribute('data-embedded-institutional-reader');
const registerEmbeddedInstitutionalReader = () => {
  const root = document.documentElement, announce = () => window.dispatchEvent(new Event('chatboc:embedded-institutional-reader'));
  root.dataset.embeddedInstitutionalReader = '1'; announce();
  return () => { delete root.dataset.embeddedInstitutionalReader; announce(); };
};

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
vi.mock('./ChatPanel', () => ({ default: ({ onClose }: { onClose: () => void }) => <section><button onClick={onClose}>Cerrar panel de prueba</button><input aria-label="Campo interno de prueba" /></section> }));

const originalFetch = global.fetch;
const originalWidth = window.innerWidth;
const greeting = 'Mensaje de ayuda publicado por la organización';
const profile = (slug: string, force = false) => ({
  contract_version: 'public.widget_config.v1', slug, tenant_name: 'Institución de prueba', tipo_chat: 'municipio',
  welcome_subtitle: `Asistente ${slug}`, welcome_title: 'Información de prueba', force_proactive: force,
  cta_messages: [{ text: greeting, action: 'trigger_intent', payload: 'backend-intent-unchanged' }],
});
const tick = (milliseconds: number) => act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
const launcher = (slug = 'qa-a') => screen.getByRole('button', { name: `Abrir el asistente Asistente ${slug}` });
const closeGreeting = () => screen.getByRole('button', { name: 'Cerrar sugerencia', exact: true });
const widgetTree = (slug: string, mode: 'standalone' | 'iframe' = 'standalone') => (
  <React.Suspense fallback={null}><MemoryRouter initialEntries={['/t/qa-a']}>
    <form><label htmlFor="external-editor">Descripción externa</label><textarea id="external-editor" /></form>
    <ChatWidgetInner mode={mode} tenantSlug={slug} defaultOpen={false} />
  </MemoryRouter></React.Suspense>
);
const mountWidget = async (mode: 'standalone' | 'iframe' = 'standalone', slug = 'qa-a') => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(widgetTree(slug, mode)); });
  await vi.waitFor(() => expect(launcher(slug)).toBeInTheDocument());
  return view;
};

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, '', '/t/qa-a');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({ matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
  vi.spyOn(tenantService, 'getPublicWidgetConfig').mockImplementation(async slug => profile(slug));
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.clear(); sessionStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  window.history.replaceState({}, '', '/');
});

describe('launcher on a phone beside an embedded published reader', () => {
  const queryLauncher = () => screen.queryByRole('button', { name: 'Abrir el asistente Asistente qa-a' });
  const mountBesideReader = async () => {
    await act(async () => { render(widgetTree('qa-a')); });
    await tick(4000);
  };

  it('never takes away a conversation that is already open when the reader appears', async () => {
    await mountWidget();
    fireEvent.click(launcher()); await tick(500);
    const dialog = () => screen.queryByRole('dialog', { name: 'Asistente qa-a', exact: true });
    expect(dialog()).toBeInTheDocument();
    const release = registerEmbeddedInstitutionalReader();
    try {
      await tick(500);
      expect(dialog()).toBeInTheDocument();
      // Closing it beside the reader leaves no launcher behind on a phone.
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar panel de prueba' }));
      await tick(1000);
      expect(dialog()).not.toBeInTheDocument();
      expect(queryLauncher()).not.toBeInTheDocument();
    } finally { act(() => { release(); }); }
  });

  it('steps aside while the reader is the page content and returns when it leaves', async () => {
    const release = registerEmbeddedInstitutionalReader();
    try {
      await mountBesideReader(); await tick(45000);
      // Nothing of the second assistant floats over the reading column or takes a tab stop.
      expect(queryLauncher()).not.toBeInTheDocument();
      expect(document.querySelector('.chatboc-agent-launcher')).toBeNull();
      expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
      act(() => { release(); }); await tick(200);
      expect(queryLauncher()).toBeInTheDocument();
    } finally { act(() => { release(); }); }
    expect(hasEmbeddedInstitutionalReader()).toBe(false);
  });

  it('keeps the launcher of an organization that forces its greeting', async () => {
    vi.mocked(tenantService.getPublicWidgetConfig).mockImplementation(async slug => profile(slug, true));
    const release = registerEmbeddedInstitutionalReader();
    try {
      await mountBesideReader();
      expect(queryLauncher()).toBeInTheDocument();
      expect(screen.getByText(greeting, { exact: true })).toBeInTheDocument();
    } finally { act(() => { release(); }); }
  });
});
