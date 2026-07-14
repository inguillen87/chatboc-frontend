import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
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
});
