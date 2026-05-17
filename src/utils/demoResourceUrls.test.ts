import { describe, expect, it } from 'vitest';

import { isDemoCatalogResourceUrl, normalizeDemoResourceUrl } from './demoResourceUrls';

describe('demoResourceUrls', () => {
  it('rewrites legacy demo catalog media URLs to backend assets URLs', () => {
    expect(normalizeDemoResourceUrl('/media/demo_catalogs/colegios/catalogo-demo-colegios.pdf')).toBe(
      '/api/v2/demo/catalog-assets/colegios/catalogo-demo-colegios.pdf',
    );
  });

  it('leaves already-published backend demo asset URLs untouched', () => {
    const url = '/api/v2/demo/catalog-assets/bodega/lista-precios-demo.pdf';

    expect(normalizeDemoResourceUrl(url)).toBe(url);
    expect(isDemoCatalogResourceUrl(url)).toBe(true);
  });
});

