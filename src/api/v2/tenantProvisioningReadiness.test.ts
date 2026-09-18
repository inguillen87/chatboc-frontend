import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchTenantProvisioningReadiness,
  parseTenantProvisioningReadiness,
} from '@/api/v2/tenantProvisioningReadiness';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@/utils/api', () => ({ apiFetch: api.fetch }));

export const completeProvisioningReadiness = {
  contract_version: 'tenant.provisioning_readiness.v1',
  readiness_scope: 'tenant_configuration',
  generated_at: '2026-09-05T15:30:00+00:00',
  tenant: { id: 41, slug: 'gobierno-demo', tipo: 'municipio' },
  template_key: 'municipio_default',
  evaluated_stage: 'configuration_complete',
  requires_revalidation: false,
  status: 'ready',
  ready: true,
  production_ready: false,
  checks: {
    base_configuration_valid: true,
    branding_configuration_complete: true,
    operator_configuration_complete: true,
    service_content_configured: true,
    channel_verification_complete: true,
    provider_activation_performed: false,
  },
  configured_keys: ['contacts', 'links', 'menu', 'widget'],
  missing: [],
  next_action: 'review_activation',
  evidence: {
    base_configuration: {
      required_keys: ['contacts', 'links', 'menu', 'widget'],
      configured_keys: ['contacts', 'links', 'menu', 'widget'],
      missing_keys: [],
    },
    branding: { logo_configured: true, palette_configured: true },
    operator_team: { members: 5, ticket_categories: 8, routed_members: 4 },
    service_content: { catalog_items: 12, menu_items: 6 },
    channels: {
      selected: ['widget'],
      verified: ['widget'],
      missing: [],
      complete: true,
      provider_activation_performed: false,
    },
  },
  safety: {
    server_derived: true,
    side_effects_performed: false,
    provider_calls_performed: false,
    production_cutover_assessed: false,
  },
} as const;

describe('tenant provisioning readiness API', () => {
  beforeEach(() => {
    api.fetch.mockReset().mockResolvedValue(completeProvisioningReadiness);
  });

  it('loads the current tenant-scoped snapshot without caching or persisting the requested slug', async () => {
    const result = await fetchTenantProvisioningReadiness(' Gobierno-Demo ');

    expect(result.ready).toBe(true);
    expect(result.production_ready).toBe(false);
    expect(api.fetch).toHaveBeenCalledWith(
      '/api/admin/tenants/gobierno-demo/provisioning-readiness',
      {
        tenantSlug: 'gobierno-demo',
        persistTenantSlug: false,
        cache: 'no-store',
      },
    );
  });

  it('rejects a valid-looking snapshot returned for a different tenant', () => {
    expect(() => parseTenantProvisioningReadiness({
      ...completeProvisioningReadiness,
      tenant: { ...completeProvisioningReadiness.tenant, slug: 'otro-gobierno' },
    }, 'gobierno-demo')).toThrow('tenant_provisioning_readiness_contract_invalid');
  });

  it('rejects contradictory readiness instead of rebuilding it from visible counts', () => {
    expect(() => parseTenantProvisioningReadiness({
      ...completeProvisioningReadiness,
      checks: {
        ...completeProvisioningReadiness.checks,
        branding_configuration_complete: false,
      },
    }, 'gobierno-demo')).toThrow('tenant_provisioning_readiness_contract_invalid');

    expect(() => parseTenantProvisioningReadiness({
      ...completeProvisioningReadiness,
      production_ready: true,
    }, 'gobierno-demo')).toThrow('tenant_provisioning_readiness_contract_invalid');
  });

  it('rejects snapshots that imply side effects or omit the versioned contract', () => {
    expect(() => parseTenantProvisioningReadiness({
      ...completeProvisioningReadiness,
      safety: {
        ...completeProvisioningReadiness.safety,
        provider_calls_performed: true,
      },
    }, 'gobierno-demo')).toThrow('tenant_provisioning_readiness_contract_invalid');

    expect(() => parseTenantProvisioningReadiness({
      ...completeProvisioningReadiness,
      contract_version: 'tenant.provisioning_readiness.v2',
    }, 'gobierno-demo')).toThrow('tenant_provisioning_readiness_contract_invalid');
  });
});
