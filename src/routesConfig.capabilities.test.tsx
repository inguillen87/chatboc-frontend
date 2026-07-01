import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CANONICAL_RBAC_CAPABILITIES = new Set([
  'tickets.read',
  'tickets.write',
  'tickets.assign',
  'tickets.resolve',
  'tickets.admin',
  'market.catalog.read',
  'market.catalog.write',
  'market.orders.read',
  'market.orders.write',
  'surveys.read',
  'surveys.write',
  'analytics.read',
  'analytics.admin',
  'settings.tenant.write',
]);

describe('routesConfig route capabilities', () => {
  it('uses only canonical RBAC v1 capabilities', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const capabilityEntries = Array.from(content.matchAll(/required(?:All)?Capabilities:\s*\[(.*?)\]/gs)).flatMap(([, group]) =>
      Array.from(group.matchAll(/'([^']+)'/g)).map((match) => match[1]),
    );
    const nonCanonical = capabilityEntries.filter((capability) => !CANONICAL_RBAC_CAPABILITIES.has(capability));

    expect(nonCanonical).toEqual([]);
  });

  it('keeps canonical tenant portal and education routes registered', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toContain('const canonicalTenantPortalRoutes');
    expect(content).toContain('...canonicalTenantPortalRoutes');
    expect(content).toContain("path: '/t/:tenant/educacion/staff/inbox'");
  });

  it('keeps WhatsApp webview and legacy marketplace redirects registered', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toContain("path: '/catalogo/:slug'");
    expect(content).toContain("path: '/checkout/:slug'");
    expect(content).toContain("path: '/finanzas/:tenantSlug/:flow/:operationCode'");
    expect(content).toContain("to={`/tracking/claim/${suffix}`}");
    expect(content).toContain("to={`/t/${encodeURIComponent(slug)}${suffix}${location.search || ''}`}");
  });

  it('routes tenant marketplace carts to the marketplace cart experience', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toContain("...withTenantPrefixes('/:tenant/cart', { element: <MarketCartPage /> })");
    expect(content).not.toContain("...withTenantPrefixes('/:tenant/cart', { element: <CartPage /> })");
  });

  it('keeps marketplace cart sharing on canonical tenant URLs', () => {
    const cartPagePath = path.resolve(__dirname, 'pages/market/MarketCartPage.tsx');
    const content = fs.readFileSync(cartPagePath, 'utf8');

    expect(content).toContain("buildTenantPath('/cart', tenantSlug)");
    expect(content).not.toContain('`/market/${tenantSlug}/cart`');
  });

  it('guards WhatsApp setup and catalog management routes with explicit capabilities', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toMatch(/path:\s*'\/integracion\/whatsapp\/connect'[\s\S]*?requiredAllCapabilities:\s*\['settings\.tenant\.write'\]/);
    expect(content).toMatch(/path:\s*'\/integracion'[\s\S]*?requiredAllCapabilities:\s*\['settings\.tenant\.write'\]/);
    expect(content).toMatch(/path:\s*'\/admin\/catalog'[\s\S]*?requiredAllCapabilities:\s*\['market\.catalog\.write'\]/);
    expect(content).toMatch(/path:\s*'\/catalog-mappings\/new'[\s\S]*?requiredAllCapabilities:\s*\['market\.catalog\.write'\]/);
  });

  it('keeps the legacy root tickets route as a profile desk redirect without capability 403', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const routeBlock = content.match(/\{\s*path:\s*'\/tickets',[\s\S]*?\n\s*\},/)?.[0] ?? '';

    expect(content).toContain('const TicketDeskRedirect');
    expect(routeBlock).toContain("path: '/tickets'");
    expect(routeBlock).toContain('element: <TicketDeskRedirect />');
    expect(routeBlock).toContain("roles: ['tenant_admin', 'employee', 'superadmin']");
    expect(routeBlock).not.toContain('requiredCapabilities');
  });

  it('keeps tenant ticket aliases mounted in the CRM shell instead of sending missing capabilities to /403', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    for (const tenantTicketPath of ['/:tenant/reclamos', '/:tenant/tickets']) {
      const pattern = new RegExp(
        `\\.\\.\\.withTenantPrefixes\\('${tenantTicketPath.replace(/\//g, '\\/')}', \\{[\\s\\S]*?\\}\\),`,
      );
      const routeBlock = content.match(pattern)?.[0] ?? '';

      expect(routeBlock).toContain('element: <TicketsPanel />');
      expect(routeBlock).toContain("roles: ['tenant_admin', 'employee', 'superadmin']");
      expect(routeBlock).not.toContain('requiredCapabilities');
    }
  });

  it('links template operations to the canonical WhatsApp onboarding route', () => {
    const templatesPagePath = path.resolve(__dirname, 'pages/GestionPlantillasPage.tsx');
    const content = fs.readFileSync(templatesPagePath, 'utf8');

    expect(content).toContain('to="/integracion/whatsapp/connect"');
    expect(content).not.toContain('/integraciones/whatsapp/embedded-signup');
  });
});
