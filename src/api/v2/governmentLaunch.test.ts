import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyGovernmentMesaUnicaLaunch,
  parseGovernmentLaunchApply,
  parseGovernmentLaunchPreview,
  previewGovernmentMesaUnicaLaunch,
} from '@/api/v2/governmentLaunch';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const manifestDigest = 'a'.repeat(64);
const launchDigest = 'b'.repeat(64);
const requestDigest = 'c'.repeat(64);
const tenant = { id: 41, slug: 'gobierno-demo', type: 'municipio' };
const blueprint = {
  id: 'government-core',
  version: '1.0.0',
  manifest_digest: manifestDigest,
  application_receipt_id: 'blueprint-receipt-41',
};
const launch = {
  id: 'mesa-unica',
  label: 'Mesa Única',
  description: 'Materializa categorías operativas sin activar canales.',
  source_path: 'configuration_defaults.ticket_categories',
  runtime_scope: ['ticket_categories'],
};
const preserved = {
  desired_name: 'Luminarias',
  canonical_name: 'luminarias',
  category: { id: 7, name: 'Luminarias', type: 'ticket' },
  preserved: true,
};
const previewChanges = {
  to_create: [{ name: 'Baches y calzada', canonical_name: 'baches y calzada', type: 'ticket' }],
  already_present: [preserved],
  conflicts: [],
  summary: { desired: 2, existing: 1, create: 1, preserve: 1, conflict: 0 },
};
const applyChanges = {
  created: [{ id: 18, name: 'Baches y calzada', type: 'ticket' }],
  already_present: [preserved],
  conflicts: [],
  summary: { desired: 2, created: 1, preserved: 1, conflict: 0 },
};

const previewPayload = () => ({
  contract_version: 'tenant.blueprint.launch.preview.v1',
  tenant,
  blueprint,
  launch,
  launch_digest: launchDigest,
  changes: previewChanges,
  write_performed: false,
  runtime_activation_performed: false,
  operational_defaults_materialized: false,
  provider_activation_performed: false,
  external_calls_performed: false,
  demo_data_created: false,
});

const receipt = () => ({
  id: 'launch-receipt-41',
  contract_version: 'tenant.blueprint.launch.receipt.v1',
  tenant_id: tenant.id,
  blueprint_application_id: blueprint.application_receipt_id,
  blueprint_id: blueprint.id,
  blueprint_version: blueprint.version,
  launch_id: launch.id,
  manifest_digest: manifestDigest,
  launch_digest: launchDigest,
  request_digest: requestDigest,
  status: 'applied',
  application_snapshot: {
    launch: {
      id: launch.id,
      source_path: launch.source_path,
      runtime_scope: launch.runtime_scope,
    },
    changes: applyChanges,
    operational_defaults_materialized: true,
    provider_activation_performed: false,
    external_calls_performed: false,
    demo_data_created: false,
  },
  applied_by_user_id: 9,
  created_at: '2026-09-05T15:00:00+00:00',
});

const applyPayload = (replayed = false) => ({
  contract_version: 'tenant.blueprint.launch.apply.v1',
  receipt: receipt(),
  launch_digest: launchDigest,
  changes: applyChanges,
  replayed,
  write_performed: !replayed,
  runtime_activation_performed: false,
  runtime_activation_scope: ['ticket_categories'],
  operational_defaults_materialized: true,
  provider_activation_performed: false,
  external_calls_performed: false,
  demo_data_created: false,
});

const expectation = {
  tenantId: tenant.id,
  blueprintVersion: blueprint.version,
  manifestDigest,
  blueprintApplicationReceiptId: blueprint.application_receipt_id,
  launchDigest,
};

