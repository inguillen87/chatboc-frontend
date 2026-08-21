import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar from './Navbar';

const useUserMock = vi.fn();
const useCapabilitiesMock = vi.fn();

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
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read', 'orders.read'],
      hasAnyCapability: (required: string[]) =>
        required.some((capability) => ['tickets.read', 'orders.read'].includes(capability)),
    });
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
