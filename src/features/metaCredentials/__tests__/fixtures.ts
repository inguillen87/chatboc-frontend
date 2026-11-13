import type { MetaCredentialPlan, MetaCredentialStatus, MetaCredentialTarget } from '../metaCredentialApi';

export const tokenFor = (target: MetaCredentialTarget) => `synthetic_private_${target.replaceAll('-', '_')}_credential`;
export const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
export const statusFor = (target: MetaCredentialTarget): MetaCredentialStatus => ({
  target, label: target === 'junin-production' ? 'Destino autorizado A' : 'Destino autorizado B',
  tenantId: target === 'junin-production' ? 22 : 46,
  tenantSlug: target === 'junin-production' ? 'authorized-a' : 'authorized-b',
  environment: target === 'junin-production' ? 'production' : 'sandbox',
  appId: '10000000001', wabaId: '20000000002', phoneNumberId: '30000000003', phoneNumber: '+15550000001',
  expectedRevision: target === 'junin-production' ? 0 : 6,
  currentRevision: target === 'junin-production' ? null : 6,
  writerEpoch: 6, operationAvailable: true, lastPlanSha256: null, expiresAt: null,
});
export const planFor = (status: MetaCredentialStatus): MetaCredentialPlan => ({
  target: status.target, tenantId: status.tenantId, expectedRevision: status.expectedRevision,
  nextRevision: status.expectedRevision + 1, writerEpoch: 6, expiresAt,
  expirySource: status.target === 'junin-production' ? 'provider' : 'local_policy',
  databaseIdentitySha256: 'd'.repeat(64), planSha256: (status.target === 'junin-production' ? 'a' : 'b').repeat(64),
});
export const statusPayload = (target: MetaCredentialTarget = 'junin-production') => {
  const status = statusFor(target);
  return {
    contract: 'chatboc.meta_credential_operation.v1', target, label: status.label,
    tenant_id: status.tenantId, tenant_slug: status.tenantSlug, environment: status.environment,
    provider: 'meta', channel: 'whatsapp', app_id: status.appId, waba_id: status.wabaId,
    phone_number_id: status.phoneNumberId, phone_number: status.phoneNumber,
    expected_revision: status.expectedRevision, current_revision: status.currentRevision,
    expected_writer_epoch: status.writerEpoch, operation_available: true,
    last_operation: null, expires_at: null, writes_performed: false,
  };
};
export const planPayload = (status = statusFor('junin-production')) => {
  const plan = planFor(status);
  return {
    contract: 'chatboc.meta_credential_operation.v1', dry_run: true, writes_performed: false,
    messages_sent: false, provider_mutations: false,
    plan: {
      target: status.target, tenant_id: status.tenantId, tenant_slug: status.tenantSlug,
      environment: status.environment, provider: 'meta', channel: 'whatsapp',
      app_id: status.appId, waba_id: status.wabaId, phone_number_id: status.phoneNumberId,
      phone_number: status.phoneNumber, expected_revision: plan.expectedRevision,
      next_revision: plan.nextRevision, expected_writer_epoch: plan.writerEpoch,
      expires_at: plan.expiresAt, database_identity_sha256: plan.databaseIdentitySha256,
    },
    plan_sha256: plan.planSha256,
    expiry: { expires_at: plan.expiresAt, source: plan.expirySource,
      provider_expires_at: plan.expiresAt, local_maximum_seconds: 2592000 },
  };
};
export const receiptPayload = (plan = planFor(statusFor('junin-production'))) => ({
  contract: 'chatboc.meta_credential_operation.v1', target: plan.target, tenant_id: plan.tenantId,
  revision: plan.nextRevision, expires_at: plan.expiresAt, plan_sha256: plan.planSha256,
  committed: true, writes_performed: true, messages_sent: false, provider_mutations: false, environment_changes: false,
});

export const installedStatusFor = (target: MetaCredentialTarget): MetaCredentialStatus => ({
  ...statusFor(target), currentRevision: target === 'junin-production' ? 1 : 7,
  operationAvailable: false, expiresAt: Math.floor(Date.now() / 1000) + 3600,
  wabaId: target === 'junin-production' ? '20000000002' : '20000000004',
  phoneNumberId: target === 'junin-production' ? '30000000003' : '30000000005',
  phoneNumber: target === 'junin-production' ? '+15550000001' : '+15550000002',
});

export const inspectionPayload = (statuses = [installedStatusFor('junin-production'), installedStatusFor('tdf-sandbox')]) => {
  const now = Math.floor(Date.now() / 1000);
  const configuration = () => ({ state: 'candidate_shape', schema_verified: false, value_type: 'object', unknown_field_count: 0,
    configuration_sha256: 'f'.repeat(64), known_fields: {
      phone_number: { value_type: 'string', value_sha256: 'e'.repeat(64), matches_expected_callback: true, public_callback: null },
    } });
  return {
    contract: 'chatboc.meta_phone_webhook_inspection.v1', target: 'junin-production',
    observed_at: now - 2, checked_at: now, valid_until: now + 30,
    database_identity_sha256: 'd'.repeat(64), inspection_complete: false, write_ready: false,
    writes_performed: false, provider_mutations: false, messages_sent: false,
    blockers: ['meta_inspection_readback_contract_unverified', 'meta_inspection_rollback_contract_unverified',
      'meta_inspection_mutation_not_implemented'],
    credentials: statuses.map((status, index) => ({ target: status.target, tenant_id: status.tenantId,
      environment: status.environment, connection_id: index + 3, sender_id: index + 1,
      revision: status.currentRevision, expires_at: status.expiresAt, authority_verified: true,
      graph_version: 'v25.0', inventory_complete: true, inventory_sha256: 'a'.repeat(64), subscriptions_sha256: 'b'.repeat(64) })),
    resources: [...statuses.map(status => ({ resource: status.target === 'junin-production' ? 'junin' : 'tdf',
      phone_number_id: status.phoneNumberId, phone_number: status.phoneNumber, waba_id: status.wabaId,
      graph_version: 'v25.0', configuration: configuration() })),
    { resource: 'inmovar', phone_number_id: '900000000000001', phone_number: '+15550000003',
      waba_id: statuses[0].wabaId, graph_version: 'v25.0', configuration: configuration() }],
  };
};
