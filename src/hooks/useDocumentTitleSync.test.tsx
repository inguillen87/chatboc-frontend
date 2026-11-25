import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

import { useDocumentTitleSync } from './useDocumentTitleSync';
import { TenantShell } from '@/components/tenant/TenantShell';
import { LANDING_TITLE } from '@/utils/pageTitles';
import type { TenantHostBinding } from '@/utils/tenantHostBinding';

const mocks = vi.hoisted(() => ({
  tenantState: {
    tenant: null as { slug?: string; nombre?: string; tipo?: string } | null,
    currentSlug: null as string | null,
    isLoadingTenant: false,
    tenantError: null as string | null,
    hostBinding: null as TenantHostBinding | null,
    refreshTenant: vi.fn(),
    isCurrentTenantFollowed: false,
    followCurrentTenant: vi.fn(),
    unfollowCurrentTenant: vi.fn(),
    followedTenantsError: null as string | null,
    refreshFollowedTenants: vi.fn(),
    widgetToken: null as string | null,
  },
  privateShell: {
    active: false,
    identity: null as { name: string; tenantSlug: string; logoUrl: string | null } | null,
  },
  navigation: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => mocks.tenantState,
}));

vi.mock('@/hooks/usePrivateWorkspacePresentation', () => ({
  usePrivateWorkspacePresentation: () => mocks.privateShell,
}));

vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: mocks.navigation,
}));

vi.mock('@/components/tenant/TenantSwitcher', () => ({
  TenantSwitcher: () => null,
}));

function TitleSyncProbe({ portalOnly = false }: { portalOnly?: boolean }) {
  useDocumentTitleSync({ portalOnly });
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/')}>Inicio</button>
      <button onClick={() => navigate('/demo')}>Demo</button>
      <button onClick={() => navigate('/login')}>Login</button>
      <button onClick={() => navigate('/perfil?tab=tickets')}>Tickets</button>
      <button onClick={() => navigate('/t/junin/portal/dashboard')}>Portal Junín</button>
      <button onClick={() => navigate('/t/comercio-sur/market')}>Catálogo Comercio</button>
    </div>
  );
}

describe('useDocumentTitleSync and white-label titles', () => {
  beforeEach(() => {
    document.title = 'Inicial';
    mocks.navigation.mockReset().mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      items: [],
    });
    Object.assign(mocks.tenantState, {
      tenant: null,
      currentSlug: null,
      isLoadingTenant: false,
      tenantError: null,
      hostBinding: null,
    });
    Object.assign(mocks.privateShell, {
      active: false,
      identity: null,
    });
  });

  afterEach(() => {
    cleanup();
    document.title = '';
  });

  it('updates document.title coherently across Chatboc platform routes', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/']}>
        <TitleSyncProbe />
      </MemoryRouter>,
    );

    expect(document.title).toBe(LANDING_TITLE);

    act(() => {
      view.getByText('Demo').click();
    });
    expect(document.title).toBe('Demo · Chatboc');

    act(() => {
      view.getByText('Login').click();
    });
    expect(document.title).toBe('Ingresar · Chatboc');

    act(() => {
      view.getByText('Tickets').click();
    });
    expect(document.title).toBe('Tickets · Chatboc');

    act(() => {
      view.getByText('Inicio').click();
    });
    expect(document.title).toBe(LANDING_TITLE);
  });

  it('uses organization name in white-label /t/:slug non-shell routes only when authoritative', () => {
    mocks.tenantState.currentSlug = 'junin';
    mocks.tenantState.tenant = { slug: 'junin', nombre: 'Municipalidad de Junín' };

    const view = render(
      <MemoryRouter initialEntries={['/t/junin/portal/dashboard']}>
        <TitleSyncProbe />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Municipalidad de Junín · Portal');

    // Mismatched tenant while navigating to another org must not leak Junín
    document.title = 'Inicial';
    act(() => {
      view.getByText('Catálogo Comercio').click();
    });
    expect(document.title).toBe('Inicial');
  });

  it('does not overwrite white-label private workspace title managed by PrivateWorkspaceBrand', () => {
    document.title = 'Tierra del Fuego · Panel';
    mocks.privateShell.active = true;
    mocks.privateShell.identity = {
      name: 'Tierra del Fuego',
      tenantSlug: 'tierra-del-fuego',
      logoUrl: null,
    };

    render(
      <MemoryRouter initialEntries={['/integracion']}>
        <TitleSyncProbe />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Tierra del Fuego · Panel');
  });

  it('uses custom host organization name on private host routes without platform branding', () => {
    mocks.tenantState.hostBinding = {
      host: 'atencion.junin.gob.ar',
      identity: {
        tenantId: 12,
        tenantSlug: 'junin',
        name: 'Municipalidad de Junín',
        logoUrl: null,
      },
      tenant: { id: 12, slug: 'junin', name: 'Municipalidad de Junín' },
    } as unknown as TenantHostBinding;
    mocks.privateShell.active = true;

    render(
      <MemoryRouter initialEntries={['/perfil']}>
        <TitleSyncProbe />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Municipalidad de Junín · Panel');
  });

  it('renders TenantShell with section labels for Portal and Información y orientación', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.tenantState.currentSlug = 'junin';
    mocks.tenantState.tenant = { slug: 'junin', nombre: 'Municipalidad de Junín', tipo: 'municipio' };

    const view = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/t/junin']}>
          <Routes>
            <Route
              path="/t/:tenant"
              element={
                <TenantShell titleSection="Portal">
                  <p>Contenido</p>
                </TenantShell>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(document.title).toBe('Municipalidad de Junín · Portal'));

    mocks.tenantState.currentSlug = 'tierra-del-fuego';
    mocks.tenantState.tenant = {
      slug: 'tierra-del-fuego',
      nombre: 'Tierra del Fuego',
      tipo: 'gobierno',
    };

    view.rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/t/tierra-del-fuego']}>
          <Routes>
            <Route
              path="/t/:tenant"
              element={
                <TenantShell compactHeader titleSection="Información y orientación">
                  <p>Contenido</p>
                </TenantShell>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(document.title).toBe('Tierra del Fuego · Información y orientación'));
  });
});
