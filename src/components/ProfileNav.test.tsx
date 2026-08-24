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

const renderProfileNav = (initialEntry = '/perfil') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
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

    const ticketTab = screen.getByRole('tab', { name: /Panel de Tickets/i });
    expect(ticketTab).toBeInTheDocument();
    expect(ticketTab).toHaveAttribute('data-route', '/perfil?tab=tickets');
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

  it('keeps the ticket tab active when the profile opens from a ticket query link', () => {
    mocks.useCapabilities.mockReturnValue({
      capabilities: ['crm.tickets.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: (required: string[]) => required.includes('crm.tickets.read'),
    });

    renderProfileNav('/perfil?tab=tickets&codex_verify=1');

    expect(screen.getByRole('tab', { name: /Panel de Tickets/i })).toHaveAttribute('data-state', 'active');
  });

  it('uses the scoped operations probe and route for employees', () => {
    renderProfileNav();

    expect(mocks.useEndpointAvailable).toHaveBeenCalledWith('/api/v2/analytics/operations/dashboard');
    expect(mocks.useEndpointAvailable).not.toHaveBeenCalledWith('/api/admin/analytics/overview');
    expect(screen.getByRole('tab', { name: /^Analytics$/i })).toHaveAttribute(
      'data-route',
      '/t/junin/analytics/operations',
    );
  });

  it('uses the safe operations probe while preserving the tenant-wide route for tenant admins', () => {
    mocks.useUser.mockReturnValue({
      user: { rol: 'admin_municipio', tipo_chat: 'municipio' },
    });

    renderProfileNav();

    expect(mocks.useEndpointAvailable).toHaveBeenCalledWith('/api/v2/analytics/operations/dashboard');
    expect(mocks.useEndpointAvailable).not.toHaveBeenCalledWith('/api/admin/analytics/overview');
    expect(screen.getByRole('tab', { name: /^Analytics$/i })).toHaveAttribute(
      'data-route',
      '/t/junin/analytics',
    );
  });

  it('uses the safe operations probe while preserving the tenant-wide route for analytics viewers', () => {
    mocks.useUser.mockReturnValue({
      user: { rol: 'analytics_viewer', tipo_chat: 'municipio' },
    });

    renderProfileNav();

    expect(mocks.useEndpointAvailable).toHaveBeenCalledWith('/api/v2/analytics/operations/dashboard');
    expect(mocks.useEndpointAvailable).not.toHaveBeenCalledWith('/api/admin/analytics/overview');
    expect(screen.getByRole('tab', { name: /^Analytics$/i })).toHaveAttribute(
      'data-route',
      '/t/junin/analytics',
    );
  });
});
