import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar from './Navbar';

const useUserMock = vi.fn();
const useCapabilitiesMock = vi.fn();
const useSessionAuthorityMock = vi.fn();

vi.mock('@/components/brand/ChatbocBrandLockup', () => ({
  default: () => <span>Chatboc.ar</span>,
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => useUserMock(),
}));

vi.mock('@/hooks/useCartCount', () => ({
  default: () => 0,
}));

vi.mock('@/hooks/useLandingExperience', () => ({
  useLandingExperience: () => ({ experience: null }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/context/CapabilitiesContext', () => ({
  useCapabilities: () => useCapabilitiesMock(),
}));

vi.mock('@/components/access/SessionAuthorityContext', () => ({
  useSessionAuthority: () => useSessionAuthorityMock(),
}));

describe('Navbar account menu routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.body.classList.remove('chatboc-mobile-menu-open');
    useUserMock.mockReturnValue({
      user: {
        rol: 'admin',
        tipo_chat: 'municipio',
        nombre_empresa: 'Municipalidad de Junín',
        plan: 'full',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read', 'orders.read'],
      hasAnyCapability: (required: string[]) =>
        required.some((capability) => ['tickets.read', 'orders.read'].includes(capability)),
    });
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'disabled',
      hasBearerSession: true,
      hasVerifiedSession: true,
    });
  });

  it.each(['/superadmin', '/superadmin?section=crm&tenant_slug=junin'])('shows platform identity at %s instead of the linked trial business', (path) => {
    useUserMock.mockReturnValue({ user: { rol: 'super_admin', name: 'Marcelo', nombre_empresa: 'MyB Store', plan: 'free' } });
    render(<MemoryRouter initialEntries={[path]}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByText('ChatBoc · Plataforma')).toBeInTheDocument();
    expect(screen.getByText('Superadministrador')).toBeInTheDocument();
    expect(screen.queryByText('MyB Store')).not.toBeInTheDocument();
    expect(screen.queryByText('Plan y facturación')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /carrito/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('href', '/superadmin?section=organizations');
    expect(screen.getByRole('link', { name: 'CRM comercial' })).toHaveAttribute('href', '/superadmin?section=crm');
  });

  it.each(['/t/junin/perfil', '/T/junin/perfil', '/junin/analytics', '/junin/estadisticas', '/junin/analytics/operations'])('retains organization identity at %s', (path) => {
    useUserMock.mockReturnValue({ user: { rol: 'super_admin', nombre_empresa: 'Municipalidad de Junín' } });
    render(<MemoryRouter initialEntries={[path]}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByText('Municipalidad de Junín')).toBeInTheDocument();
    expect(screen.queryByText('ChatBoc · Plataforma')).not.toBeInTheDocument();
  });

  it('opens municipal claims from the tenant profile tab instead of the protected root route on mobile', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('groups organization, plan, configuration and session inside the account menu', () => {
    render(
      <MemoryRouter initialEntries={['/perfil?tab=tickets']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByText('Municipalidad de Junín')).toBeInTheDocument();
    expect(screen.getByText('Organización')).toBeInTheDocument();
    expect(screen.getByText('Plan y facturación')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Sesión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Plan Full/i })).toHaveAttribute(
      'href',
      '/perfil?tab=perfil&section=plan',
    );
    expect(screen.getByRole('link', { name: /Perfil y organización/i })).toHaveAttribute(
      'href',
      '/perfil?tab=perfil',
    );
  });

  it('routes backoffice live chat into the operational ticket desk on mobile', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Chat$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets&focus=live_chat',
    );
  });

  it('keeps the public chat shortcut for end users', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'chat_user',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Chat$/i })).toHaveAttribute('href', '/chat');
  });

  it('keeps the municipal claims shortcut for tenant admins even while backend capabilities are partial', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'admin_municipio',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('keeps the claims shortcut when the backend role uses a municipal admin alias', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'municipal_admin',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('keeps the generic tickets label for non-municipal tenants', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'admin',
        tipo_chat: 'pyme',
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Tickets$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('keeps the account menu available for a Clerk session transported only by cookie', () => {
    useUserMock.mockReturnValue({ user: null });
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_cookie_navbar');
    window.localStorage.setItem(
      'user',
      JSON.stringify({ rol: 'admin', tipo_chat: 'municipio', name: 'Operador Junin' }),
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('does not expose an account badge or admin links from stale user data without a verified session', () => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_stale_navbar');
    window.localStorage.setItem(
      'user',
      JSON.stringify({ rol: 'admin', tipo_chat: 'municipio', name: 'Operador stale' }),
    );
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'loading',
      hasBearerSession: true,
      hasVerifiedSession: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Mi cuenta')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Reclamos$/i })).not.toBeInTheDocument();
  });

  it('does not expose claims to backoffice profiles without ticket role or capability', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'analytics_viewer',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.queryByRole('link', { name: /^Reclamos$/i })).not.toBeInTheDocument();
  });

  it('keeps the public landing navigation concise and the demo CTA stable', () => {
    useUserMock.mockReturnValue({ user: null });
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'disabled',
      hasBearerSession: false,
      hasVerifiedSession: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(navigation).toHaveTextContent('Plataforma');
    expect(navigation).toHaveTextContent('Soluciones');
    expect(navigation).toHaveTextContent('Casos');
    expect(navigation).toHaveTextContent('Planes');
    expect(navigation.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Ver demo' })).toHaveAttribute('href', '/demo');
    expect(screen.queryByRole('link', { name: 'Ver carrito' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir al inicio de Chatboc' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Ir al inicio de Chatboc' })).toHaveAttribute(
      'title',
      'Chatboc.ar · Inicio',
    );
  });

  it('exposes a keyboard-safe mobile navigation disclosure and coordinates the accessibility dock', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole('button', { name: /abrir men/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'chatboc-mobile-navigation');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', { name: 'Navegación principal móvil' }),
    ).toHaveAttribute('id', 'chatboc-mobile-navigation');
    expect(screen.getAllByRole('button', { name: 'Activar modo oscuro' })).toHaveLength(2);
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Navegación principal móvil' })).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');

    fireEvent.click(menuButton);
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');
    unmount();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
  });

  it('resets the mobile overlay and moves focus to a visible control at the desktop breakpoint', () => {
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      get matches() {
        return matches;
      },
      media: '(min-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole('button', { name: /abrir men/i });
    fireEvent.click(menuButton);
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');

    act(() => {
      matches = true;
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    expect(screen.queryByRole('navigation', { name: 'Navegación principal móvil' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
    expect(screen.getByRole('button', { name: 'Ir al inicio de Chatboc' })).toHaveFocus();

    act(() => {
      matches = false;
      listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
    expect(mediaQuery.removeEventListener).toHaveBeenCalled();
  });
});
