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

vi.mock('@/api/tenant', () => ({
  followTenant: tenantApiMocks.followTenant,
  getTenantPublicInfoFlexible: tenantApiMocks.getTenantPublicInfoFlexible,
  listFollowedTenants: tenantApiMocks.listFollowedTenants,
  unfollowTenant: tenantApiMocks.unfollowTenant,
}));

vi.mock('@/utils/anonId', () => ({
  ensureRemoteAnonId: vi.fn().mockResolvedValue('anon-test'),
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
});
