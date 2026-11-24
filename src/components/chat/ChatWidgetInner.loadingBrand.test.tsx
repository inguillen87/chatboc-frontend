import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: { slug: 'private-account' }, currentSlug: 'private-account' }),
}));
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: { rol: 'superadmin', nombre: 'Private account operator' } }),
}));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('./ChatPanel', async () => {
  const { default: ChatHeader } = await import('./ChatHeader');
  return {
    default: ({ welcomeTitle, welcomeSubtitle, onClose }: { welcomeTitle?: string; welcomeSubtitle?: string; onClose: () => void }) => (
      <ChatHeader onClose={onClose} title={welcomeTitle} subtitle={welcomeSubtitle} />
    ),
  };
});
vi.mock('./AccessibilityToggle', () => ({
  default: () => <button>Accesibilidad</button>,
  ACCESSIBILITY_EVENT: 'test-accessibility-change',
  readAccessibilityPrefs: () => JSON.parse(localStorage.getItem('chatboc_accessibility') || '{}'),
}));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));

const appDefaults = { welcomeTitle: 'Asistente Virtual', welcomeSubtitle: 'Consultas, ventas y soporte con Chatboc' };
const originalFetch = global.fetch;
const originalRootClass = document.documentElement.className;
const renderWidget = (children: React.ReactNode) => render(<React.Suspense fallback={null}>{children}</React.Suspense>);
const publicConfig = (slug: string, assistant: string) => ({
  contract_version: 'public.widget_config.v1',
  slug,
  tenant_name: 'Nombre institucional',
  tipo_chat: 'municipio',
  welcome_subtitle: assistant,
  welcome_title: 'Hola, consultá la información pública de esta organización.',
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia',vi.fn().mockImplementation((media:string)=>({
    matches:false,media,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),
    addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn(),
  })));
  document.documentElement.classList.remove('dark','a11y-high-contrast');
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status: 'ready', entityToken: null, chatAuthToken: null });
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  vi.spyOn(tenantService, 'getPlatformWidgetConfig').mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  window.history.replaceState({}, '', '/');
  document.documentElement.className=originalRootClass;
});

describe('tenant widget while its profile loads', () => {
  it('names the tenant assistant, never the platform, before the public config arrives', async () => {
    window.history.replaceState({}, '', '/t/qa-loading');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockImplementation(() => new Promise(() => {}));

    renderWidget(
      <MemoryRouter>
        <ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-loading" welcomeTitle="Municipio de Prueba" />
      </MemoryRouter>,
    );

    const panel = await screen.findByRole('dialog', { name: 'Cargando el asistente de Municipio de Prueba' });
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Cargando el asistente de Municipio de Prueba')).toBeVisible();
    expect(screen.getByText('Preparando mensajes, menú y accesibilidad.')).toBeVisible();
    expect(screen.queryByText(/Chatboc/)).not.toBeInTheDocument();
  });

  it('stays neutral when the assistant name is not known yet', async () => {
    window.history.replaceState({}, '', '/t/qa-loading');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockImplementation(() => new Promise(() => {}));

    renderWidget(
      <MemoryRouter>
        <ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-loading" welcomeTitle="" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog', { name: 'Cargando el asistente' })).toBeInTheDocument();
    expect(screen.getByText('Cargando el asistente')).toBeVisible();
  });

  it('never flashes App platform defaults on launcher or header while an organization config loads', async () => {
    window.history.replaceState({}, '', '/t/qa-loading');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockImplementation(() => new Promise(() => {}));

    renderWidget(
      <MemoryRouter initialEntries={['/t/qa-loading']}>
        <ChatWidgetInner mode="standalone" defaultOpen={false} {...appDefaults} />
      </MemoryRouter>,
    );

    const launcher = await screen.findByRole('button', { name: 'Abrir el asistente' });
    expect(launcher).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/Asistente Virtual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chatboc/i)).not.toBeInTheDocument();

    fireEvent.click(launcher);
    const panel = await screen.findByRole('dialog', { name: 'Cargando el asistente' });
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Cargando asistente')).toBeInTheDocument();
    expect(screen.queryByTitle('Asistente Virtual')).not.toBeInTheDocument();
    expect(screen.queryByText(appDefaults.welcomeTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(appDefaults.welcomeSubtitle)).not.toBeInTheDocument();
  });

  it('keeps platform defaults intact on the Chatboc landing page', async () => {
    window.history.replaceState({}, '', '/');
    const publicRead = vi.spyOn(tenantService, 'getPublicWidgetConfig');

    renderWidget(
      <MemoryRouter initialEntries={['/']}>
        <ChatWidgetInner mode="standalone" defaultOpen {...appDefaults} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTitle(appDefaults.welcomeTitle)).toBeVisible());
    expect(screen.getByText(appDefaults.welcomeSubtitle)).toBeVisible();
    expect(publicRead).not.toHaveBeenCalled();
  });
});
