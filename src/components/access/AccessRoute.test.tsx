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
      hasAllCapabilities: () => true,
      hasAnyCapability: () => true,
    });
  });

  it('redirects to /403 with capability context when missing requiredCapabilities', () => {
    useCapabilitiesMock.mockReturnValue({
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
    useCapabilitiesMock.mockReturnValue({
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

  it('allows render when the user has at least one capability from requiredCapabilities', () => {
    useCapabilitiesMock.mockReturnValue({
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
});
