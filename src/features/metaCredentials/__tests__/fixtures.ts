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
