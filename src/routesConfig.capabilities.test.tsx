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

describe('routesConfig requiredCapabilities', () => {
  it('uses only canonical RBAC v1 capabilities', () => {
    const routesConfigPath = path.resolve(__dirname, 'routesConfig.tsx');
    const content = fs.readFileSync(routesConfigPath, 'utf8');
    const capabilityEntries = Array.from(content.matchAll(/requiredCapabilities:\s*\[(.*?)\]/gs)).flatMap(([, group]) =>
      Array.from(group.matchAll(/'([^']+)'/g)).map((match) => match[1]),
    );
    const nonCanonical = capabilityEntries.filter((capability) => !CANONICAL_RBAC_CAPABILITIES.has(capability));

    expect(nonCanonical).toEqual([]);
  });
});
