import { describe, expect, it } from 'vitest';

import {
  getPublicSurveyQrPageUrl,
  getPublicSurveyQrUrl,
  getPublicSurveyUrl,
  getPublicSurveyUrlFromRecord,
} from './publicSurveyUrl';

describe('public survey tenant-scoped URLs', () => {
  it('preserves tenant_slug on participation and QR page paths', () => {
    expect(
      getPublicSurveyUrl('consulta-barrial', {
        absolute: false,
        tenantSlug: 'junin',
      }),
    ).toBe('/e/consulta-barrial?tenant_slug=junin');
    expect(
      getPublicSurveyQrPageUrl('consulta-barrial', {
        absolute: false,
        tenantSlug: 'junin',
      }),
    ).toBe('/encuestas/consulta-barrial/qr?tenant_slug=junin');
  });

  it('scopes the backend QR endpoint without losing its size', () => {
    expect(
      getPublicSurveyQrUrl('consulta-barrial', {
        absolute: false,
        size: 768,
        tenantSlug: 'rio grande',
      }),
    ).toBe(
      '/public/encuestas/consulta-barrial/qr?size=768&tenant_slug=rio+grande',
    );
  });

  it('uses the tenant carried by a backend survey record for fallback URLs', () => {
    const url = getPublicSurveyUrlFromRecord({
      slug: 'consulta-barrial',
      tenant_slug: 'junin',
    });

    expect(url).toMatch(/\/e\/consulta-barrial\?tenant_slug=junin$/);
  });
});
