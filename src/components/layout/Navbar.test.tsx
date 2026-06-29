import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar from './Navbar';

vi.mock('@/components/brand/ChatbocBrandLockup', () => ({
  default: () => <span>Chatboc.ar</span>,
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: {
      rol: 'admin',
      tipo_chat: 'municipio',
    },
  }),
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
  useCapabilities: () => ({
    capabilities: ['tickets.read', 'orders.read'],
    hasAnyCapability: (required: string[]) =>
      required.some((capability) => ['tickets.read', 'orders.read'].includes(capability)),
  }),
}));

describe('Navbar account menu routing', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
});
