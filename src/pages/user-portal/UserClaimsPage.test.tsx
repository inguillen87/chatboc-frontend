import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserClaimsPage from './UserClaimsPage';

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

const claimsMocks = vi.hoisted(() => ({
  publicClaims: [] as any[],
  user: null as any,
  listClaims: vi.fn(),
  getTenantPublicNavigation: vi.fn(),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: claimsMocks.user, isLoading: false }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin', widgetToken: null }),
}));

vi.mock('@/hooks/usePortalContent', () => ({
  usePortalContent: () => ({
    commerceSession: null,
    publicClaims: claimsMocks.publicClaims,
    isLoading: false,
  }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    listClaims: claimsMocks.listClaims,
  },
}));

vi.mock('@/api/widgetCommerce', () => ({
  getWidgetClaimDetail: vi.fn(),
}));

vi.mock('@/api/tenant', () => ({
  getTenantPublicNavigation: claimsMocks.getTenantPublicNavigation,
}));

describe('UserClaimsPage public claim actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimsMocks.user = null;
    claimsMocks.listClaims.mockResolvedValue([]);
    claimsMocks.getTenantPublicNavigation.mockResolvedValue({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        {
          id: 'new_claim',
          label: 'Nuevo reclamo',
          route: '/t/junin/reclamos/nuevo',
          enabled: true,
          visible: true,
        },
      ],
    });
    claimsMocks.publicClaims = [
      {
        id: 'claim-42',
        nroTicket: 'M-378430',
        pin: '900144',
        title: 'Arreglo de calle',
        status: 'en_proceso',
        statusLabel: 'En proceso',
        channel: 'whatsapp',
        commentEndpoint: '/chat',
        photoEndpoint: '/api/public/tracking/claims/42/messages',
        attachments: [],
        timeline: [],
      },
    ];
  });

  it('keeps legacy comment and photo actions inside secure claim tracking', () => {
    render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );

    const commentLink = screen.getByRole('link', { name: /agregar comentario/i });
    const photoLink = screen.getByRole('link', { name: /agregar foto/i });

    expect(commentLink).toHaveAttribute('href', '/tracking/claim/378430#pin=900144&focus=mesa-ayuda');
    expect(photoLink).toHaveAttribute('href', '/tracking/claim/378430#pin=900144&focus=mesa-ayuda');
    expect(commentLink).not.toHaveAttribute('href', '/chat');
    expect(commentLink).not.toHaveAttribute('target', '_blank');
    expect(photoLink).not.toHaveAttribute('target', '_blank');
  });

  it('loads and renders authenticated claims from the portal claims contract', async () => {
    claimsMocks.user = { id: 'user-7', email: 'vecino@example.com' };
    claimsMocks.publicClaims = [];
    claimsMocks.listClaims.mockResolvedValueOnce([
      {
        id: '42',
        title: 'Alumbrado publico',
        description: 'La luminaria de la esquina no funciona',
        status: 'en_proceso',
        date: '2026-07-10T12:00:00Z',
        updated_at: '2026-07-11T09:30:00Z',
      },
    ]);

    render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Alumbrado publico')).toBeInTheDocument();
    expect(screen.getByText('La luminaria de la esquina no funciona')).toBeInTheDocument();
    expect(screen.getByText('En proceso')).toBeInTheDocument();
    await waitFor(() => expect(claimsMocks.listClaims).toHaveBeenCalledWith('junin'));
  });

  it('always offers session linking to guests and shows new claim when the tenant enables it', async () => {
    claimsMocks.publicClaims = [];

    render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /vincular seguimiento/i })).toHaveAttribute(
      'href',
      '/t/junin/portal/cuenta',
    );
    expect(await screen.findByRole('link', { name: /nuevo reclamo/i })).toHaveAttribute(
      'href',
      '/t/junin/reclamos/nuevo',
    );
    expect(claimsMocks.listClaims).not.toHaveBeenCalled();
  });

  it('keeps session linking but hides new claim when the tenant disables it', async () => {
    claimsMocks.publicClaims = [];
    claimsMocks.getTenantPublicNavigation.mockResolvedValueOnce({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        {
          id: 'new_claim',
          label: 'Nuevo reclamo',
          route: '/t/junin/reclamos/nuevo',
          enabled: false,
          visible: true,
        },
      ],
    });

    render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /vincular seguimiento/i })).toBeInTheDocument();
    await waitFor(() => expect(claimsMocks.getTenantPublicNavigation).toHaveBeenCalledWith('junin'));
    expect(screen.queryByRole('link', { name: /nuevo reclamo/i })).not.toBeInTheDocument();
  });
});
