import { describe, expect, it } from 'vitest';

import {
  getPublicSurveyQrPageUrl,
  getPublicSurveyQrUrl,
  getPublicSurveyUrl,
  getPublicSurveyUrlFromRecord,
  getPublicSurveyWhatsAppShareUrl,
  withPublicSurveyTenantScope,
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

  it('applies an explicit tenant authoritatively to backend-provided public URLs', () => {
    const url = getPublicSurveyUrlFromRecord(
      {
        slug: 'consulta-barrial',
        tenant_slug: 'tenant-equivocado',
        url_publica: 'https://www.chatboc.ar/e/consulta-barrial?tenant=legacy&tenant_slug=anterior#resultados',
      },
      { tenantSlug: 'rio-grande' },
    );

    expect(url).toBe(
      'https://www.chatboc.ar/e/consulta-barrial?tenant_slug=rio-grande#resultados',
    );
    expect(
      withPublicSurveyTenantScope('/public/encuestas/consulta-barrial/qr?size=512', 'ushuaia'),
    ).toBe('/public/encuestas/consulta-barrial/qr?size=512&tenant_slug=ushuaia');
  });

  it('builds a reusable WhatsApp CTA from the canonical public URL', () => {
    const publicUrl = '/e/consulta-barrial?tenant_slug=junin';
    const whatsappUrl = getPublicSurveyWhatsAppShareUrl(
      publicUrl,
      'Participá de la encuesta “Consulta barrial”.',
    );
    const parsed = new URL(whatsappUrl);

    expect(parsed.origin).toBe('https://wa.me');
    expect(parsed.searchParams.get('text')).toBe(
      `Participá de la encuesta “Consulta barrial”.\n${publicUrl}`,
    );
    expect(getPublicSurveyWhatsAppShareUrl('')).toBe('');
  });
});
