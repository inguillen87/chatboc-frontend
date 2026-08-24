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
  authority: {
    clerkStatus: 'signed_out' as 'disabled' | 'loading' | 'signed_out' | 'syncing' | 'ready',
    hasBearerSession: false,
    hasVerifiedSession: false,
  },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: claimsMocks.user, isLoading: false }),
}));

vi.mock('@/components/access/SessionAuthorityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/access/SessionAuthorityContext')>()),
  useSessionAuthority: () => claimsMocks.authority,
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
    claimsMocks.authority = {
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
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

  it.each([
    {
      label: 'Clerk ready cookie-only',
      authority: { clerkStatus: 'ready' as const, hasBearerSession: false, hasVerifiedSession: true },
    },
    {
      label: 'verified legacy bearer',
      authority: { clerkStatus: 'disabled' as const, hasBearerSession: true, hasVerifiedSession: true },
    },
  ])('loads and renders private claims for $label authority', async ({ authority }) => {
    claimsMocks.user = { id: 'user-7', email: 'vecino@example.com' };
    claimsMocks.authority = authority;
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

  it.each(['loading', 'signed_out'] as const)(
    'does not call listClaims or expose stale profile PII while Clerk is %s',
    async (clerkStatus) => {
      claimsMocks.user = {
        id: 'stale-user',
        name: 'Persona Stale Privada',
        email: 'stale-claims@example.test',
      };
      claimsMocks.publicClaims = [];
      claimsMocks.authority = {
        clerkStatus,
        hasBearerSession: clerkStatus === 'loading',
        hasVerifiedSession: false,
      };

      render(
        <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
          <UserClaimsPage />
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByText(/No tenes reclamos registrados aun/i)).toBeInTheDocument());
      expect(claimsMocks.listClaims).not.toHaveBeenCalled();
      expect(screen.queryByText(/Persona Stale Privada|stale-claims@example\.test/)).not.toBeInTheDocument();
    },
  );

  it('hides user A claims synchronously during A to B authority rotation', async () => {
    const userBClaims = deferred<any[]>();
    claimsMocks.user = { id: 'user-a', email: 'a@example.test' };
    claimsMocks.publicClaims = [];
    claimsMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    claimsMocks.listClaims
      .mockResolvedValueOnce([
        {
          id: 'claim-a',
          title: 'Reclamo privado A',
          description: 'PII exclusiva de A',
          status: 'en_proceso',
          date: '2026-08-20T12:00:00Z',
        },
      ])
      .mockImplementationOnce(() => userBClaims.promise);

    const view = render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Reclamo privado A')).toBeInTheDocument();

    claimsMocks.authority = {
      clerkStatus: 'syncing',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    view.rerender(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Reclamo privado A')).not.toBeInTheDocument();
    expect(screen.queryByText('PII exclusiva de A')).not.toBeInTheDocument();

    claimsMocks.user = { id: 'user-b', email: 'b@example.test' };
    claimsMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    view.rerender(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Reclamo privado A')).not.toBeInTheDocument();

    userBClaims.resolve([]);
    await waitFor(() => expect(claimsMocks.listClaims).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Reclamo privado A')).not.toBeInTheDocument();
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

  it.each([
    '//evil.test/phish',
    String.raw`\\evil.test\phish`,
    String.raw`/\evil.test/phish`,
    String.raw`\/evil.test/phish`,
  ])('fails closed for the mixed-separator new-claim PoC %s', async (route) => {
    claimsMocks.publicClaims = [];
    claimsMocks.getTenantPublicNavigation.mockResolvedValueOnce({
      contract_version: 'tenant.public_navigation.v1',
      tenant_slug: 'junin',
      items: [
        {
          id: 'new_claim',
          label: 'Nuevo reclamo',
          route,
          enabled: true,
          visible: true,
        },
      ],
    });

    const { container } = render(
      <MemoryRouter future={routerFuture} initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /vincular seguimiento/i })).toBeInTheDocument();
    await waitFor(() => expect(claimsMocks.getTenantPublicNavigation).toHaveBeenCalledWith('junin'));
    expect(screen.queryByRole('link', { name: /^nuevo reclamo$/i })).not.toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll('a')).some(
        (anchor) => new URL(anchor.href).hostname === 'evil.test',
      ),
    ).toBe(false);
  });
});
