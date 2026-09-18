import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTenantBlueprint,
  getTenantBlueprint,
  listTenantBlueprints,
  parseTenantBlueprintApply,
  previewTenantBlueprint,
} from '@/api/v2/tenantBlueprints';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const digest = 'a'.repeat(64);
const requestDigest = 'b'.repeat(64);
const configurationDigest = 'c'.repeat(64);
const module = {
  id: 'service_desk',
  label: 'Mesa de atención',
  summary: 'Organiza la recepción de casos.',
  activation_state: 'configuration_required',
};
const metadata = {
  id: 'government-core',
  version: '1.0.0',
  label: 'Base gubernamental',
  description: 'Configuración inicial reutilizable.',
  manifest_digest: digest,
  supported_tenant_types: ['municipio'],
  modules: [module],
};
const tenant = { id: 41, slug: 'gobierno-demo', type: 'municipio' };
const changes = {
  namespace: 'government_core',
  apply_count: 1,
  preserve_count: 0,
  apply_paths: ['configuracion.government_core.channels'],
  preserve_paths: [],
};
const receipt = {
  id: 'receipt-1',
  contract_version: 'tenant.blueprint.application.v1',
  tenant_id: tenant.id,
  blueprint_id: metadata.id,
  blueprint_version: metadata.version,
  manifest_digest: digest,
  request_digest: requestDigest,
  status: 'applied',
  application_snapshot: {},
  applied_by_user_id: 7,
  created_at: '2026-09-05T12:00:00Z',
};

describe('tenant blueprint API', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('loads the versioned catalog without ambient tenant state or caching', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.blueprint.manifest.v1',
      blueprints: [metadata],
    } as never);

    await expect(listTenantBlueprints()).resolves.toMatchObject({ blueprints: [{ id: 'government-core' }] });
    expect(apiFetch).toHaveBeenCalledWith('/api/v2/tenant-blueprints', {
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    });
  });

  it('rejects a detail contract returned for another tenant', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.blueprint.detail.v1',
      tenant: { ...tenant, slug: 'otro-tenant' },
      blueprint: { ...metadata, configuration_defaults: {} },
      application_receipt: null,
      runtime_activation_performed: false,
      external_calls_performed: false,
    } as never);

    await expect(getTenantBlueprint('gobierno-demo', 'government-core')).rejects.toThrow(
      'tenant_blueprint_scope_mismatch',
    );
  });

  it('previews without writes and validates the selected blueprint scope', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.blueprint.preview.v1',
      tenant,
      blueprint: metadata,
      changes,
      configuration_digest_after_apply: configurationDigest,
      write_performed: false,
      runtime_activation_performed: false,
      external_calls_performed: false,
    } as never);

    await expect(previewTenantBlueprint('gobierno-demo', 'government-core', {
      tenantId: tenant.id,
      blueprintVersion: metadata.version,
      manifestDigest: digest,
    })).resolves.toMatchObject({
      changes: { apply_count: 1 },
      write_performed: false,
    });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/blueprints/government-core/preview',
      expect.objectContaining({ method: 'POST', cache: 'no-store', tenantSlug: 'gobierno-demo' }),
    );
  });

  it('sends only the digest and the caller-owned idempotency key when applying', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.blueprint.apply.v1',
      receipt,
      changes,
      replayed: false,
      write_performed: true,
      runtime_activation_performed: false,
      external_calls_performed: false,
    } as never);

    await applyTenantBlueprint({
      tenantSlug: 'gobierno-demo',
      blueprintId: 'government-core',
      manifestDigest: digest,
      idempotencyKey: 'tenant-blueprint:attempt-001',
      expectedTenantId: tenant.id,
      expectedBlueprintVersion: metadata.version,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/blueprints/government-core/apply',
      expect.objectContaining({
        method: 'POST',
        body: { manifest_digest: digest },
        headers: { 'Idempotency-Key': 'tenant-blueprint:attempt-001' },
        cache: 'no-store',
      }),
    );
  });

  it('accepts a truthful replay and rejects a contradictory apply receipt', () => {
    expect(() => parseTenantBlueprintApply({
      contract_version: 'tenant.blueprint.apply.v1',
      receipt,
      changes,
      replayed: true,
      write_performed: false,
      runtime_activation_performed: false,
      external_calls_performed: false,
    }, {
      tenantId: tenant.id,
      blueprintId: metadata.id,
      blueprintVersion: metadata.version,
      manifestDigest: digest,
    })).not.toThrow();

    expect(() => parseTenantBlueprintApply({
      contract_version: 'tenant.blueprint.apply.v1',
      receipt: { ...receipt, tenant_id: 99 },
      changes,
      replayed: false,
      write_performed: true,
      runtime_activation_performed: false,
      external_calls_performed: false,
    }, {
      tenantId: tenant.id,
      blueprintId: metadata.id,
      blueprintVersion: metadata.version,
      manifestDigest: digest,
    })).toThrow('tenant_blueprint_scope_mismatch');

    expect(() => parseTenantBlueprintApply({
      contract_version: 'tenant.blueprint.apply.v1',
      receipt: { ...receipt, blueprint_version: '1.1.0' },
      changes,
      replayed: false,
      write_performed: true,
      runtime_activation_performed: false,
      external_calls_performed: false,
    }, {
      tenantId: tenant.id,
      blueprintId: metadata.id,
      blueprintVersion: metadata.version,
      manifestDigest: digest,
    })).toThrow('tenant_blueprint_version_mismatch');
  });

  it('fails closed when preview claims a runtime or external side effect', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.blueprint.preview.v1',
      tenant,
      blueprint: metadata,
      changes,
      configuration_digest_after_apply: configurationDigest,
      write_performed: false,
      runtime_activation_performed: true,
      external_calls_performed: false,
    } as never);

    await expect(previewTenantBlueprint('gobierno-demo', 'government-core', {
      tenantId: tenant.id,
      blueprintVersion: metadata.version,
      manifestDigest: digest,
    })).rejects.toThrow(
      'tenant_blueprint_contract_invalid',
    );
  });

  it('rejects a preview whose manifest changed after the detail was reviewed', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tenant.blueprint.preview.v1',
      tenant,
      blueprint: { ...metadata, version: '1.1.0', manifest_digest: 'd'.repeat(64) },
      changes,
      configuration_digest_after_apply: configurationDigest,
      write_performed: false,
      runtime_activation_performed: false,
      external_calls_performed: false,
    } as never);

    await expect(previewTenantBlueprint('gobierno-demo', 'government-core', {
      tenantId: tenant.id,
      blueprintVersion: metadata.version,
      manifestDigest: digest,
    })).rejects.toThrow('tenant_blueprint_version_mismatch');
  });
});
