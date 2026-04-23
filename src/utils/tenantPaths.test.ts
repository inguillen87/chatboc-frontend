import { describe, it, expect } from 'vitest';
import { buildTenantPath, buildTenantApiPath } from './tenantPaths';

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
});

describe('buildTenantApiPath', () => {
  it('should return api path with tenant', () => {
    expect(buildTenantApiPath('/productos', 'municipio')).toBe('/api/municipio/productos');
  });

  it('should return generic api path if no slug', () => {
    expect(buildTenantApiPath('/productos', null)).toBe('/api/productos');
  });
});
