import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPublicBrandIdentity } from '@/utils/publicBrandIdentity';

const { useTenantMock } = vi.hoisted(() => ({ useTenantMock: vi.fn() }));
vi.mock('@/api/tenant', () => ({ getTenantPublicNavigation: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => useTenantMock() }));
vi.mock('./TenantSwitcher', () => ({ TenantSwitcher: () => null }));

import { TenantShell } from './TenantShell';

// Synthetic organization; the values only exercise the public contract.
const contract = {
  contract_version: 'public.brand_identity.v1',
  palette: ['#112233', '#445566', '#778899'],
  gradient_stops: [{ color: '#112233', x: 0, y: 0 }, { color: '#445566', x: 1, y: 1 }],
  text_color: '#778899',
  typography: { family: 'Synthetic Sans', fallback: '"Open Fallback", system-ui, sans-serif',
    stylesheet_url: 'https://fonts.googleapis.com/css2?family=Open+Fallback&display=swap', letter_spacing: '-0.02em' },
  logo: { mark: 'https://assets.example.test/brand/mark.png', alt: 'Organización sintética' },
};

const baseTenant = { slug: 'synthetic-org', nombre: 'Organización sintética', tipo: 'municipio', descripcion: null,
  logo_url: 'https://assets.example.test/brand/legacy.png' };
const tenantContext = (tenant: Record<string, unknown>) => ({
  tenant, currentSlug: tenant.slug, isLoadingTenant: false, tenantError: null, refreshTenant: vi.fn(),
  isCurrentTenantFollowed: false, followCurrentTenant: vi.fn(), unfollowCurrentTenant: vi.fn(),
  followedTenantsError: null, refreshFollowedTenants: vi.fn(),
});
const renderShell = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><TenantShell><div>Contenido</div></TenantShell></MemoryRouter>
  </QueryClientProvider>,
);

describe('TenantShell published brand identity', () => {
  beforeEach(() => { useTenantMock.mockReset(); });
  afterEach(() => { document.head.querySelectorAll('link[data-chatboc-brand-font]').forEach((link) => link.remove()); });

  it('shows the palette band, the published typography and the brand mark', () => {
    useTenantMock.mockReturnValue(tenantContext({ ...baseTenant, brand_identity: readPublicBrandIdentity(contract) }));
    const { container } = renderShell();
    const band = screen.getByTestId('tenant-brand-band');
    expect(band.style.backgroundImage).toContain('linear-gradient(90deg');
    expect(band).toHaveAttribute('aria-hidden', 'true');
    const root = container.querySelector<HTMLElement>('[data-brand-identity="published"]')!;
    expect(root.style.fontFamily).toContain('Synthetic Sans');
    expect(root.style.letterSpacing).toBe('-0.02em');
    expect(document.head.querySelector('link[data-chatboc-brand-font]')).toHaveAttribute('href', contract.typography.stylesheet_url);
    expect(container.querySelector('img')).toHaveAttribute('src', contract.logo.mark);
  });

  it('stays neutral without a published identity', () => {
    useTenantMock.mockReturnValue(tenantContext({ ...baseTenant, brand_identity: null }));
    const { container } = renderShell();
    expect(screen.queryByTestId('tenant-brand-band')).not.toBeInTheDocument();
    expect(container.querySelector('[data-brand-identity]')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', baseTenant.logo_url);
  });
});

describe('readPublicBrandIdentity', () => {
  it('rejects anything outside the contract', () => {
    expect(readPublicBrandIdentity({ ...contract, contract_version: 'other' })).toBeNull();
    expect(readPublicBrandIdentity({ ...contract, palette: ['#112233'] })).toBeNull();
    expect(readPublicBrandIdentity({ ...contract, palette: ['red', '#445566'] })).toBeNull();
    const unsafe = readPublicBrandIdentity({ ...contract,
      typography: { family: 'X; } body { color: red', stylesheet_url: 'https://evil.example/x.css' },
      logo: { mark: 'javascript:alert(1)', on_light: 'http://insecure.example/a.png' } });
    expect(unsafe?.typography).toBeUndefined();
    expect(unsafe?.logo).toBeUndefined();
    const stops = readPublicBrandIdentity({ ...contract, gradient_stops: [{ color: '#112233', x: 2, y: 0 }, { color: '#445566', x: 0, y: 0 }] });
    expect(stops?.gradientStops).toEqual([]);
  });
});
