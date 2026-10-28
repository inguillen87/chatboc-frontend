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

describe('shared widget public assistant appearance', () => {
  it('opens with the host light palette after changing the theme while closed, without themechange', async () => {
    window.history.replaceState({}, '', '/t/qa-theme');
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue({
      ...publicConfig('qa-theme', 'Asistente de prueba'),
      theme_config: {
        mode: 'light',
        light: { primary: '#000', secondary: '#fff', background: '#fff', text: '#000' },
        dark: { primary: '#000', secondary: '#1f2937', background: '#111827', text: '#fff' },
      },
    });
    const view = renderWidget(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen={false} tenantSlug="qa-theme" /></MemoryRouter>);
    const target = view.container.querySelector<HTMLElement>('.chatboc-container')!;
    await waitFor(() => expect(target.style.getPropertyValue('--input')).toBe('221 39% 11%'));
    expect(screen.queryByTitle('Asistente de prueba')).not.toBeInTheDocument();
    act(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });
    await waitFor(() => expect(target.style.getPropertyValue('--input')).toBe('0 0% 100%'));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir el asistente Asistente de prueba' }));
    await waitFor(() => expect(screen.getByTitle('Asistente de prueba')).toBeVisible());
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 0%');
    expect(target.style.getPropertyValue('--card')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--primary')).toBe('0 0% 0%');
    act(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await waitFor(() => expect(target.style.getPropertyValue('--input')).toBe('221 39% 11%'));
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--card')).toBe('221 39% 11%');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar chat' }));
    const launcher = await screen.findByRole('button', { name: 'Abrir el asistente Asistente de prueba' });
    fireEvent.click(launcher);
    await waitFor(() => expect(screen.getByTitle('Asistente de prueba')).toBeVisible());
    expect(target.style.getPropertyValue('--input')).toBe('221 39% 11%');
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 100%');
  });

  it('follows the real user dark/light preference instead of the persisted light default, including the composer', async () => {
    window.history.replaceState({}, '', '/t/qa-theme');
    document.documentElement.classList.add('dark');localStorage.setItem('theme','dark');
    vi.spyOn(tenantService,'getPublicWidgetConfig').mockResolvedValue({...publicConfig('qa-theme','Asistente de prueba'),
      theme_config:{mode:'light',light:{primary:'#000',secondary:'#fff',background:'#fff',text:'#000'},dark:{primary:'#000',secondary:'#1f2937',background:'#111827',text:'#fff'}}});
    const view=renderWidget(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-theme"/></MemoryRouter>);
    await waitFor(()=>expect(view.container.querySelector<HTMLElement>('.chatboc-container')?.style.getPropertyValue('--input')).toBe('221 39% 11%'));
    const target=view.container.querySelector<HTMLElement>('.chatboc-container')!;
    expect(target.style.getPropertyValue('--card')).toBe('221 39% 11%');
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--primary')).toBe('0 0% 0%');
    expect(target.style.getPropertyValue('--primary-foreground')).toBe('0 0% 100%');
    act(()=>{document.documentElement.classList.remove('dark');localStorage.setItem('theme','light');window.dispatchEvent(new Event('themechange'));});
    await waitFor(()=>expect(target.style.getPropertyValue('--input')).toBe('0 0% 100%'));
    expect(target.style.getPropertyValue('--card')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 0%');
  });

  it('lets high contrast maximize surface readability without replacing brand colors or the global focus and border preferences', async () => {
    window.history.replaceState({}, '', '/t/qa-theme');
    vi.spyOn(tenantService,'getPublicWidgetConfig').mockResolvedValue({...publicConfig('qa-theme','Asistente de prueba'),
      theme_config:{light:{primary:'#005bb5',background:'#fff',text:'#005bb5'}}});
    const view=renderWidget(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-theme"/></MemoryRouter>);
    await waitFor(()=>expect(view.container.querySelector<HTMLElement>('.chatboc-container')?.style.getPropertyValue('--foreground')).toBe('210 100% 35%'));
    const target=view.container.querySelector<HTMLElement>('.chatboc-container')!;
    const beforeRing=document.documentElement.style.getPropertyValue('--ring'), beforeBorder=document.documentElement.style.getPropertyValue('--border');
    act(()=>{document.documentElement.classList.add('a11y-high-contrast');window.dispatchEvent(new CustomEvent('test-accessibility-change',{detail:{highContrast:true}}));});
    await waitFor(()=>expect(target.style.getPropertyValue('--foreground')).toBe('0 0% 0%'));
    expect(target.style.getPropertyValue('--primary')).toBe('210 100% 35%');
    expect(target.style.getPropertyValue('--input')).toBe('0 0% 100%');
    expect(target.style.getPropertyValue('--ring')).toBe('');expect(target.style.getPropertyValue('--border')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--ring')).toBe(beforeRing);
    expect(document.documentElement.style.getPropertyValue('--border')).toBe(beforeBorder);
    view.unmount();expect(target.style.getPropertyValue('--input')).toBe('');
    expect(document.documentElement.classList.contains('a11y-high-contrast')).toBe(true);
  });

  it('inherits host surfaces when that resolved mode has no published palette while retaining available brand colors', async () => {
    window.history.replaceState({}, '', '/t/qa-theme');document.documentElement.classList.add('dark');
    vi.spyOn(tenantService,'getPublicWidgetConfig').mockResolvedValue({...publicConfig('qa-theme','Asistente de prueba'),
      theme_config:{mode:'light',light:{primary:'#005bb5',secondary:'#fff',background:'#fff',text:'#000'}}});
    const view=renderWidget(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-theme"/></MemoryRouter>);
    await waitFor(()=>expect(view.container.querySelector<HTMLElement>('.chatboc-container')?.style.getPropertyValue('--primary')).toBe('210 100% 35%'));
    const target=view.container.querySelector<HTMLElement>('.chatboc-container')!;
    for(const name of ['--background','--card','--foreground','--input'])expect(target.style.getPropertyValue(name)).toBe('');
  });

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
    expect(target.style.getPropertyValue('--input')).toBe('0 0% 100%');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(before);
    view.unmount();
    expect(target.style.getPropertyValue('--primary')).toBe('');
    expect(target.style.getPropertyValue('--input')).toBe('');
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
    expect(target.style.getPropertyValue('--input')).toBe('0 0% 0%');
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

// Inspect the animation instructions passed to Framer; all API identities are synthetic.
vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>();
  const React = await import('react');
  const wrappers = new Map<string, React.ComponentType<any>>();
  return { ...actual, motion: new Proxy(actual.motion, { get: (_target, tag: string) => {
    if (!wrappers.has(tag)) wrappers.set(tag, React.forwardRef<HTMLElement, any>(function MotionFixture(props, ref) {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
      return React.createElement(tag, { ...rest, ref, 'data-motion-initial': JSON.stringify(initial),
        'data-motion-exit': JSON.stringify(exit), 'data-motion-duration': transition?.duration,
        'data-motion-repeat': transition?.repeat === Infinity ? 'infinite' : undefined });
    }));
    return wrappers.get(tag);
  } }) };
});


describe('widget explicit reduced motion', () => {
  const setupMotionWidget = async () => {
    window.history.replaceState({}, '', '/t/qa-motion');
    vi.spyOn(tenantService, 'getPublicWidgetConfig').mockResolvedValue({
      ...publicConfig('qa-motion', 'Asistente de prueba'),
      builder_config: { ux: { ambient_particles: true, cursor_trail: true, motion_level: 'pro' } },
    });
    const view = renderWidget(<MemoryRouter><ChatWidgetInner mode="standalone" defaultOpen tenantSlug="qa-motion" /></MemoryRouter>);
    await screen.findByTitle('Asistente de prueba');
    return view;
  };
  const panelMotion = (container: HTMLElement) => container.querySelector<HTMLElement>('[role="dialog"]')!;
  it('honors a stored local choice with the OS preference off, including entry and exit', async () => {
    localStorage.setItem('chatboc_accessibility', JSON.stringify({ reducedMotion: true }));
    const view = await setupMotionWidget();
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    expect(panelMotion(view.container).dataset.motionInitial).not.toMatch(/"(?:y|scale)"/);
    expect(panelMotion(view.container).dataset.motionExit).not.toMatch(/"(?:y|scale)"/);
  });
  it('stops decorative loops immediately when the user changes the local preference', async () => {
    const view = await setupMotionWidget();
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
    act(() => window.dispatchEvent(new CustomEvent('test-accessibility-change', { detail: { reducedMotion: true } })));
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    expect(panelMotion(view.container).dataset.motionExit).not.toMatch(/"(?:y|scale)"/);
    act(() => window.dispatchEvent(new CustomEvent('test-accessibility-change', { detail: { reducedMotion: false } })));
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
  });

  it('removes standalone CSS dimension transitions when the OS preference changes live', async () => {
    let notify!: () => void;
    const media = { matches: false, addEventListener: (_event: string, listener: () => void) => { notify = listener; }, removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    const view = await setupMotionWidget();
    const container = view.container.querySelector<HTMLElement>('.chatboc-container')!;
    expect(container.style.transition).not.toBe('none');
    act(() => { media.matches = true; notify(); });
    expect(container.style.transition).toBe('none');
  });
  it('retains OS reduction when the local preference is off and follows OS changes live', async () => {
    let notify!: () => void;
    const media = { matches: true, addEventListener: (_event: string, callback: () => void) => { notify = callback; }, removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media));
    const view = await setupMotionWidget();
    act(() => window.dispatchEvent(new CustomEvent('test-accessibility-change', { detail: { reducedMotion: false } })));
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    act(() => { media.matches = false; notify(); });
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
    act(() => { media.matches = true; notify(); });
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
  });
});
