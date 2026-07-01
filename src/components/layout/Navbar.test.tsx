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

  it('opens tickets from the tenant profile tab instead of the protected root route', () => {
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

  it('does not expose Tickets to backoffice profiles without ticket role or capability', () => {
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

    expect(screen.queryByRole('link', { name: /^Tickets$/i })).not.toBeInTheDocument();
  });
});
