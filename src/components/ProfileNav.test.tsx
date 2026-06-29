import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProfileNav from '@/components/ProfileNav';

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  useCapabilities: vi.fn(),
  useEndpointAvailable: vi.fn(),
  useRealtimeAlerts: vi.fn(),
  useTenant: vi.fn(),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => mocks.useUser(),
}));

vi.mock('@/context/CapabilitiesContext', () => ({
  useCapabilities: () => mocks.useCapabilities(),
}));

vi.mock('@/hooks/useEndpointAvailable', () => ({
  default: (...args: unknown[]) => mocks.useEndpointAvailable(...args),
}));

vi.mock('@/context/RealtimeAlertsContext', () => ({
  useRealtimeAlerts: () => mocks.useRealtimeAlerts(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => mocks.useTenant(),
}));

const renderProfileNav = () =>
  render(
    <MemoryRouter initialEntries={['/perfil']}>
      <ProfileNav />
    </MemoryRouter>,
  );

describe('ProfileNav operational access', () => {
  beforeEach(() => {
    mocks.useUser.mockReset();
    mocks.useCapabilities.mockReset();
    mocks.useEndpointAvailable.mockReset();
    mocks.useRealtimeAlerts.mockReset();
    mocks.useTenant.mockReset();

    mocks.useUser.mockReturnValue({
      user: { rol: 'empleado', tipo_chat: 'municipio' },
    });
    mocks.useCapabilities.mockReturnValue({
      capabilities: [],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });
    mocks.useEndpointAvailable.mockReturnValue(true);
    mocks.useRealtimeAlerts.mockReturnValue({
      ticketUnreadCount: 0,
      orderUnreadCount: 0,
    });
    mocks.useTenant.mockReturnValue({ currentSlug: 'junin' });
  });

  it('hides the ticket tab for employees with declared capabilities but no ticket access', () => {
    mocks.useCapabilities.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: (required: string[]) => required.includes('analytics.read'),
    });

    renderProfileNav();

    expect(screen.queryByText('Panel de Tickets')).not.toBeInTheDocument();
  });

  it('shows the ticket tab when the backend sends an equivalent ticket capability alias', () => {
    mocks.useCapabilities.mockReturnValue({
      capabilities: ['crm.tickets.read', 'tickets.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: (required: string[]) =>
        required.some((capability) => ['crm.tickets.read', 'tickets.read'].includes(capability)),
    });

    renderProfileNav();

    expect(screen.getByText('Panel de Tickets')).toBeInTheDocument();
  });

  it('keeps the ticket tab visible for tenant admins while capabilities are incomplete', () => {
    mocks.useUser.mockReturnValue({
      user: { rol: 'admin_municipio', tipo_chat: 'municipio' },
    });
    mocks.useCapabilities.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    renderProfileNav();

    expect(screen.getByText('Panel de Tickets')).toBeInTheDocument();
  });
});
