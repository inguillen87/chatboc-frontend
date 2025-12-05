import { describe, it, expect } from 'vitest';
import { buildTenantPath, buildTenantApiPath } from './tenantPaths';

describe('buildTenantPath', () => {
  it('should prepend tenant slug to clean path', () => {
    expect(buildTenantPath('/cart', 'municipio')).toBe('/municipio/cart');
  });

  it('should not double prefix if slug is already there', () => {
    expect(buildTenantPath('/municipio/cart', 'municipio')).toBe('/municipio/cart');
  });

  it('should return original path if no slug', () => {
    expect(buildTenantPath('/cart', undefined)).toBe('/cart');
  });

  it('should handle paths without leading slash', () => {
    expect(buildTenantPath('cart', 'junin')).toBe('/junin/cart');
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
