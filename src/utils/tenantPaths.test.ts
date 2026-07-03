import { describe, it, expect } from 'vitest';
import {
  buildTenantPath,
  buildTenantApiPath,
  resolveTenantPublicNavigationTarget,
} from './tenantPaths';

describe('buildTenantPath', () => {
  it('should prepend tenant slug to clean path', () => {
    expect(buildTenantPath('/cart', 'municipio')).toBe('/t/municipio/cart');
  });

  it('should canonicalize direct slug paths', () => {
    expect(buildTenantPath('/municipio/cart', 'municipio')).toBe('/t/municipio/cart');
  });

  it('should keep canonical /t/:slug paths unchanged', () => {
    expect(buildTenantPath('/t/municipio/cart', 'municipio')).toBe('/t/municipio/cart');
  });

  it('should return original path if no slug', () => {
    expect(buildTenantPath('/cart', undefined)).toBe('/cart');
  });

  it('should handle paths without leading slash', () => {
    expect(buildTenantPath('cart', 'junin')).toBe('/t/junin/cart');
  });

  it('should replace legacy tenant prefix with current slug', () => {
    expect(buildTenantPath('/pyme/cart', 'junin')).toBe('/t/junin/cart');
  });

  it('should replace long-form tenant prefix with current slug', () => {
    expect(buildTenantPath('/tenant/perfil/pedidos', 'junin')).toBe('/t/junin/perfil/pedidos');
  });

  it('should not treat finance webview reserved segments as tenant slugs', () => {
    expect(buildTenantPath('/cart', 'finanzas')).toBe('/cart');
    expect(buildTenantPath('/cart', 'finance')).toBe('/cart');
  });
});

describe('buildTenantApiPath', () => {
  it('should return api path with tenant', () => {
    expect(buildTenantApiPath('/productos', 'municipio')).toBe('/api/municipio/productos');
  });

  it('should return generic api path if no slug', () => {
    expect(buildTenantApiPath('/productos', null)).toBe('/api/productos');
  });
});

describe('resolveTenantPublicNavigationTarget', () => {
  it('keeps public tenant routes inside the tenant space', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'surveys', label: 'Encuestas', route: 'encuestas' },
        '/t/junin',
      ),
    ).toBe('/t/junin/encuestas');
  });

  it('maps protected ticket desk aliases to the public claim intake', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'tickets', label: 'Tickets', route: 'tickets' },
        '/t/junin',
      ),
    ).toBe('/t/junin/reclamos/nuevo');

    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'inbox', label: 'Inbox', route: '/t/junin/tickets' },
        '/t/junin',
      ),
    ).toBe('/t/junin/reclamos/nuevo');
  });

  it('uses the public fallback when no navigation item is available', () => {
    expect(resolveTenantPublicNavigationTarget(null, '/t/junin', 'reclamos/nuevo')).toBe(
      '/t/junin/reclamos/nuevo',
    );
  });

  it('preserves external links', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'web', label: 'Web', href: 'https://junin.gob.ar' },
        '/t/junin',
      ),
    ).toBe('https://junin.gob.ar');
  });
});
