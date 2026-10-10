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
vi.mock('@/hooks/useDarkMode', () => ({ useDarkMode: () => false }));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('./ChatPanel', async () => {
  const { default: ChatHeader } = await import('./ChatHeader');
  return {
    default: ({ welcomeTitle, welcomeSubtitle }: { welcomeTitle?: string; welcomeSubtitle?: string }) => (
      <ChatHeader onClose={() => {}} title={welcomeTitle} subtitle={welcomeSubtitle} />
    ),
  };
});
vi.mock('./AccessibilityToggle', () => ({
  default: () => <button>Accesibilidad</button>,
  ACCESSIBILITY_EVENT: 'test-accessibility-change',
  readAccessibilityPrefs: () => ({}),
}));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));

const appDefaults = { welcomeTitle: 'Asistente Virtual', welcomeSubtitle: 'Consultas, ventas y soporte con Chatboc' };
const originalFetch = global.fetch;
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
  localStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  window.history.replaceState({}, '', '/');
});

describe('shared widget public assistant appearance', () => {
  it('normalizes public HEX branding in the widget scope and restores it without changing the host page', async () => {
    window.history.replaceState({}, '', '/t/qa-theme');
    const before = document.documentElement.style.getPropertyValue('--primary');
    vi.spyOn(tenantService,'getPublicWidgetConfig').mockResolvedValue({...publicConfig('qa-theme','Asistente de prueba'),
      theme_config:{mode:'light',light:{primary:'#000000',secondary:'#FFFFFF',background:'#ffffff',text:'#000000'}}});
    const view = renderWidget(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-theme"/></MemoryRouter>);
    await waitFor(()=>expect(view.container.querySelector<HTMLElement>('.chatboc-container')?.style.getPropertyValue('--primary')).toBe('0 0% 0%'));
    const target = view.container.querySelector<HTMLElement>('.chatboc-container')!;
    expect(target.style.getPropertyValue('--primary-foreground')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--card')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 0%');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(before);
    view.unmount();
    expect(target.style.getPropertyValue('--primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(before);
  });

  it('replaces tenant colors and contrast instead of retaining the preceding organization theme', async () => {
    window.history.replaceState({}, '', '/t/qa-first');
    vi.spyOn(tenantService,'getPublicWidgetConfig').mockImplementation(async slug => ({...publicConfig(slug,'Asistente de '+slug),
      theme_config:{mode:'light',light:slug==='qa-first'?{primary:'#000',background:'#fff',text:'#000'}:{primary:'#fff',background:'#000',text:'#fff'}}}));
    const element=(slug:string)=><MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug={slug}/></MemoryRouter>;
    const view=renderWidget(element('qa-first'));
    const target=view.container.querySelector<HTMLElement>('.chatboc-container')!;
    await waitFor(()=>expect(target.style.getPropertyValue('--primary-foreground')).toBe('0 0% 100%'));
    view.rerender(<React.Suspense fallback={null}>{element('qa-second')}</React.Suspense>);
    await waitFor(()=>expect(target.style.getPropertyValue('--primary')).toBe('0 0% 100%'));
    expect(target.style.getPropertyValue('--primary-foreground')).toBe('0 0% 0%');
    expect(target.style.getPropertyValue('--card')).toBe('0 0% 0%');
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 100%');
  });

  it('keeps custom message color variables as full CSS colors and gives explicit props readable contrast', async () => {
    window.history.replaceState({}, '', '/iframe');
    const before=document.documentElement.style.getPropertyValue('--primary');
    vi.spyOn(tenantService,'getPublicWidgetConfig').mockResolvedValue({...publicConfig('qa-theme','Asistente de prueba'),
      theme_config:{mode:'light',light:{primary:'#fff'}}});
    const view=renderWidget(<MemoryRouter><ChatWidgetInner mode="iframe" defaultOpen tenantSlug="qa-theme" primaryColor="#000" userMsgColor="#777777"/></MemoryRouter>);
    await waitFor(()=>expect(document.documentElement.style.getPropertyValue('--user-msg-fg')).toBe('hsl(0 0% 0%)'));
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('0 0% 0%');
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).toBe('0 0% 100%');
    expect(document.documentElement.style.getPropertyValue('--user-msg-bg')).toBe('hsl(0 0% 47%)');
    view.unmount();
    expect(document.documentElement.style.getPropertyValue('--user-msg-fg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(before);
  });

  it('renders the public launcher and header after the unrelated private panel refreshes during the real API read', async () => {
    window.history.replaceState({}, '', '/t/tierra-del-fuego');
    usePanelSessionStore.setState({ authToken: 'synthetic-private-session', user: { id: 4, rol: 'admin_municipio', tenant_slug: 'junin' } as any });
    useTenantStore.getState().setTenant('junin');
    localStorage.setItem('authToken', 'synthetic-private-session');
    const privateUser = JSON.stringify({ id: 4, rol: 'admin_municipio', tenant_slug: 'junin', permissions: ['settings.tenant.write'] });
    localStorage.setItem('user', privateUser);
    const publicAppearance = publicConfig('tierra-del-fuego', 'Conversa TDF');
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>(r => { resolve = r; });
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      return url.pathname.endsWith('/widget-config') ? pending : Promise.resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    }) as typeof fetch;
    renderWidget(<MemoryRouter initialEntries={['/t/tierra-del-fuego']}><ChatWidgetInner mode="standalone" defaultOpen={false} {...appDefaults} /></MemoryRouter>);
    await waitFor(() => expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input).includes('/widget-config'))).toBe(true));
    act(() => {
      usePanelSessionStore.setState({ authToken: 'synthetic-refreshed-private-session' });
      localStorage.setItem('authToken', 'synthetic-refreshed-private-session');
      localStorage.setItem('tenantSlug', 'junin');
    });
    await act(async () => { resolve(new Response(JSON.stringify(publicAppearance), { headers: { 'Content-Type': 'application/json' } })); });
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir el asistente Conversa TDF' }));
    expect(await screen.findByTitle('Conversa TDF')).toHaveTextContent('Conversa TDF');
    await waitFor(() => expect(screen.getByText(publicAppearance.welcome_title)).toBeVisible());
    expect(screen.queryByTitle(appDefaults.welcomeTitle)).not.toBeInTheDocument();
    expect(localStorage.getItem('tenantSlug')).toBe('junin');
    expect(useTenantStore.getState().slug).toBe('junin');
    expect(localStorage.getItem('user')).toBe(privateUser);
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-refreshed-private-session');
    const reads = vi.mocked(global.fetch).mock.calls.filter(([input]) => String(input).includes('/widget-config'));
    expect(reads).toHaveLength(1);
    const [input, init] = reads[0];
    const url = new URL(String(input), window.location.origin);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get('tenant')).toBe('tierra-del-fuego');
    const headers = new Headers(init?.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session-Id')).toBe(false);
    expect(init?.credentials).toBe('omit');
  });

  it.each([
    ['tierra-del-fuego', 'Conversa TDF'],
    ['another-city', 'Asistente de otra organización'],
  ])('uses %s public assistant identity for the canonical launcher and open header', async (slug, assistant) => {
    window.history.replaceState({}, '', '/t/' + slug);
    const config = publicConfig(slug, assistant);
    const publicRead = vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue(config);
    renderWidget(
      <MemoryRouter initialEntries={['/t/' + slug]}>
        <ChatWidgetInner mode="standalone" defaultOpen={false} {...appDefaults} />
      </MemoryRouter>,
    );

    const launcher = await screen.findByRole('button', { name: 'Abrir el asistente ' + assistant });
    expect(publicRead).toHaveBeenCalledWith(slug);
    fireEvent.click(launcher);
    expect(await screen.findByTitle(assistant)).toHaveTextContent(assistant);
    await waitFor(() => expect(screen.getByText(config.welcome_title)).toBeVisible());
    expect(screen.queryByTitle(appDefaults.welcomeTitle)).not.toBeInTheDocument();
    expect(screen.queryByText('Private account operator')).not.toBeInTheDocument();
  });

  it.each(['iframe', 'preview'] as const)('preserves explicit %s display overrides', async (mode) => {
    window.history.replaceState({}, '', '/iframe');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue(publicConfig('another-city', 'Asistente persistido'));
    renderWidget(
      <MemoryRouter initialEntries={['/iframe']}>
        <ChatWidgetInner mode={mode} defaultOpen tenantSlug="another-city" welcomeTitle="Nombre explícito" welcomeSubtitle="Saludo explícito" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTitle('Nombre explícito')).toBeVisible());
    expect(screen.getByText('Saludo explícito')).toBeVisible();
    expect(screen.queryByTitle('Asistente persistido')).not.toBeInTheDocument();
  });

  it('retains global defaults on the unscoped public landing page despite a private account tenant', async () => {
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
