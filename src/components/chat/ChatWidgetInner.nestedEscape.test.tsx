import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));
vi.mock('@/utils/widgetTelemetry', () => ({ trackWidgetEvent: vi.fn() }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null, currentSlug: 'qa-widget' }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));
vi.mock('./ChatPanel', async () => {
  const { default: Header } = await import('./ChatHeader');
  return {
    default: ({ welcomeTitle, welcomeSubtitle, onClose, onToggleSound, onA11yChange }: {
      welcomeTitle?: string; welcomeSubtitle?: string; onClose: () => void;
      onToggleSound?: () => void; onA11yChange?: React.ComponentProps<typeof Header>['onA11yChange'];
    }) => <section><Header onClose={onClose} onToggleSound={onToggleSound} onA11yChange={onA11yChange}
      title={welcomeTitle} subtitle={welcomeSubtitle} /><input aria-label="Mensaje sintético" /></section>,
  };
});

const originalFetch = global.fetch;
const originalRootClass = document.documentElement.className;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, '', '/t/qa-widget');
  document.documentElement.classList.remove('dark', 'a11y-high-contrast');
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
    matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
  vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue({
    contract_version: 'public.widget_config.v1', slug: 'qa-widget', tenant_name: 'Institución sintética', tipo_chat: 'municipio',
    welcome_subtitle: 'Asistente de prueba',
    welcome_title: 'Información pública de prueba sobre trámites, servicios y fuentes institucionales. Este texto largo de bienvenida sólo permite comprobar el comportamiento del popover con teclado.',
  });
});

afterEach(() => {
  cleanup(); global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.clear(); sessionStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  window.history.replaceState({}, '', '/');
  document.documentElement.className = originalRootClass;
});

const renderWidget = () => render(<React.Suspense fallback={null}><MemoryRouter initialEntries={['/t/qa-widget']}>
  <ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-widget" />
</MemoryRouter></React.Suspense>);
const widget = () => screen.getByRole('dialog', { name: 'Chatboc asistente virtual', exact: true });
const pressEscape = (element: Element) => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  fireEvent(element, event);
  return event;
};

describe('widget nested Escape ownership', () => {
  it.each([
    ['Leer bienvenida completa', 'welcome'],
    ['Abrir ajustes de accesibilidad', 'accessibility'],
    ['Opciones del chat', 'menu'],
  ] as const)('dismisses %s first and keeps the widget until an unconsumed Escape', async (name, kind) => {
    renderWidget();
    await screen.findByTitle('Asistente de prueba');
    const trigger = await screen.findByRole('button', { name, exact: true });
    trigger.focus();
    if (kind === 'menu') fireEvent.keyDown(trigger, { key: 'Enter' });
    else fireEvent.click(trigger);
    const popup = kind === 'menu' ? await screen.findByRole('menu')
      : kind === 'welcome' ? await screen.findByRole('dialog', { name: 'Bienvenida completa', exact: true })
        : (await screen.findByText('Lectura espaciada', { exact: true })).closest('[role="dialog"]')!;
    await waitFor(() => expect(popup).toBeVisible());
    const firstEscape = pressEscape(popup);
    expect(firstEscape.defaultPrevented).toBe(true);
    await waitFor(() => expect(popup).not.toBeInTheDocument());
    expect(widget()).toBeVisible();
    expect(localStorage.getItem('widget_manually_closed')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    // Accessibility's focused trigger may expose its real tooltip as another layer.
    const tooltip = screen.queryByRole('tooltip');
    if (tooltip) {
      pressEscape(trigger);
      await waitFor(() => expect(tooltip).not.toBeInTheDocument());
      expect(widget()).toBeVisible();
      expect(localStorage.getItem('widget_manually_closed')).toBeNull();
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    pressEscape(trigger);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chatboc asistente virtual', exact: true })).not.toBeInTheDocument());
    expect(localStorage.getItem('widget_manually_closed')).toBe('1');
  });

  it('still closes on an unconsumed Escape directly from the composer', async () => {
    renderWidget();
    const composer = await screen.findByRole('textbox', { name: 'Mensaje sintético', exact: true });
    composer.focus(); pressEscape(composer);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chatboc asistente virtual', exact: true })).not.toBeInTheDocument());
    expect(localStorage.getItem('widget_manually_closed')).toBe('1');
  });
});