describe('government Mesa Única launch API', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('previews with the path tenant as the only authority and no write request body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(previewPayload() as never);

    await expect(previewGovernmentMesaUnicaLaunch(' Gobierno-Demo ')).resolves.toMatchObject({
      launch_digest: launchDigest,
      changes: { summary: { create: 1, preserve: 1, conflict: 0 } },
      write_performed: false,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/blueprints/government-core/launch/mesa-unica/preview',
      {
        method: 'POST',
        cache: 'no-store',
        omitTenant: true,
        persistTenantSlug: false,
      },
    );
    const [path, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).not.toContain('?');
    expect(options).not.toHaveProperty('tenant');
    expect(options).not.toHaveProperty('tenantSlug');
    expect(options).not.toHaveProperty('body');
  });

  it('rejects conflicting or generic tenant aliases before issuing a request', async () => {
    await expect(previewGovernmentMesaUnicaLaunch('gobierno-demo?tenant=otro')).rejects.toThrow(
      'government_launch_request_invalid',
    );
    await expect(previewGovernmentMesaUnicaLaunch('admin')).rejects.toThrow(
      'government_launch_request_invalid',
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant data and every side-effect claim in preview', () => {
    expect(() => parseGovernmentLaunchPreview({
      ...previewPayload(),
      tenant: { ...tenant, slug: 'otro-tenant' },
    }, tenant.slug)).toThrow('government_launch_scope_mismatch');

    for (const field of [
      'write_performed',
      'runtime_activation_performed',
      'operational_defaults_materialized',
      'provider_activation_performed',
      'external_calls_performed',
      'demo_data_created',
    ] as const) {
      expect(() => parseGovernmentLaunchPreview({
        ...previewPayload(),
        [field]: true,
      }, tenant.slug)).toThrow('government_launch_contract_invalid');
    }
  });

  it('fails closed for a changed source, runtime order, counts, or conflict reason', () => {
    expect(() => parseGovernmentLaunchPreview({
      ...previewPayload(),
      unversioned_extension: true,
    }, tenant.slug)).toThrow('government_launch_contract_invalid');

    expect(() => parseGovernmentLaunchPreview({
      ...previewPayload(),
      launch: { ...launch, source_path: 'configuration_defaults.people' },
    }, tenant.slug)).toThrow('government_launch_contract_invalid');

    expect(() => parseGovernmentLaunchPreview({
      ...previewPayload(),
      launch: { ...launch, runtime_scope: ['providers', 'ticket_categories'] },
    }, tenant.slug)).toThrow('government_launch_contract_invalid');

    expect(() => parseGovernmentLaunchPreview({
      ...previewPayload(),
      changes: {
        ...previewChanges,
        summary: { ...previewChanges.summary, create: 2 },
      },
    }, tenant.slug)).toThrow('government_launch_contract_invalid');

    expect(() => parseGovernmentLaunchPreview({
      ...previewPayload(),
      changes: {
        to_create: [],
        already_present: [],
        conflicts: [{
          desired_name: 'Luminarias',
          canonical_name: 'luminarias',
          reason_code: 'unknown_conflict',
          matches: [{ id: 7, name: 'Luminarias', type: 'ticket' }],
        }],
        summary: { desired: 1, existing: 1, create: 0, preserve: 0, conflict: 1 },
      },
    }, tenant.slug)).toThrow('government_launch_contract_invalid');
  });

  it('applies only the exact reviewed digest with one caller-owned idempotency key', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(applyPayload() as never);

    await expect(applyGovernmentMesaUnicaLaunch({
      tenantSlug: tenant.slug,
      launchDigest,
      idempotencyKey: 'government-launch:attempt-001',
      expected: {
        tenantId: tenant.id,
        blueprintVersion: blueprint.version,
        manifestDigest,
        blueprintApplicationReceiptId: blueprint.application_receipt_id,
      },
    })).resolves.toMatchObject({ replayed: false, write_performed: true });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/blueprints/government-core/launch/mesa-unica/apply',
      {
        method: 'POST',
        body: { launch_digest: launchDigest },
        headers: { 'Idempotency-Key': 'government-launch:attempt-001' },
        cache: 'no-store',
        omitTenant: true,
        persistTenantSlug: false,
      },
    );
    expect(vi.mocked(apiFetch).mock.calls[0][1]?.body).toEqual({ launch_digest: launchDigest });
  });

  it('accepts a truthful replay and rejects contradictory write flags', () => {
    expect(() => parseGovernmentLaunchApply(applyPayload(true), expectation)).not.toThrow();
    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(true),
      write_performed: true,
    }, expectation)).toThrow('government_launch_contract_invalid');
  });

  it('rejects an apply result for another tenant, blueprint receipt, or reviewed digest', () => {
    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(),
      receipt: { ...receipt(), tenant_id: 99 },
    }, expectation)).toThrow('government_launch_scope_mismatch');

    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(),
      receipt: { ...receipt(), blueprint_application_id: 'another-receipt' },
    }, expectation)).toThrow('government_launch_scope_mismatch');

    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(),
      launch_digest: 'd'.repeat(64),
    }, expectation)).toThrow('government_launch_contract_invalid');
  });

  it('rejects a receipt whose snapshot differs from the returned changes or claims extra effects', () => {
    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(),
      receipt: {
        ...receipt(),
        application_snapshot: {
          ...receipt().application_snapshot,
          changes: {
            ...applyChanges,
            created: [],
            summary: { ...applyChanges.summary, created: 0, desired: 1 },
          },
        },
      },
    }, expectation)).toThrow('government_launch_contract_invalid');

    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(),
      provider_activation_performed: true,
    }, expectation)).toThrow('government_launch_contract_invalid');

    expect(() => parseGovernmentLaunchApply({
      ...applyPayload(),
      changes: {
        ...applyChanges,
        created: [{ id: 18, name: 'Baches y calzada', type: 'provider' }],
      },
    }, expectation)).toThrow('government_launch_contract_invalid');
  });
});
