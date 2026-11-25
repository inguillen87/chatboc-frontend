import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LANDING_TITLE,
  formatPlatformTitle,
  formatTenantTitle,
  isSelfManagedMetadataPath,
  isTenantShellManagedPath,
  resolvePlatformRouteTitle,
  resolveTenantRouteSection,
} from './pageTitles';

const repoRoot = path.resolve(__dirname, '../..');
const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('pageTitles helpers', () => {
  it('formats platform titles with «Sección · Chatboc» and uses the product title for landing', () => {
    expect(formatPlatformTitle()).toBe(LANDING_TITLE);
    expect(formatPlatformTitle('')).toBe(LANDING_TITLE);
    expect(formatPlatformTitle('Demo')).toBe('Demo · Chatboc');
    expect(formatPlatformTitle('  Documentación  ')).toBe('Documentación · Chatboc');
  });

  it('formats white-label organization titles without platform branding', () => {
    expect(formatTenantTitle('Municipalidad de Junín', 'Portal')).toBe('Municipalidad de Junín · Portal');
    expect(formatTenantTitle('Tierra del Fuego', 'Información y orientación')).toBe(
      'Tierra del Fuego · Información y orientación',
    );
    expect(formatTenantTitle('Espacio qa-a')).toBe('Espacio qa-a');
    expect(formatTenantTitle('Espacio qa-a', null)).toBe('Espacio qa-a');
  });

  it.each([
    ['/', '', LANDING_TITLE],
    ['/demo', '', 'Demo · Chatboc'],
    ['/demo/gobierno', '', 'Demo · Chatboc'],
    ['/login', '', 'Ingresar · Chatboc'],
    ['/register', '', 'Crear cuenta · Chatboc'],
    ['/documentacion', '', 'Documentación · Chatboc'],
    ['/faqs', '', 'Preguntas frecuentes · Chatboc'],
    ['/privacidad', '', 'Política de privacidad · Chatboc'],
    ['/terminos', '', 'Términos y condiciones · Chatboc'],
    ['/eliminacion-datos', '', 'Eliminación de datos · Chatboc'],
    ['/tracking/claim', '', 'Seguimiento de reclamos · Chatboc'],
    ['/tracking/claim/REC-123', '', 'Seguimiento de reclamos · Chatboc'],
    ['/tracking/order/PED-456', '', 'Seguimiento de pedidos · Chatboc'],
    ['/perfil', '', 'Panel · Chatboc'],
    ['/perfil', '?tab=tickets', 'Tickets · Chatboc'],
    ['/perfil', '?tab=usuarios', 'CRM · Chatboc'],
    ['/perfil', '?tab=analytics', 'Analíticas · Chatboc'],
    ['/superadmin', '', 'Administración · Chatboc'],
    ['/integracion', '', 'Integraciones · Chatboc'],
    ['/estadisticas', '', 'Estadísticas · Chatboc'],
    ['/analytics', '', 'Analíticas · Chatboc'],
    ['/portal/dashboard', '', 'Portal · Chatboc'],
    ['/portal/reclamos', '', 'Reclamos · Chatboc'],
    ['/portal/pedidos', '', 'Pedidos · Chatboc'],
    ['/iframe', '', 'Widget de chat · Chatboc'],
    ['/403', '', 'Acceso restringido · Chatboc'],
  ])('resolves platform route %s%s -> %s', (pathname, search, expected) => {
    expect(resolvePlatformRouteTitle(pathname, search)).toBe(expected);
  });

  it('resolves white-label sections and ownership boundaries', () => {
    expect(resolveTenantRouteSection('/t/junin')).toBe('Portal');
    expect(resolveTenantRouteSection('/t/junin/noticias')).toBe('Noticias');
    expect(resolveTenantRouteSection('/t/junin/eventos')).toBe('Eventos');
    expect(resolveTenantRouteSection('/t/junin/encuestas')).toBe('Encuestas');
    expect(resolveTenantRouteSection('/t/junin/reclamos/nuevo')).toBe('Nuevo reclamo');
    expect(resolveTenantRouteSection('/t/junin/portal/dashboard')).toBe('Portal');
    expect(resolveTenantRouteSection('/t/junin/portal/reclamos')).toBe('Reclamos');
    expect(resolveTenantRouteSection('/t/comercio/market')).toBe('Catálogo');
    expect(resolveTenantRouteSection('/t/comercio/login')).toBe('Ingresar');
    expect(resolveTenantRouteSection('/t/junin/tickets')).toBe('Panel');

    expect(isTenantShellManagedPath('/t/junin')).toBe(true);
    expect(isTenantShellManagedPath('/t/junin/noticias')).toBe(true);
    expect(isTenantShellManagedPath('/t/junin/portal/dashboard')).toBe(false);
    expect(isTenantShellManagedPath('/t/junin/market')).toBe(false);

    expect(isSelfManagedMetadataPath('/encuestas')).toBe(true);
    expect(isSelfManagedMetadataPath('/e/mi-encuesta')).toBe(true);
    expect(isSelfManagedMetadataPath('/encuestas/mi-encuesta/qr')).toBe(true);
    expect(isSelfManagedMetadataPath('/demo')).toBe(false);
  });
});

describe('HTML entrypoints and PWA manifests metadata', () => {
  it('updates index.html title and social metadata without legacy copy', () => {
    const html = readRepoFile('index.html');
    expect(html).toContain(`<title>${LANDING_TITLE}</title>`);
    expect(html).toContain(`property="og:title" content="${LANDING_TITLE}"`);
    expect(html).toContain(`name="twitter:title" content="${LANDING_TITLE}"`);
    expect(html).not.toMatch(/experto virtual/i);
    expect(html).not.toContain('Chatboc |');
    expect(html).toMatch(/meta name="description" content="[^"]*Atendé[^"]*"/);
    expect(html).toMatch(/meta property="og:description" content="[^"]+"/);
    expect(html).toMatch(/meta name="twitter:description" content="[^"]+"/);
  });

  it('keeps portal/index.html, iframe.html and legal HTML titles coherent', () => {
    expect(readRepoFile('portal/index.html')).toContain('<title>Portal · Chatboc</title>');
    expect(readRepoFile('iframe.html')).toContain('<title>Widget de chat · Chatboc</title>');
    expect(readRepoFile('public/iframe.html')).toContain('<title>Widget de chat · Chatboc</title>');
    expect(readRepoFile('public/privacidad/index.html')).toContain(
      '<title>Política de privacidad · Chatboc</title>',
    );
    expect(readRepoFile('public/terminos/index.html')).toContain(
      '<title>Términos y condiciones · Chatboc</title>',
    );
    expect(readRepoFile('public/eliminacion-datos/index.html')).toContain(
      '<title>Eliminación de datos · Chatboc</title>',
    );
  });

  it('aligns PWA manifests with the product branding', () => {
    for (const file of ['manifest.json', 'public/manifest.json']) {
      const manifest = JSON.parse(readRepoFile(file)) as { name: string; description: string };
      expect(manifest.name).toBe('Chatboc · Agentes IA con tu marca');
      expect(manifest.description).not.toMatch(/experto virtual/i);
      expect(manifest.name).not.toContain('|');
    }

    const portalManifest = JSON.parse(readRepoFile('public/manifest.portal.webmanifest')) as {
      name: string;
      description: string;
    };
    expect(portalManifest.name).toBe('Portal · Chatboc');
    expect(portalManifest.description).toMatch(/Consultá/);
  });
});
