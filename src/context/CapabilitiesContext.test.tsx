import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CapabilitiesProvider, useCapabilities } from '@/context/CapabilitiesContext';

const useUserMock = vi.fn();

vi.mock('@/hooks/useUser', () => ({
  useUser: () => useUserMock(),
}));

const CapabilityProbe = () => {
  const { capabilities, hasCapability, hasAllCapabilities, hasAnyCapability } = useCapabilities();
  return (
    <pre data-testid="capabilities">
      {JSON.stringify({
        capabilities,
        hasSettingsWrite: hasCapability(' settings.tenant.write '),
        hasCatalogWrite: hasCapability('MARKET.CATALOG.WRITE'),
        hasTicketsRead: hasCapability('tickets.read'),
        hasOrdersRead: hasCapability('market.orders.read'),
        hasAll: hasAllCapabilities(['settings.tenant.write', 'market.catalog.write']),
        hasAny: hasAnyCapability(['analytics.read', 'market.catalog.write']),
      })}
    </pre>
  );
};

describe('CapabilitiesContext', () => {
  beforeEach(() => {
    useUserMock.mockReset();
  });

  it('normalizes capabilities across permissions, capabilities and scopes', () => {
    useUserMock.mockReturnValue({
      user: {
        permissions: [' Settings.Tenant.Write ', '', null],
        capabilities: ['market.catalog.write', 'MARKET.CATALOG.WRITE'],
        scopes: ['analytics.read'],
      },
    });

    render(
      <CapabilitiesProvider>
        <CapabilityProbe />
      </CapabilitiesProvider>,
    );

    const payload = JSON.parse(screen.getByTestId('capabilities').textContent || '{}');
    expect(payload.capabilities).toEqual(['settings.tenant.write', 'market.catalog.write', 'analytics.read']);
    expect(payload.hasSettingsWrite).toBe(true);
    expect(payload.hasCatalogWrite).toBe(true);
    expect(payload.hasAll).toBe(true);
    expect(payload.hasAny).toBe(true);
  });

  it('adds canonical capabilities for legacy backend permission names', () => {
    useUserMock.mockReturnValue({
      user: {
        permissions: ['crm.tickets.read'],
        capabilities: ['orders.read'],
        scopes: ['claims.read'],
      },
    });

    render(
      <CapabilitiesProvider>
        <CapabilityProbe />
      </CapabilitiesProvider>,
    );

    const payload = JSON.parse(screen.getByTestId('capabilities').textContent || '{}');
    expect(payload.capabilities).toEqual([
      'crm.tickets.read',
      'tickets.read',
      'orders.read',
      'market.orders.read',
      'claims.read',
    ]);
    expect(payload.hasTicketsRead).toBe(true);
    expect(payload.hasOrdersRead).toBe(true);
  });

  it('treats ticket admin and module-level access as valid ticket read access', () => {
    useUserMock.mockReturnValue({
      user: {
        permissions: ['crm_reclamos'],
        capabilities: ['tickets.admin'],
        scopes: [],
      },
    });

    render(
      <CapabilitiesProvider>
        <CapabilityProbe />
      </CapabilitiesProvider>,
    );

    const payload = JSON.parse(screen.getByTestId('capabilities').textContent || '{}');
    expect(payload.capabilities).toEqual(['crm_reclamos', 'tickets.read', 'tickets.admin']);
    expect(payload.hasTicketsRead).toBe(true);
  });

  it('normalizes legacy underscore ticket permissions from old employee scopes', () => {
    useUserMock.mockReturnValue({
      user: {
        permissions: ['tickets_read'],
        capabilities: ['tickets_update'],
        scopes: ['tickets_assign'],
      },
    });

    render(
      <CapabilitiesProvider>
        <CapabilityProbe />
      </CapabilitiesProvider>,
    );

    const payload = JSON.parse(screen.getByTestId('capabilities').textContent || '{}');
    expect(payload.capabilities).toEqual([
      'tickets_read',
      'tickets.read',
      'tickets_update',
      'tickets.write',
      'tickets_assign',
      'tickets.assign',
    ]);
    expect(payload.hasTicketsRead).toBe(true);
  });

  it('normalizes the legacy analytics_read token to analytics.read', () => {
    useUserMock.mockReturnValue({
      user: {
        permissions: ['analytics_read'],
      },
    });

    render(
      <CapabilitiesProvider>
        <CapabilityProbe />
      </CapabilitiesProvider>,
    );

    const payload = JSON.parse(screen.getByTestId('capabilities').textContent || '{}');
    expect(payload.capabilities).toEqual(expect.arrayContaining(['analytics_read', 'analytics.read']));
  });
});
