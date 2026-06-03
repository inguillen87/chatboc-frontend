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

  it('guards WhatsApp setup and catalog management routes with explicit capabilities', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');

    expect(content).toMatch(/path:\s*'\/integracion\/whatsapp\/connect'[\s\S]*?requiredAllCapabilities:\s*\['settings\.tenant\.write'\]/);
    expect(content).toMatch(/path:\s*'\/integracion'[\s\S]*?requiredAllCapabilities:\s*\['settings\.tenant\.write'\]/);
    expect(content).toMatch(/path:\s*'\/admin\/catalog'[\s\S]*?requiredAllCapabilities:\s*\['market\.catalog\.write'\]/);
    expect(content).toMatch(/path:\s*'\/catalog-mappings\/new'[\s\S]*?requiredAllCapabilities:\s*\['market\.catalog\.write'\]/);
  });
});
