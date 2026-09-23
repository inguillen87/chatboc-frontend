import { describe, it, expect } from 'vitest';
import {
  buildTenantPath,
  buildTenantApiPath,
  resolveTenantPublicNavigationTarget,
  sanitizePublicInternalNavigationPath,
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
        { id: 'surveys', label: 'Encuestas', route: '/t/junin/encuestas' },
        '/t/junin',
      ),
    ).toBe('/t/junin/encuestas');
  });

  it('maps protected ticket desk aliases to the public claim intake', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'tickets', label: 'Tickets', route: '/t/junin/tickets' },
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

  it('fails closed when no navigation item is available', () => {
    expect(resolveTenantPublicNavigationTarget(null, '/t/junin')).toBeNull();
  });

  it('rejects external href values because tenant.public_navigation.v1 only defines internal routes', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'web', label: 'Web', href: 'https://junin.gob.ar' },
        '/t/junin',
      ),
    ).toBeNull();
  });

  it.each([
    '//evil.test/phish',
    String.raw`\\evil.test\phish`,
    String.raw`/\evil.test/phish`,
    String.raw`\/evil.test/phish`,
  ])('rejects the React Router mixed-separator open redirect PoC %s', (route) => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'unsafe', label: 'No abrir', route },
        '/t/junin',
      ),
    ).toBeNull();
  });

  it.each([
    '/t/junin/%2f%2fevil.test',
    '/t/junin/%5cevil.test',
    '/t/junin/%252f%252fevil.test',
    '/t/junin/%255cevil.test',
    '/t/junin/%00evil.test',
    '/t/junin/%250aevil.test',
  ])('rejects encoded and double-encoded separators or controls in %s', (route) => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'unsafe', label: 'No abrir', route },
        '/t/junin',
      ),
    ).toBeNull();
  });

  it.each([
    'https://evil.test/phish',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '/t/junin/../superadmin',
    '/t/junin/%2e%2e/superadmin',
    '/superadmin',
    '/t/otro/encuestas',
  ])('rejects schemes, traversal and routes outside the bound tenant in %s', (route) => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'unsafe', label: 'No abrir', route },
        '/t/junin',
      ),
    ).toBeNull();
  });

  it('does not turn an invalid supplied route into a trusted fallback', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        { id: 'unsafe', label: 'No abrir', route: String.raw`/\evil.test/phish` },
        '/t/junin',
      ),
    ).toBeNull();
  });

  it('preserves an ordinary tenant route with query and hash', () => {
    expect(
      resolveTenantPublicNavigationTarget(
        {
          id: 'surveys',
          label: 'Encuestas',
          route: '/t/junin/encuestas?estado=abierta#resultados',
        },
        '/t/junin',
      ),
    ).toBe('/t/junin/encuestas?estado=abierta#resultados');
  });
});

describe('sanitizePublicInternalNavigationPath', () => {
  it('accepts the same-origin root path', () => {
    expect(sanitizePublicInternalNavigationPath('/')).toBe('/');
  });

  it('accepts canonical root-relative paths with safe unicode segments', () => {
    expect(sanitizePublicInternalNavigationPath('/t/peñalolén/noticias')).toBe(
      '/t/pe%C3%B1alol%C3%A9n/noticias',
    );
  });

  it('rejects malformed percent escapes', () => {
    expect(sanitizePublicInternalNavigationPath('/t/junin/%zz')).toBeNull();
  });

  it.each(['/t/junin/espacio%20inseguro', '/t/junin/segmento%3finyectado'])(
    'rejects encoded characters outside the safe path-segment alphabet in %s',
    (route) => {
      expect(sanitizePublicInternalNavigationPath(route)).toBeNull();
    },
  );
});

describe('implementation workspace routing',()=>{
  it('never builds a public cart under a reserved setup route',()=>{
    expect(buildTenantPath('/cart','implementacion')).toBe('/cart');
    expect(buildTenantApiPath('/carrito','implementacion')).toBe('/api/carrito');
  });
});
