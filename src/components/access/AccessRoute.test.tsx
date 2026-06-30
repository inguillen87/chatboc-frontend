import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AccessRoute from '@/components/access/AccessRoute';

const useUserMock = vi.fn();
const useCapabilitiesMock = vi.fn();
const safeLocalStorageGetItemMock = vi.fn();

vi.mock('@/hooks/useUser', () => ({
  useUser: () => useUserMock(),
}));

vi.mock('@/context/CapabilitiesContext', () => ({
  useCapabilities: () => useCapabilitiesMock(),
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => safeLocalStorageGetItemMock(key),
  },
}));

const DeniedProbe = () => {
  const location = useLocation();
  return <pre data-testid="denied-state">{JSON.stringify(location.state ?? {})}</pre>;
};

describe('AccessRoute', () => {
  beforeEach(() => {
    useUserMock.mockReset();
    useCapabilitiesMock.mockReset();
    safeLocalStorageGetItemMock.mockReset();

    safeLocalStorageGetItemMock.mockReturnValue(null);
    useUserMock.mockReturnValue({ user: { rol: 'admin' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read', 'settings.tenant.write', 'market.catalog.write'],
      hasAllCapabilities: () => true,
      hasAnyCapability: () => true,
    });
  });

  it('redirects to /403 with capability context when missing requiredCapabilities', () => {
    useUserMock.mockReturnValue({ user: { rol: 'empleado' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route
            path="/analytics"
            element={
              <AccessRoute requiredCapabilities={['analytics.read']}>
                <div>analytics-page</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const payload = JSON.parse(screen.getByTestId('denied-state').textContent || '{}');
    expect(payload.reason).toBe('capability');
    expect(payload.requiredCapabilities).toEqual(['analytics.read']);
    expect(payload.from).toBe('/analytics');
  });

  it('allows render when role and capabilities match', () => {
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AccessRoute roles={['admin']} requiredCapabilities={['tickets.read']}>
                <div>tickets-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('tickets-ok')).toBeInTheDocument();
  });

  it('accepts canonical allowed roles when user has a legacy role alias', () => {
    useUserMock.mockReturnValue({ user: { rol: 'admin' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AccessRoute roles={['tenant_admin']} requiredCapabilities={['tickets.read']}>
                <div>tickets-role-alias-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('tickets-role-alias-ok')).toBeInTheDocument();
  });

  it('allows Super Admin by role without requiring backend capabilities', () => {
    useUserMock.mockReturnValue({ user: { rol: 'super_admin' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <Routes>
          <Route
            path="/superadmin"
            element={
              <AccessRoute roles={['superadmin']}>
                <div>superadmin-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('superadmin-ok')).toBeInTheDocument();
  });

  it('allows Super Admin to bypass explicit route capabilities', () => {
    useUserMock.mockReturnValue({ user: { rol: 'super_admin' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/integracion']}>
        <Routes>
          <Route
            path="/integracion"
            element={
              <AccessRoute
                roles={['tenant_admin', 'superadmin']}
                requiredAllCapabilities={['settings.tenant.write']}
                requiredCapabilities={['analytics.read']}
              >
                <div>superadmin-capability-bypass-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('superadmin-capability-bypass-ok')).toBeInTheDocument();
  });

  it('redirects to /403 when missing one requiredAllCapabilities entry', () => {
    useUserMock.mockReturnValue({ user: { rol: 'empleado' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read'],
      hasAllCapabilities: (required: string[]) => required.every((capability) => capability === 'tickets.read'),
      hasAnyCapability: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/integracion']}>
        <Routes>
          <Route
            path="/integracion"
            element={
              <AccessRoute requiredAllCapabilities={['tickets.read', 'settings.tenant.write']}>
                <div>integration-page</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const payload = JSON.parse(screen.getByTestId('denied-state').textContent || '{}');
    expect(payload.reason).toBe('capability');
    expect(payload.requiredCapabilities).toEqual(['tickets.read', 'settings.tenant.write']);
    expect(payload.from).toBe('/integracion');
  });

  it('keeps tenant admins inside sensitive tenant setup when fine-grained settings capability is stale', () => {
    useUserMock.mockReturnValue({ user: { rol: 'admin_municipio' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/integracion']}>
        <Routes>
          <Route
            path="/integracion"
            element={
              <AccessRoute roles={['tenant_admin', 'superadmin']} requiredAllCapabilities={['settings.tenant.write']}>
                <div>integration-tenant-admin-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('integration-tenant-admin-ok')).toBeInTheDocument();
  });

  it('allows render when the user has at least one capability from requiredCapabilities', () => {
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: (required: string[]) => required.includes('analytics.read'),
    });

    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route
            path="/analytics"
            element={
              <AccessRoute requiredCapabilities={['analytics.read', 'dashboard.read', 'reports.read']}>
                <div>analytics-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('analytics-ok')).toBeInTheDocument();
  });

  it('keeps legacy backoffice routes accessible when backend has not declared capabilities yet', () => {
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AccessRoute roles={['tenant_admin', 'employee', 'superadmin']} requiredCapabilities={['tickets.read']}>
                <div>tickets-legacy-capability-fallback-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('tickets-legacy-capability-fallback-ok')).toBeInTheDocument();
  });

  it('uses persisted user data while /api/me is still hydrating so navbar links do not fall into /403', () => {
    useUserMock.mockReturnValue({ user: null, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });
    safeLocalStorageGetItemMock.mockImplementation((key: string) => {
      if (key === 'authToken') return 'stored-token';
      if (key === 'user') {
        return JSON.stringify({
          rol: 'admin_municipio',
          tenant_slug: 'junin',
          tipo_chat: 'municipio',
        });
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AccessRoute roles={['tenant_admin', 'employee', 'superadmin']} requiredCapabilities={['tickets.read']}>
                <div>tickets-persisted-user-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('tickets-persisted-user-ok')).toBeInTheDocument();
  });

  it('does not block tenant admins from operational modules when fine-grained capabilities are incomplete', () => {
    useUserMock.mockReturnValue({ user: { rol: 'admin_municipio' }, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAllCapabilities: () => false,
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AccessRoute roles={['tenant_admin', 'employee', 'superadmin']} requiredCapabilities={['tickets.read']}>
                <div>tickets-tenant-admin-operational-ok</div>
              </AccessRoute>
            }
          />
          <Route path="/403" element={<DeniedProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('tickets-tenant-admin-operational-ok')).toBeInTheDocument();
  });
});
