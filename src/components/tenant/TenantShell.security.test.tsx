import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getTenantPublicNavigationMock, useTenantMock } = vi.hoisted(() => ({
  getTenantPublicNavigationMock: vi.fn(),
  useTenantMock: vi.fn(),
}));

vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: (...args: unknown[]) => getTenantPublicNavigationMock(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('./TenantSwitcher', () => ({
  TenantSwitcher: () => <div data-testid="tenant-switcher" />,
}));

import { TenantShell } from './TenantShell';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';

const renderShell = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantShell>
          <div>Contenido</div>
        </TenantShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('TenantShell public navigation security', () => {
  beforeEach(() => {
    getTenantPublicNavigationMock.mockReset();
    useTenantMock.mockReset();
    useTenantMock.mockReturnValue({
      tenant: {
        slug: 'junin',
        nombre: 'Municipio de Junín',
        tipo: 'municipio',
        descripcion: null,
        logo_url: null,
      },
      currentSlug: 'junin',
      isLoadingTenant: false,
      tenantError: null,
      refreshTenant: vi.fn(),
      isCurrentTenantFollowed: false,
      followCurrentTenant: vi.fn(),
      unfollowCurrentTenant: vi.fn(),
      followedTenantsError: null,
      refreshFollowedTenants: vi.fn(),
    });
  });
  it('maps the canonical institutional home to the bound root and prevents organization switching', async () => {
    const binding = tenantHostFixture();
    useTenantMock.mockReturnValue({ ...useTenantMock(), tenant: binding.tenant, currentSlug: binding.tenant.slug, hostBinding: binding });
    getTenantPublicNavigationMock.mockResolvedValue({ contract_version: 'tenant.public_navigation.v1', tenant_slug: binding.tenant.slug, items: [
      { id: 'home', label: 'Inicio institucional', route: '/t/government-east', enabled: true },
      { id: 'survey', label: 'Encuestas', route: '/t/government-east/encuestas', enabled: true },
      { id: 'other', label: 'Organización ajena', route: '/t/other-workspace', enabled: true },
    ] });
    renderShell();
    expect(await screen.findByRole('link', { name: 'Inicio institucional' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Encuestas' })).toHaveAttribute('href', '/t/government-east/encuestas');
    expect(screen.queryByRole('link', { name: 'Organización ajena' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('tenant-switcher')).not.toBeInTheDocument();
  });

  it('renders the legitimate route and disables every mixed-separator PoC', async () => {
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        { id: 'safe', label: 'Encuestas seguras', route: '/t/junin/encuestas', enabled: true },
        { id: 'slash', label: 'PoC slash', route: '//evil.test/phish', enabled: true },
        { id: 'backslash', label: 'PoC backslash', route: String.raw`\\evil.test\phish`, enabled: true },
        { id: 'mixed-a', label: 'PoC mixed A', route: String.raw`/\evil.test/phish`, enabled: true },
        { id: 'mixed-b', label: 'PoC mixed B', route: String.raw`\/evil.test/phish`, enabled: true },
      ],
    });

    renderShell();
    expect(screen.getByText('Gobierno')).toBeVisible();
    expect(screen.queryByText('municipio')).not.toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Encuestas seguras' })).toHaveAttribute(
      'href',
      '/t/junin/encuestas',
    );

    for (const label of ['PoC slash', 'PoC backslash', 'PoC mixed A', 'PoC mixed B']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
      expect(screen.getByText(label)).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
