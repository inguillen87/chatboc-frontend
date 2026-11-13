import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/utils/api';
import { metaCredentialApi, metaCredentialsInstalled, MetaCredentialClientError, parseMetaConnectionInspection } from './metaCredentialApi';
import { installedStatusFor, inspectionPayload, tokenFor } from './__tests__/fixtures';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
const request = vi.mocked(apiFetch);
const statuses = () => [installedStatusFor('junin-production'), installedStatusFor('tdf-sandbox')];
const scope = { isCurrent: () => true };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('window', { location: { origin: 'https://www.chatboc.ar' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('fixed connection inspection', () => {
  it('sends only the fixed target, validates both bindings and keeps a minimal partial projection', async () => {
    const current = statuses();
    const payload = inspectionPayload(current);
    request.mockResolvedValueOnce(json({ ...payload, access_token: tokenFor('junin-production'), raw_url: 'https://private.invalid/secret' }));
    const result = await metaCredentialApi.inspectConnection(current, scope);
    expect(result).toEqual({ checkedAt: payload.checked_at, validUntil: payload.valid_until,
      controlIdentified: true, configurationIncomplete: false });
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/internal/meta-credentials/inspect-junin-webhook', expect.objectContaining({
      method: 'POST', body: { target: 'junin-production' }, baseUrlOverride: 'https://www.chatboc.ar/api',
      omitTenant: true, omitCredentials: false, omitEntityToken: true, omitChatSessionId: true,
      singleAttempt: true, allowStartupRecovery: false, cache: 'no-store', responseType: 'response', sendAnonId: false,
    }));
    for (const value of [tokenFor('junin-production'), 'private.invalid', 'database_identity_sha256', 'phone_number_id', 'raw_url']) {
      expect(JSON.stringify(result)).not.toContain(value);
    }
  });

  it.each(['missing', 'old_revision', 'expired', 'still_editable', 'duplicate'])('requires both installed credentials: %s', async condition => {
    const current = statuses();
    if (condition === 'missing') current.pop();
    if (condition === 'old_revision') current[1].currentRevision = 6;
    if (condition === 'expired') current[1].expiresAt = Math.floor(Date.now() / 1000);
    if (condition === 'still_editable') current[0].operationAvailable = true;
    if (condition === 'duplicate') current[1] = current[0];
    expect(metaCredentialsInstalled(current)).toBe(false);
    await expect(metaCredentialApi.inspectConnection(current, scope)).rejects.toMatchObject({ reasonCode: 'meta_inspection_credentials_required' });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['contract', 'write_ready', 'inspection_complete', 'writes_performed', 'provider_mutations', 'messages_sent',
    'authority', 'inventory', 'tenant', 'revision', 'expiry', 'phone', 'waba', 'duplicates', 'control_alias',
    'unknown_configuration', 'candidate_inconsistent', 'schema_claim', 'proof_expired', 'proof_unbounded'])
    ('does not confirm access from a conflicting %s', condition => {
      const current = statuses();
      const payload = inspectionPayload(current);
      if (condition === 'contract') payload.contract = 'unexpected';
      if (['write_ready', 'inspection_complete', 'writes_performed', 'provider_mutations', 'messages_sent'].includes(condition))
        Object.assign(payload, { [condition]: true });
      if (condition === 'authority') payload.credentials[1].authority_verified = false;
      if (condition === 'inventory') payload.credentials[0].inventory_complete = false;
      if (condition === 'tenant') payload.credentials[1].tenant_id = 999;
      if (condition === 'revision') payload.credentials[0].revision = 99;
      if (condition === 'expiry') payload.credentials[1].expires_at! -= 1;
      if (condition === 'phone') payload.resources[0].phone_number_id = '900000000000099';
      if (condition === 'waba') payload.resources[1].waba_id = '900000000000099';
      if (condition === 'duplicates') payload.credentials[1] = payload.credentials[0];
      if (condition === 'control_alias') payload.resources[2].phone_number_id = payload.resources[0].phone_number_id;
      if (condition === 'unknown_configuration') payload.resources[0].configuration.state = 'definitely_active';
      if (condition === 'candidate_inconsistent') payload.resources[0].configuration.known_fields.phone_number.value_type = 'object';
      if (condition === 'schema_claim') payload.resources[0].configuration.schema_verified = true;
      if (condition === 'proof_expired') payload.valid_until = payload.checked_at;
      if (condition === 'proof_unbounded') payload.valid_until = payload.checked_at + 3600;
      expect(() => parseMetaConnectionInspection(payload, current)).toThrow(MetaCredentialClientError);
    });

  it.each(['missing', 'unknown_shape', 'unavailable'])('keeps a %s configuration partial without interpreting absence', state => {
    const current = statuses();
    const payload = inspectionPayload(current);
    const changed = { ...payload, resources: payload.resources.map((resource, index) => index === 0 ? {
      ...resource, configuration: { state, schema_verified: false, value_type: 'null',
        configuration_sha256: state === 'unknown_shape' ? 'f'.repeat(64) : null, known_fields: {} },
    } : resource) };
    expect(parseMetaConnectionInspection(changed, current)).toMatchObject({ configurationIncomplete: true });
  });

  it('allows a missing control only as explicitly not requested, never an invented match', () => {
    const current = statuses();
    const payload = inspectionPayload(current);
    const changed = { ...payload, resources: payload.resources.map(resource => resource.resource === 'inmovar' ? {
      ...resource, phone_number_id: null, configuration: { state: 'not_requested', schema_verified: false,
        configuration_sha256: null, known_fields: {} },
    } : resource) };
    expect(parseMetaConnectionInspection(changed, current)).toMatchObject({ controlIdentified: false, configurationIncomplete: true });
  });

  it('retires a changed session before dispatch and after a response', async () => {
    await expect(metaCredentialApi.inspectConnection(statuses(), { isCurrent: () => false })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
    let current = true;
    request.mockImplementationOnce(async () => { current = false; return json(inspectionPayload()); });
    await expect(metaCredentialApi.inspectConnection(statuses(), { isCurrent: () => current })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledOnce();
  });
});
