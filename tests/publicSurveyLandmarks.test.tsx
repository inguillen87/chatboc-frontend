import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routeTenant: 'junin',
  listPublicSurveys: vi.fn(),
  getTenantPublicNavigation: vi.fn(),
  tenantContext: {
    tenant: { slug: 'default', nombre: 'Chatboc' } as Record<string, unknown> | null,
    currentSlug: null as string | null,
    isLoadingTenant: false,
    tenantError: null as string | null,
    refreshTenant: vi.fn(),
    isCurrentTenantFollowed: false,
    followCurrentTenant: vi.fn(),
    unfollowCurrentTenant: vi.fn(),
    followedTenantsError: null as string | null,
    refreshFollowedTenants: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ tenant: mocks.routeTenant }),
  };
});

vi.mock('@/api/encuestas', () => ({
  listPublicSurveys: mocks.listPublicSurveys,
}));

vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: mocks.getTenantPublicNavigation,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => mocks.tenantContext,
}));

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
}));

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('@/components/layout/Navbar', () => ({
  default: () => <nav aria-label="Navegacion de prueba" />,
}));

vi.mock('@/components/layout/Footer', () => ({
  default: () => <footer />,
}));

vi.mock('@/components/layout/DemoModeBanner', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/ScrollToTopButton', () => ({
  default: () => null,
}));

vi.mock('@/components/tenant/TenantSwitcher', () => ({
  TenantSwitcher: () => <div data-testid="tenant-switcher" />,
}));

vi.mock('@/components/surveys/SurveyQrPreview', () => ({
  SurveyQrPreview: () => <div data-testid="survey-qr" />,
}));

import Layout from '@/components/layout/Layout';
import SurveysPublicIndex from '@/pages/encuestas';
import TenantSurveyListPage from '@/pages/tenant/TenantSurveyListPage';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderRoute = (entry: string, element: React.ReactNode) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/encuestas" element={element} />
            <Route path="/t/:tenant/encuestas" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const expectSingleMainAndH1 = (headingName: string | RegExp) => {
  expect(document.querySelectorAll('main')).toHaveLength(1);
  expect(document.querySelectorAll('main main')).toHaveLength(0);
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1, name: headingName })).toBeVisible();
};

const prepareJuninTenant = () => {
  mocks.routeTenant = 'junin';
  Object.assign(mocks.tenantContext, {
    tenant: {
      slug: 'junin',
      nombre: 'Municipalidad de Junín',
      tipo: 'municipio',
      descripcion: 'Portal municipal',
    },
    currentSlug: 'junin',
  });
};

const juninSurveyNavigation = {
  tenant_slug: 'junin',
  items: [
    {
      id: 'encuestas',
      label: 'Encuestas',
      route: '/t/junin/encuestas',
      endpoint: '/api/public/encuestas/v1',
      visible: true,
      enabled: true,
    },
  ],
};

describe('public survey document landmarks', () => {
  beforeEach(() => {
    Object.assign(mocks.tenantContext, {
      tenant: { slug: 'default', nombre: 'Chatboc' },
      currentSlug: null,
      isLoadingTenant: false,
      tenantError: null,
      followedTenantsError: null,
      isCurrentTenantFollowed: false,
    });
    mocks.listPublicSurveys.mockReset();
    mocks.listPublicSurveys.mockResolvedValue([]);
    mocks.getTenantPublicNavigation.mockReset();
    mocks.getTenantPublicNavigation.mockResolvedValue({ items: [] });
    mocks.routeTenant = 'junin';
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  });

  afterEach(() => cleanup());

  it.each(['/encuestas', '/encuestas?tenant_slug=default'])(
    'keeps one main, one real H1 and a named page region for %s',
    async (entry) => {
      renderRoute(entry, <SurveysPublicIndex />);

      const title = await screen.findByRole('heading', {
        level: 1,
        name: 'Elegí una organización para ver sus encuestas',
      });
      expectSingleMainAndH1('Elegí una organización para ver sus encuestas');
      expect(title.closest('section')).toHaveAccessibleName('Elegí una organización para ver sus encuestas');
      expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
    },
  );

  it('preserves the same semantics while tenant scope is loading', async () => {
    Object.assign(mocks.tenantContext, { isLoadingTenant: true, tenant: null });

    renderRoute('/encuestas', <SurveysPublicIndex />);

    expect(await screen.findByRole('status')).toHaveAccessibleName('Identificando tu organización…');
    expectSingleMainAndH1('Identificando tu organización…');
  });

  it.each([
    { name: 'loading', load: () => new Promise<never>(() => undefined), heading: 'Cargando encuestas' },
    { name: 'empty', load: () => Promise.resolve([]), heading: 'Por ahora no hay encuestas activas' },
    { name: 'error', load: () => Promise.reject(new Error('Fallo controlado')), heading: 'No pudimos cargar las encuestas' },
  ])('preserves one named H1 in the explicit-tenant $name state', async ({ load, heading }) => {
    mocks.listPublicSurveys.mockImplementationOnce(load);

    renderRoute('/encuestas?tenant_slug=junin', <SurveysPublicIndex />);

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible();
    expectSingleMainAndH1(heading);
    expect(screen.getByRole('region', { name: heading })).toBeVisible();
  });

  it('keeps the canonical Junin page under the shell H1 and a named surveys region', async () => {
    prepareJuninTenant();
    mocks.getTenantPublicNavigation.mockResolvedValue(juninSurveyNavigation);

    renderRoute('/t/junin/encuestas', <TenantSurveyListPage />);

    await waitFor(() => expect(mocks.listPublicSurveys).toHaveBeenCalledWith('junin'));
    expect(await screen.findByRole('heading', { name: 'No hay instancias activas' })).toBeVisible();
    expectSingleMainAndH1('Municipalidad de Junín');
    expect(screen.getByRole('region', { name: 'Encuestas' })).toBeVisible();
  });

  it('keeps the canonical shell H1 and surveys region while navigation is loading', async () => {
    prepareJuninTenant();
    mocks.getTenantPublicNavigation.mockImplementation(() => new Promise<never>(() => undefined));

    renderRoute('/t/junin/encuestas', <TenantSurveyListPage />);

    expect(await screen.findByRole('heading', { name: 'Cargando participacion' })).toBeVisible();
    expectSingleMainAndH1('Municipalidad de Junín');
    expect(screen.getByRole('region', { name: 'Encuestas' })).toBeVisible();
  });

  it('keeps the canonical shell H1 and surveys region when the list fails', async () => {
    prepareJuninTenant();
    mocks.getTenantPublicNavigation.mockResolvedValue(juninSurveyNavigation);
    mocks.listPublicSurveys.mockRejectedValueOnce(new Error('Fallo controlado'));

    renderRoute('/t/junin/encuestas', <TenantSurveyListPage />);

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar la participacion' })).toBeVisible();
    expectSingleMainAndH1('Municipalidad de Junín');
    expect(screen.getByRole('region', { name: 'Encuestas' })).toBeVisible();
  });
});
