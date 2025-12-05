import { describe, it, expect, vi } from 'vitest';
import { buildTenantPath } from './tenantPaths';

// Mock config if necessary, but tenantPaths imports it.
// We can test the behavior of buildTenantPath.

describe('buildTenantPath', () => {
  it('should return path with tenant slug', () => {
    const result = buildTenantPath('/cart', 'municipio');
    expect(result).toBe('/municipio/cart');
  });

  it('should not double prefix if slug is already there', () => {
    const result = buildTenantPath('/municipio/cart', 'municipio');
    expect(result).toBe('/municipio/cart');
  });

  it('should handle missing slug by returning normalized path', () => {
    const result = buildTenantPath('/cart', undefined);
    expect(result).toBe('/cart');
  });

  it('should handle relative paths', () => {
    const result = buildTenantPath('cart', 'municipio');
    expect(result).toBe('/municipio/cart');
  });

  it('should encode slug', () => {
    const result = buildTenantPath('/cart', 'my tenant');
    expect(result).toBe('/my%20tenant/cart');
  });

  // Legacy behavior check: ensure no 'pyme' prefix is forced if not in path
  it('should not prepend pyme/municipio prefixes automatically', () => {
      const result = buildTenantPath('/cart', 'municipio');
      expect(result).not.toContain('/pyme/');
      expect(result).toBe('/municipio/cart');
  });
});
