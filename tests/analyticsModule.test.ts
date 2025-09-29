import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { dispatch, refreshDataset } = require('../server/analytics/index.cjs');

type RequestContext = Partial<{
  role: string;
  tenants: string[];
  defaultTenant: string | null;
}>;

function buildRequest(path: string, query: Record<string, string>, context?: RequestContext) {
  const { role = 'admin', tenants = ['muni-centro'], defaultTenant } = context ?? {};
  return {
    method: 'GET',
    path,
    query,
    headers: {},
    analyticsRole: role,
    allowedTenants: tenants,
    defaultTenant: defaultTenant ?? tenants[0] ?? null,
  };
}

describe('analytics dispatch', () => {
  beforeAll(() => {
    refreshDataset();
  });

  it('returns summary metrics for authorized tenant', async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const query = {
      tenant_id: 'muni-centro',
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
    const response = await dispatch(buildRequest('/summary', query));
    expect(response.status).toBe(200);
    expect(response.body.totals.tickets).toBeGreaterThan(0);
    expect(response.body.sla.ack.p50).toBeGreaterThanOrEqual(0);
  });

  it('denies access when tenant not allowed', async () => {
    const now = new Date();
    const query = {
      tenant_id: 'muni-centro',
      from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
    const response = await dispatch(
      buildRequest('/summary', query, { role: 'visor', tenants: ['pyme-tienda'] }),
    );
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('tenant');
  });

  it('allows default tenant when no explicit list provided', async () => {
    const now = new Date();
    const query = {
      tenant_id: 'muni-centro',
      from: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
    const response = await dispatch(
      buildRequest('/summary', query, {
        role: 'visor',
        tenants: [],
        defaultTenant: 'muni-centro',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('denies access when tenant not in default or allowed list', async () => {
    const now = new Date();
    const query = {
      tenant_id: 'muni-centro',
      from: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
    const response = await dispatch(
      buildRequest('/summary', query, {
        role: 'visor',
        tenants: [],
        defaultTenant: 'pyme-tienda',
      }),
    );
    expect(response.status).toBe(403);
  });

  it('requires operador role for operations endpoint', async () => {
    const now = new Date();
    const query = {
      tenant_id: 'muni-centro',
      from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
    const unauthorized = await dispatch(buildRequest('/operations', query, { role: 'visor' }));
    expect(unauthorized.status).toBe(403);

    const authorized = await dispatch(buildRequest('/operations', query, { role: 'operador' }));
    expect(authorized.status).toBe(200);
    expect(authorized.body.abiertos).toBeGreaterThanOrEqual(0);
  });
});
