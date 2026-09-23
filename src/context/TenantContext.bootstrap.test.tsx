import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantProvider, useTenant } from './TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const tenantApiMocks = vi.hoisted(() => ({
  followTenant: vi.fn(),
  getTenantPublicInfoFlexible: vi.fn(),
  listFollowedTenants: vi.fn(),
  unfollowTenant: vi.fn(),
}));

const anonIdMocks = vi.hoisted(() => ({
  ensureRemoteAnonId: vi.fn(),
}));

vi.mock('@/api/tenant', () => ({
  followTenant: tenantApiMocks.followTenant,
  getTenantPublicInfoFlexible: tenantApiMocks.getTenantPublicInfoFlexible,
  listFollowedTenants: tenantApiMocks.listFollowedTenants,
  unfollowTenant: tenantApiMocks.unfollowTenant,
}));

vi.mock('@/utils/anonId', () => ({
  ensureRemoteAnonId: anonIdMocks.ensureRemoteAnonId,
}));

const TenantProbe = () => {
  const { currentSlug, isLoadingTenant } = useTenant();
  return (
    <output>
      {isLoadingTenant ? 'loading' : 'ready'}:{currentSlug ?? 'none'}
    </output>
  );
};

describe('TenantProvider global route bootstrap', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    delete (window as any).CHATBOC_CONFIG;
    document.querySelectorAll('[data-tenant-bootstrap-test]').forEach((node) => node.remove());
    tenantApiMocks.getTenantPublicInfoFlexible.mockReset();
    tenantApiMocks.listFollowedTenants.mockReset().mockResolvedValue([]);
    anonIdMocks.ensureRemoteAnonId.mockReset().mockResolvedValue('anon-test');
  });

  afterEach(() => {
    delete (window as any).CHATBOC_CONFIG;
    document.querySelectorAll('[data-tenant-bootstrap-test]').forEach((node) => node.remove());
  });

  it('does not interpret /superadmin as a tenant or request tenant-info', async () => {
    render(
      <MemoryRouter
        initialEntries={['/superadmin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:none')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).not.toHaveBeenCalled();
    expect(tenantApiMocks.listFollowedTenants).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('tenantSlug')).toBeNull();
  });

  it('ignores every ambient tenant source on /superadmin and preserves the stored preference', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');
    (window as any).CHATBOC_CONFIG = {
      tenantSlug: 'config-tenant',
      entityToken: 'widget-token-from-config',
    };
    const script = document.createElement('script');
    script.dataset.tenantBootstrapTest = 'true';
    script.dataset.tenant = 'script-tenant';
    script.dataset.widgetToken = 'widget-token-from-script';
    document.body.appendChild(script);

    render(
      <MemoryRouter
        initialEntries={[
          '/superadmin/tenants?tenant_slug=query-tenant&widget_token=widget-token-from-query',
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:none')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).not.toHaveBeenCalled();
    expect(tenantApiMocks.listFollowedTenants).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect((window as any).currentTenantSlug).toBeNull();
  });

  it('keeps the exact institutional demo independent from ambient or persisted tenants', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');
    (window as any).CHATBOC_CONFIG = {
      tenantSlug: 'config-tenant',
      entityToken: 'widget-token-from-config',
    };

    render(
      <MemoryRouter
        initialEntries={[
          '/demo/institucional/tdf-discapacidad?tenant_slug=query-tenant&widget_token=query-token',
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:none')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).not.toHaveBeenCalled();
    expect(tenantApiMocks.listFollowedTenants).not.toHaveBeenCalled();
    expect(anonIdMocks.ensureRemoteAnonId).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect((window as any).currentTenantSlug).toBeNull();
  });

  it.each([
    '/demo?sector=gobierno&tenant_slug=junin',
    '/demo/gobierno?tenant_slug=junin',
  ])('keeps public presentation %s independent from private and PWA bootstrap', async (entry) => {
    safeLocalStorage.setItem('tenantSlug', 'persisted-tenant');
    (window as any).CHATBOC_CONFIG = {
      tenantSlug: 'config-tenant',
      entityToken: 'widget-token-from-config',
    };

    render(
      <MemoryRouter
        initialEntries={[entry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:none')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).not.toHaveBeenCalled();
    expect(tenantApiMocks.listFollowedTenants).not.toHaveBeenCalled();
    expect(anonIdMocks.ensureRemoteAnonId).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('persisted-tenant');
    expect((window as any).currentTenantSlug).toBeNull();
  });

  it('does not broaden tenant suppression to similar demo URLs', async () => {
    tenantApiMocks.getTenantPublicInfoFlexible.mockResolvedValue({
      slug: 'institucional',
      nombre: 'Tenant de prueba',
      logo_url: null,
      tema: null,
      tipo: 'municipio',
      descripcion: null,
      public_base_url: null,
      public_cart_url: null,
      public_catalog_url: null,
      whatsapp_share_url: null,
    });

    render(
      <MemoryRouter
        initialEntries={['/demo/institucional/otra']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(tenantApiMocks.getTenantPublicInfoFlexible).toHaveBeenCalled());
    expect(tenantApiMocks.getTenantPublicInfoFlexible).toHaveBeenCalledWith('institucional', null);
    expect(anonIdMocks.ensureRemoteAnonId).toHaveBeenCalledTimes(1);
  });

  it('keeps the embedded widget tenant-aware', async () => {
    tenantApiMocks.getTenantPublicInfoFlexible.mockResolvedValue({
      slug: 'junin',
      nombre: 'Municipalidad de Junín',
      logo_url: null,
      tema: null,
      tipo: 'municipio',
      descripcion: null,
      public_base_url: null,
      public_cart_url: null,
      public_catalog_url: null,
      whatsapp_share_url: null,
    });

    render(
      <MemoryRouter
        initialEntries={['/iframe?tenant_slug=junin&widget_token=widget-token']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:junin')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).toHaveBeenCalledWith(
      'junin',
      'widget-token',
    );
    expect(anonIdMocks.ensureRemoteAnonId).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      widgetToken: 'widget-token',
    });
  });

  it('keeps /perfil tenant-aware with the stored tenant preference', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');
    tenantApiMocks.getTenantPublicInfoFlexible.mockResolvedValue({
      slug: 'junin',
      nombre: 'Municipalidad de Junín',
      logo_url: null,
      tema: null,
      tipo: 'municipio',
      descripcion: null,
      public_base_url: null,
      public_cart_url: null,
      public_catalog_url: null,
      whatsapp_share_url: null,
    });

    render(
      <MemoryRouter
        initialEntries={['/perfil']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:junin')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).toHaveBeenCalledWith('junin', null);
    expect(tenantApiMocks.listFollowedTenants).toHaveBeenCalledWith('junin', null);
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
  });

  it('keeps the stored tenant passive without tenant-info or followed-tenant calls', async () => {
    safeLocalStorage.setItem('tenantSlug', 'junin');

    render(
      <MemoryRouter
        initialEntries={['/t/junin/inbox']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TenantProvider bootstrapEnabled={false}>
          <TenantProbe />
        </TenantProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ready:none')).toBeInTheDocument());

    expect(tenantApiMocks.getTenantPublicInfoFlexible).not.toHaveBeenCalled();
    expect(tenantApiMocks.listFollowedTenants).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
  });
});
