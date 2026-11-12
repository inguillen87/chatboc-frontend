import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidgetInner from './ChatWidgetInner';
import ProactiveBubble from './ProactiveBubble';
import { tenantService } from '@/services/tenantService';
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

describe('proactive greeting ownership and keyboard behavior', () => {
  it('offers native keyboard activation and a separate dismissal without activating the backend CTA', async () => {
    vi.useRealTimers();
    const open = vi.fn(), dismiss = vi.fn();
    render(<ProactiveBubble message={greeting} visible onClick={open} onDismiss={dismiss} />);
    const user = userEvent.setup();
    const activate = screen.getByRole('button', { name: greeting, exact: true });
    activate.focus(); await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(open).toHaveBeenCalledTimes(2);
    await user.tab(); expect(closeGreeting()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(dismiss).toHaveBeenCalledWith(true);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it.each(['standalone', 'iframe'] as const)('keeps dismissal effective beyond both timer windows in %s mode', async mode => {
    await mountWidget(mode); await tick(12000);
    expect(screen.getByText(greeting, { exact: true })).toBeInTheDocument();
    act(() => { closeGreeting().focus(); }); fireEvent.click(closeGreeting());
    expect(launcher()).toHaveFocus();
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
    await tick(45000);
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('pending_widget_action')).toBeNull();
    expect(launcher()).toBeEnabled();
  });

  it('dismisses a forced greeting with Escape without opening chat and returns focus to the launcher', async () => {
    vi.mocked(tenantService.getPublicWidgetConfig).mockImplementation(async slug => profile(slug, true));
    await mountWidget(); await tick(3100);
    const activate = screen.getByRole('button', { name: greeting, exact: true });
    act(() => { activate.focus(); }); fireEvent.keyDown(activate, { key: 'Escape' });
    expect(launcher()).toHaveFocus();
    await tick(45000);
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('pending_widget_action')).toBeNull();
  });

  it('preserves the published action and payload when the greeting is activated', async () => {
    await mountWidget(); await tick(6100);
    const activate = screen.getByRole('button', { name: greeting, exact: true });
    act(() => { activate.focus(); }); fireEvent.click(activate);
    await tick(500);
    expect(screen.getByRole('dialog', { name: 'Chatboc asistente virtual', exact: true })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pending_widget_action')!)).toEqual({ action: 'trigger_intent', payload: 'backend-intent-unchanged', text: greeting });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar panel de prueba' }));
    await tick(400);
    expect(launcher()).toHaveFocus();
  });

  it('hides and pauses the greeting while an external mobile field is edited, without moving its focus or removing the launcher', async () => {
    await mountWidget(); await tick(6100);
    expect(screen.getByText(greeting, { exact: true })).toBeInTheDocument();
    const editor = screen.getByRole('textbox', { name: 'Descripción externa' });
    act(() => { editor.focus(); });
    fireEvent.change(editor, { target: { value: 'Borrador privado que conserva su foco' } });
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
    await tick(45000);
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
    expect(editor).toHaveFocus(); expect(editor).toHaveValue('Borrador privado que conserva su foco');
    expect(launcher()).toBeEnabled();
    act(() => { launcher().focus(); }); await tick(12000);
    expect(screen.getByText(greeting, { exact: true })).toBeInTheDocument();
  });

  it('starts suppressed when the external mobile editor already has focus before the widget mounts', async () => {
    const editor = document.createElement('textarea'); document.body.appendChild(editor); editor.focus();
    try {
      await mountWidget(); await tick(24000);
      expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
      expect(editor).toHaveFocus(); expect(launcher()).toBeEnabled();
    } finally { editor.remove(); }
  });

  it('does not suppress a desktop greeting merely because an external field has focus', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    await mountWidget(); act(() => { screen.getByRole('textbox', { name: 'Descripción externa' }).focus(); });
    await tick(12000);
    expect(screen.getByText(greeting, { exact: true })).toBeInTheDocument();
  });

  it('keeps dismissal isolated to its organization for the lifetime of this widget mount', async () => {
    const view = await mountWidget(); await tick(6100); fireEvent.click(closeGreeting());
    view.rerender(widgetTree('qa-b'));
    await vi.waitFor(() => expect(launcher('qa-b')).toBeInTheDocument()); await tick(12000);
    expect(screen.getByText(greeting, { exact: true })).toBeInTheDocument();
    view.rerender(widgetTree('qa-a'));
    await vi.waitFor(() => expect(launcher()).toBeInTheDocument()); await tick(24000);
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
  });

  it('does not replace a dismissed prop greeting with the separate delayed CTA display', async () => {
    render(<React.Suspense fallback={null}><MemoryRouter><ChatWidgetInner mode="standalone" tenantSlug="qa-a" ctaMessage="Sugerencia configurada por el integrador" /></MemoryRouter></React.Suspense>);
    await vi.waitFor(() => expect(launcher()).toBeInTheDocument()); await tick(2600);
    const suggestion = screen.getByRole('button', { name: 'Sugerencia configurada por el integrador', exact: true });
    expect(suggestion).toBeInTheDocument(); fireEvent.click(closeGreeting()); await tick(45000);
    expect(screen.queryByText('Sugerencia configurada por el integrador', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows a newly published message after dismissal without reviving the previous message', async () => {
    const element = (text: string) => <React.Suspense fallback={null}><MemoryRouter><ChatWidgetInner mode="standalone" tenantSlug="qa-a" ctaMessage={text} /></MemoryRouter></React.Suspense>;
    const view = render(element('Primer mensaje configurado'));
    await vi.waitFor(() => expect(launcher()).toBeInTheDocument()); await tick(2600); fireEvent.click(closeGreeting());
    view.rerender(element('Nuevo mensaje configurado'));
    await tick(2600);
    expect(screen.getByRole('button', { name: 'Nuevo mensaje configurado', exact: true })).toBeInTheDocument();
    expect(screen.queryByText('Primer mensaje configurado', { exact: true })).not.toBeInTheDocument();
  });

  it('retires a scheduled A greeting immediately when the SPA route changes to B with the old profile still loaded', async () => {
    const RouteControl = () => { const navigate = useNavigate(); return <button onClick={() => navigate('/t/qa-b')}>Cambiar ruta a B</button>; };
    render(<React.Suspense fallback={null}><MemoryRouter initialEntries={['/t/qa-a']}><RouteControl /><ChatWidgetInner mode="standalone" /></MemoryRouter></React.Suspense>);
    await vi.waitFor(() => expect(launcher()).toBeInTheDocument());
    await tick(5900); fireEvent.click(screen.getByRole('button', { name: 'Cambiar ruta a B' })); await tick(24000);
    expect(screen.queryByText(greeting, { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('pending_widget_action')).toBeNull();
  });

  it('keeps the focused greeting unchanged beyond its automatic hide window, then resumes after focus leaves', async () => {
    await mountWidget(); await tick(6100);
    const activate = screen.getByRole('button', { name: greeting, exact: true });
    act(() => { activate.focus(); }); await tick(24000);
    expect(activate).toHaveFocus(); expect(activate).toBeInTheDocument();
    expect(activate).toHaveTextContent(greeting);
    act(() => { launcher().focus(); }); await tick(500);
    expect(screen.queryByRole('button', { name: greeting, exact: true })).not.toBeInTheDocument();
    expect(launcher()).toHaveFocus();
  });

  it('retains backend routing metadata when the configured greeting text equals the backend CTA', async () => {
    render(<React.Suspense fallback={null}><MemoryRouter><ChatWidgetInner mode="standalone" tenantSlug="qa-a" ctaMessage={greeting} /></MemoryRouter></React.Suspense>);
    await vi.waitFor(() => expect(launcher()).toBeInTheDocument()); await tick(2600);
    fireEvent.click(screen.getByRole('button', { name: greeting, exact: true }));
    await tick(500);
    expect(JSON.parse(localStorage.getItem('pending_widget_action')!)).toEqual({ action: 'trigger_intent', payload: 'backend-intent-unchanged', text: greeting });
  });
});
