import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getNavigation: vi.fn(),
  listNews: vi.fn(),
  listEvents: vi.fn(),
  listSurveys: vi.fn(),
  useTenant: vi.fn(),
}));

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: (...args: unknown[]) => mocks.getNavigation(...args),
  listTenantNews: (...args: unknown[]) => mocks.listNews(...args),
  listTenantEvents: (...args: unknown[]) => mocks.listEvents(...args),
}));
vi.mock('@/api/encuestas', () => ({
  listPublicSurveys: (...args: unknown[]) => mocks.listSurveys(...args),
}));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => mocks.useTenant() }));
vi.mock('@/components/knowledge/InstitutionalAssistant', () => ({
  default: ({
    publicLayout,
    onPublicKnowledgeState,
  }: {
    publicLayout?: string;
    onPublicKnowledgeState?: (state: string) => void;
  }) => {
    React.useEffect(() => onPublicKnowledgeState?.('published'), [onPublicKnowledgeState]);
    return (
      <section data-testid="institutional-assistant" data-public-layout={publicLayout}>
        Temas publicados
      </section>
    );
  },
}));

import TenantHomePage from './TenantHomePage';
import { tenantPublicServiceKind } from '@/hooks/useTenantPublicServices';

const navigation = {
  contract_version: 'tenant.public_navigation.v1',
  tenant_slug: 'junin',
  items: [
    { id: 'home', label: 'Inicio', route: '/t/junin', enabled: true, visible: true },
    { id: 'news', label: 'Noticias institucionales', route: '/t/junin/noticias', enabled: true, visible: true },
    { id: 'events', label: 'Eventos y agenda', route: '/t/junin/eventos', enabled: true, visible: true },
    {
      id: 'surveys',
      label: 'Encuestas abiertas',
      route: '/t/junin/encuestas',
      endpoint: '/api/public/tenants/junin/surveys',
      enabled: true,
      visible: true,
    },
    { id: 'new_claim', label: 'Nuevo reclamo', route: '/t/junin/reclamos/nuevo', enabled: true, visible: true },
  ],
};

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={['/t/junin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/t/:tenant" element={<TenantHomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
};

describe('TenantHomePage confirmed public service availability', () => {
  beforeEach(() => {
    mocks.getNavigation.mockReset().mockResolvedValue(navigation);
    mocks.listNews.mockReset().mockResolvedValue([]);
    mocks.listEvents.mockReset().mockResolvedValue([]);
    mocks.listSurveys.mockReset().mockResolvedValue([]);
    mocks.useTenant.mockReset().mockReturnValue({
      tenant: {
        slug: 'junin',
        nombre: 'Municipio de Junín',
        tipo: 'municipio',
        descripcion: null,
        logo_url: null,
        brand_identity: null,
      },
      currentSlug: 'junin',
      isLoadingTenant: false,
      tenantError: null,
      refreshTenant: vi.fn(),
      hostBinding: null,
      widgetToken: null,
      isCurrentTenantFollowed: false,
      followCurrentTenant: vi.fn(),
      unfollowCurrentTenant: vi.fn(),
      followedTenantsError: null,
      refreshFollowedTenants: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not confuse service words inside the organization slug with a published service', () => {
    expect(tenantPublicServiceKind({
      id: 'home',
      label: 'Inicio',
      route: '/t/event-center',
    }, 'event-center')).toBe('other');
    expect(tenantPublicServiceKind({
      id: 'claim_tracking',
      label: 'Ver seguimiento',
      route: '/t/event-center/seguimiento',
    }, 'event-center')).toBe('other');
    expect(tenantPublicServiceKind({
      id: 'new_claim',
      label: 'Nuevo reclamo',
      route: '/t/event-center/reclamos/nuevo',
    }, 'event-center')).toBe('tickets');
    expect(tenantPublicServiceKind({
      id: 'participation',
      label: 'Encuestas abiertas',
      endpoint: '/api/public/tenants/event-center/surveys?tenant_slug=event-center',
    }, 'event-center')).toBe('surveys');
  });

  it('omits empty collection tabs, direct accesses and sections while keeping a published claim', async () => {
    const view = renderPage();

    await waitFor(() => {
      expect(mocks.listNews).toHaveBeenCalledWith('junin');
      expect(mocks.listEvents).toHaveBeenCalledWith('junin');
      expect(mocks.listSurveys).toHaveBeenCalledWith('junin');
    });

    const navigationRegion = screen.getByRole('navigation', { name: 'Secciones del espacio' });
    expect(within(navigationRegion).queryByRole('link', { name: 'Noticias institucionales' })).not.toBeInTheDocument();
    expect(within(navigationRegion).queryByRole('link', { name: 'Eventos y agenda' })).not.toBeInTheDocument();
    expect(within(navigationRegion).queryByRole('link', { name: 'Encuestas abiertas' })).not.toBeInTheDocument();
    expect(within(navigationRegion).getByRole('link', { name: 'Nuevo reclamo' })).toHaveAttribute(
      'href',
      '/t/junin/reclamos/nuevo',
    );

    expect(screen.queryByRole('link', { name: 'Noticias' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Eventos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Encuestas abiertas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Noticias institucionales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Eventos y agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Encuestas abiertas' })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Hacer un reclamo o pedido' })).toHaveAttribute(
      'href',
      '/t/junin/reclamos/nuevo',
    );
    await waitFor(() => expect(screen.getByTestId('institutional-assistant'))
      .toHaveAttribute('data-public-layout', 'services'));
    expect(mocks.getNavigation).toHaveBeenCalledTimes(1);
    expect(mocks.listNews).toHaveBeenCalledTimes(1);
    expect(mocks.listEvents).toHaveBeenCalledTimes(1);
    expect(mocks.listSurveys).toHaveBeenCalledTimes(1);

    view.unmount();
    view.client.clear();
  });
});
