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
  'interviews.cases.read',
  'interviews.sessions.conduct',
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
    expect(content).toContain("path: '/t/:tenant/educacion/staff/admisiones/:sessionId'");
  });

  it('guards interview resume with the backend conduct capability', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const routeBlock = content.match(
      /\{\s*path:\s*'\/t\/:tenant\/educacion\/staff\/admisiones\/:sessionId',[\s\S]*?\n\s*\},/,
    )?.[0] ?? '';

    expect(routeBlock).toContain("requiredAllCapabilities: ['interviews.sessions.conduct']");
  });

  it('guards the interview inbox with the backend case-read capability', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const routeBlock = content.match(
      /\{\s*path:\s*'\/t\/:tenant\/educacion\/staff\/admisiones',[\s\S]*?\n\s*\},/,
    )?.[0] ?? '';

    expect(routeBlock).toContain("requiredAllCapabilities: ['interviews.cases.read']");
  });

  it('keeps WhatsApp webview and legacy marketplace redirects registered', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toContain("path: '/catalogo/:slug'");
    expect(content).toContain("path: '/checkout/:slug'");
    expect(content).toContain("path: '/finanzas/:tenantSlug/:flow/:operationCode'");
    expect(content).toContain("path: '/tracking/claim'");
    expect(content).toContain("to={`/tracking/claim/${suffix}`}");
    expect(content).toContain("to={`/t/${encodeURIComponent(slug)}${suffix}${location.search || ''}`}");
  });

  it('routes tenant marketplace carts to the marketplace cart experience', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toContain("...withTenantPrefixes('/:tenant/cart', { element: <MarketCartPage />, allowGuest: true })");
    expect(content).not.toContain("...withTenantPrefixes('/:tenant/cart', { element: <CartPage /> })");
  });

  it('keeps tenant marketplace webviews public for WhatsApp, QR and anonymous assisted intake', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const publicWebviewRoutes = ['/:tenant/cart', '/:tenant/market', '/:tenant/product/:slug', '/:tenant/checkout'];

    for (const routePath of publicWebviewRoutes) {
      const escapedRoute = routePath.replace(/\//g, '\\/');
      const routeBlock = content.match(new RegExp(`\\.\\.\\.withTenantPrefixes\\('${escapedRoute}', \\{[\\s\\S]*?\\}\\),`))?.[0] ?? '';

      expect(routeBlock).toContain('allowGuest: true');
      expect(routeBlock).not.toContain('roles:');
      expect(routeBlock).not.toContain('requiredCapabilities');
    }
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
    expect(routeBlock).not.toContain('roles:');
    expect(routeBlock).not.toContain('requiredCapabilities');
  });

  it('keeps tenant ticket aliases mounted in the CRM shell with ticket capability bridge', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toMatch(
      /const TenantTicketWorkspaceRoute[\s\S]*?<TicketsPanel tenantSlugOverride=\{tenantSlug \|\| null\} embedded \/>/,
    );

    for (const tenantTicketPath of ['/:tenant/reclamos', '/:tenant/tickets', '/:tenant/inbox']) {
      const pattern = new RegExp(
        `\\.\\.\\.withTenantPrefixes\\('${tenantTicketPath.replace(/\//g, '\\/')}', \\{[\\s\\S]*?\\}\\),`,
      );
      const routeBlock = content.match(pattern)?.[0] ?? '';

      expect(routeBlock).toContain('element: <TenantTicketWorkspaceRoute />');
      expect(routeBlock).toContain("roles: ['tenant_admin', 'employee', 'superadmin']");
      expect(routeBlock).toContain('requiredCapabilities: TICKET_READ_CAPABILITIES');
    }
  });

  it('keeps enterprise conversation navigation on the canonical ticket desk', () => {
    const enterpriseOpsPath = path.resolve(__dirname, 'pages/EnterpriseOpsPage.tsx');
    const content = fs.readFileSync(enterpriseOpsPath, 'utf8');
    const moduleBlock = content.match(/key:\s*'inbox-omnichannel'[\s\S]*?query:\s*inboxQuery,/)?.[0] ?? '';

    expect(moduleBlock).toContain('to: TICKET_DESK_PATH');
    expect(moduleBlock).not.toContain('/inbox');
  });

  it('routes every tenant-wide analytics entry through the role-aware facade', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toContain("const AnalyticsAccessPage = React.lazy(() => import('@/features/analytics/AnalyticsAccessPage'))");
    expect(content).toContain("path: '/analytics/hub', element: <AnalyticsAccessPage variant=\"hub\" />");
    expect(content).toContain(
      "path: '/analytics/hub', element: <AnalyticsAccessPage variant=\"hub\" />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer']",
    );
    expect(content).toContain('element: <AnalyticsAccessPage />');
    expect(content).toContain("path: '/:tenant/analytics', element: <AnalyticsAccessPage />");
    expect(content).toContain("...withTenantPrefixes('/:tenant/analytics', { element: <AnalyticsAccessPage />");
    expect(content).toContain(
      "path: '/:tenant/analytics', element: <AnalyticsAccessPage />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer']",
    );
    expect(content).not.toContain("element: <AnalyticsPage />");
    expect(content).not.toContain("element: <AnalyticsHubPage />");
  });

  it('keeps employee operations routes separate from tenant-wide analytics', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const rootAnalyticsRoute = content.match(
      /\{\s*path:\s*'\/analytics',\s*element:\s*<AnalyticsAccessPage\s*\/>[\s\S]*?\n\s*\},/,
    )?.[0] ?? '';

    expect(content).toContain("path: '/analytics/operations', element: <OperationsDashboardPage />");
    expect(content).toContain("path: '/:tenant/analytics/operations', element: <OperationsDashboardPage />");
    expect(content).toContain("...withTenantPrefixes('/:tenant/analytics/operations', { element: <OperationsDashboardPage />");
    expect(rootAnalyticsRoute).toContain("roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer']");
    expect(rootAnalyticsRoute).not.toContain('requiredCapabilities');
  });

  it('uses the same role-aware analytics facade inside the profile workspace', () => {
    const profilePath = path.resolve(__dirname, 'pages/Perfil.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    expect(content).toContain("const AnalyticsAccessPage = React.lazy(() => import('@/features/analytics/AnalyticsAccessPage'))");
    expect(content).toContain('<AnalyticsAccessPage embedded />');
    expect(content).not.toContain("import('@/pages/analytics/AnalyticsPage')");
    expect(content).toMatch(
      /\{canViewAnalytics && \(\s*<DataModeCard[\s\S]*?onClick=\{\(\) => updateProfileTab\("analytics"\)\}[\s\S]*?\)\}/,
    );
  });

  it('links template operations to the canonical WhatsApp onboarding route', () => {
    const templatesPagePath = path.resolve(__dirname, 'pages/GestionPlantillasPage.tsx');
    const content = fs.readFileSync(templatesPagePath, 'utf8');

    expect(content).toContain('whatsappOnboardingHref');
    expect(content).toContain('buildTenantPath("/integracion", tenantSlug)');
    expect(content).toContain('action=twilio-content');
    expect(content).not.toContain('to="/integracion/whatsapp/connect"');
    expect(content).not.toContain('/${encodeURIComponent(tenantSlug)}/integracion');
    expect(content).not.toContain('/integraciones/whatsapp/embedded-signup');
  });

  it('keeps legacy WhatsApp number inventory hidden from tenant admin screens', () => {
    const integrationPagePath = path.resolve(__dirname, 'pages/Integracion.tsx');
    const content = fs.readFileSync(integrationPagePath, 'utf8');

    expect(content).toContain('canManageLegacyWhatsappInventory');
    expect(content).toContain('activeTab === "whatsapp" && canManageLegacyWhatsappInventory');
    expect(content).toContain('Usá el onboarding oficial de arriba');
  });
});
