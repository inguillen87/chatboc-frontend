import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getTenantPublicNavigationMock,
  listTenantEventsMock,
  listTenantNewsMock,
  listPublicSurveysMock,
  useTenantMock,
} = vi.hoisted(() => ({
  getTenantPublicNavigationMock: vi.fn(),
  listTenantEventsMock: vi.fn(),
  listTenantNewsMock: vi.fn(),
  listPublicSurveysMock: vi.fn(),
  useTenantMock: vi.fn(),
}));

vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: (...args: unknown[]) => getTenantPublicNavigationMock(...args),
  listTenantEvents: (...args: unknown[]) => listTenantEventsMock(...args),
  listTenantNews: (...args: unknown[]) => listTenantNewsMock(...args),
}));

vi.mock('@/api/encuestas', () => ({
  listPublicSurveys: (...args: unknown[]) => listPublicSurveysMock(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('@/components/tenant/TenantShell', () => ({
  TenantShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import TenantHomePage from './TenantHomePage';

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin']}>
        <Routes>
          <Route path="/t/:tenant" element={<TenantHomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('TenantHomePage public navigation security', () => {
  beforeEach(() => {
    getTenantPublicNavigationMock.mockReset();
    listTenantEventsMock.mockReset().mockResolvedValue([]);
    listTenantNewsMock.mockReset().mockResolvedValue([]);
    listPublicSurveysMock.mockReset().mockResolvedValue([]);
    useTenantMock.mockReset().mockReturnValue({
      tenant: {
        slug: 'junin',
        nombre: 'Municipio de Junín',
      },
      currentSlug: 'junin',
    });
  });

  it('keeps an ordinary contract route tenant-bound', async () => {
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        {
          id: 'new_claim',
          label: 'Nuevo reclamo seguro',
          route: '/t/junin/reclamos/nuevo',
          enabled: true,
          visible: true,
        },
      ],
    });

    renderPage();

    expect(await screen.findByRole('link', { name: /nuevo reclamo seguro/i })).toHaveAttribute(
      'href',
      '/t/junin/reclamos/nuevo',
    );
  });

  it('does not invent a fallback action when the public contract has no valid item', async () => {
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [],
    });

    renderPage();

    expect(await screen.findByText(/todavia no publico canales visibles/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /iniciar gestion/i })).not.toBeInTheDocument();
  });

  it.each([
    '//evil.test/phish',
    String.raw`\\evil.test\phish`,
    String.raw`/\evil.test/phish`,
    String.raw`\/evil.test/phish`,
  ])('does not render the mixed-separator open redirect PoC %s', async (route) => {
    getTenantPublicNavigationMock.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        {
          id: 'news',
          label: 'Noticias seguras',
          route: '/t/junin/noticias',
          enabled: true,
          visible: true,
        },
        {
          id: 'new_claim',
          label: 'Nuevo reclamo PoC',
          route,
          enabled: true,
          visible: true,
        },
      ],
    });

    const { container } = renderPage();

    expect(await screen.findByRole('link', { name: 'Ver todo' })).toHaveAttribute(
      'href',
      '/t/junin/noticias',
    );
    await waitFor(() => expect(getTenantPublicNavigationMock).toHaveBeenCalledWith('junin'));
    expect(screen.queryByRole('link', { name: /nuevo reclamo poc/i })).not.toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll('a')).some(
        (anchor) => new URL(anchor.href).hostname === 'evil.test',
      ),
    ).toBe(false);
  });
});
