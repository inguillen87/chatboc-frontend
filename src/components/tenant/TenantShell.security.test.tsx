import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getTenantPublicNavigationMock, useTenantMock, useSessionAuthorityMock } = vi.hoisted(() => ({
  getTenantPublicNavigationMock: vi.fn(),
  useTenantMock: vi.fn(),
  useSessionAuthorityMock: vi.fn(),
}));

vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: (...args: unknown[]) => getTenantPublicNavigationMock(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('@/components/access/SessionAuthorityContext', () => ({
  useSessionAuthority: () => useSessionAuthorityMock(),
}));

vi.mock('./TenantSwitcher', () => ({
  TenantSwitcher: () => <div data-testid="tenant-switcher">Espacios guardados</div>,
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
    useSessionAuthorityMock.mockReset().mockReturnValue({
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    });
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

  it('hides following, favorite state and saved spaces from an anonymous visitor', async () => {
    useTenantMock.mockReturnValue({
      ...useTenantMock(),
      isCurrentTenantFollowed: true,
      followedTenantsError: 'Detalle privado de sincronización',
    });
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [],
    });

    renderShell();

    expect(await screen.findByRole('heading', { name: 'Municipio de Junín' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /seguir/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Favorito')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tenant-switcher')).not.toBeInTheDocument();
    expect(screen.queryByText('Espacios guardados')).not.toBeInTheDocument();
    expect(screen.queryByText('Detalle privado de sincronización')).not.toBeInTheDocument();
  });

  it('shows follow and saved-space controls only with a verified session', async () => {
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'ready',
      hasBearerSession: true,
      hasVerifiedSession: true,
    });
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [],
    });

    renderShell();

    expect(await screen.findByRole('button', { name: 'Seguir espacio' })).toBeInTheDocument();
    expect(screen.getByTestId('tenant-switcher')).toBeInTheDocument();
    expect(screen.getByText('Espacios guardados')).toBeInTheDocument();
    expect(screen.queryByText('Favorito')).not.toBeInTheDocument();
  });

  it('shows the favorite state and unfollow action to its verified owner', async () => {
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'ready',
      hasBearerSession: true,
      hasVerifiedSession: true,
    });
    useTenantMock.mockReturnValue({ ...useTenantMock(), isCurrentTenantFollowed: true });
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [],
    });

    renderShell();

    expect(await screen.findByText('Favorito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
    expect(screen.getByTestId('tenant-switcher')).toBeInTheDocument();
  });
  it('maps the canonical institutional home to the bound root and prevents organization switching', async () => {
    const binding = tenantHostFixture();
    useTenantMock.mockReturnValue({ ...useTenantMock(), tenant: binding.tenant, currentSlug: binding.tenant.slug, hostBinding: binding });
    getTenantPublicNavigationMock.mockResolvedValue({ contract_version: 'tenant.public_navigation.v1', tenant_slug: binding.tenant.slug, items: [
      { id: 'home', label: 'Inicio institucional', route: '/t/government-east', enabled: true },
      { id: 'services', label: 'Servicios', route: '/t/government-east/tramites', enabled: true },
      { id: 'other', label: 'Organización ajena', route: '/t/other-workspace', enabled: true },
    ] });
    renderShell();
    expect(await screen.findByRole('link', { name: 'Inicio institucional' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Servicios' })).toHaveAttribute('href', '/t/government-east/tramites');
    expect(screen.queryByRole('link', { name: 'Organización ajena' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('tenant-switcher')).not.toBeInTheDocument();
  });

  it('leaves out of the menu the sections the organization has not published', async () => {
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        { id: 'home', label: 'Inicio', route: '/t/junin', enabled: true },
        { id: 'surveys', label: 'Encuestas', route: '/t/junin/encuestas', enabled: false, empty_state: 'Todavía no hay encuestas publicadas.' },
        { id: 'catalog', label: 'Catálogo', route: '/t/junin/catalogo', enabled: false },
        { id: 'new_claim', label: 'Nuevo reclamo', route: '/t/junin/reclamos/nuevo', enabled: true },
      ],
    });

    renderShell();
    expect(await screen.findByRole('link', { name: 'Nuevo reclamo' })).toHaveAttribute('href', '/t/junin/reclamos/nuevo');
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    // Neither a link nor a greyed label: an unpublished section is not announced.
    expect(screen.queryByText('Encuestas')).not.toBeInTheDocument();
    expect(screen.queryByText('Catálogo')).not.toBeInTheDocument();
    expect(document.querySelector('nav [aria-disabled="true"]')).toBeNull();
  });

  it('renders the legitimate route and disables every mixed-separator PoC', async () => {
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        { id: 'safe', label: 'Servicios seguros', route: '/t/junin/tramites', enabled: true },
        { id: 'slash', label: 'PoC slash', route: '//evil.test/phish', enabled: true },
        { id: 'backslash', label: 'PoC backslash', route: String.raw`\\evil.test\phish`, enabled: true },
        { id: 'mixed-a', label: 'PoC mixed A', route: String.raw`/\evil.test/phish`, enabled: true },
        { id: 'mixed-b', label: 'PoC mixed B', route: String.raw`\/evil.test/phish`, enabled: true },
      ],
    });

    renderShell();
    expect(screen.queryByText('municipio')).not.toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Servicios seguros' })).toHaveAttribute(
      'href',
      '/t/junin/tramites',
    );

    for (const label of ['PoC slash', 'PoC backslash', 'PoC mixed A', 'PoC mixed B']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
      expect(screen.getByText(label)).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
