import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/utils/api';
import {
  MetaCredentialClientError, metaCredentialApi, metaCredentialApiBase,
  parseMetaCredentialPlan, parseMetaCredentialStatus,
} from './metaCredentialApi';
import { expiresAt, planFor, planPayload, receiptPayload, statusFor, statusPayload, tokenFor } from './__tests__/fixtures';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
const request = vi.mocked(apiFetch);
const scope = { isCurrent: () => true };
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('window', { location: { origin: 'https://www.chatboc.ar' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('private Meta credential contract and dispatch', () => {
  it('accepts an absent connection with null revision and projects metadata only', async () => {
    request.mockResolvedValueOnce(json({ ...statusPayload(), access_token: tokenFor('junin-production') }));
    const result = await metaCredentialApi.status('junin-production', scope);
    expect(result.currentRevision).toBeNull();
    expect(result.label).toBe('Destino autorizado A');
    expect(JSON.stringify(result)).not.toContain(tokenFor('junin-production'));
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/internal/meta-credentials/status', expect.objectContaining({
      method: 'POST', body: { target: 'junin-production' }, baseUrlOverride: 'https://www.chatboc.ar/api',
      omitTenant: true, omitCredentials: false, omitEntityToken: true, omitChatSessionId: true,
      persistTenantSlug: false, isWidgetRequest: false, sendAnonId: false,
      singleAttempt: true, allowStartupRecovery: false, responseType: 'response', cache: 'no-store',
    }));
  });

  it.each(['target', 'provider', 'contract', 'phone_number'])('rejects a conflicting status %s', field => {
    expect(() => parseMetaCredentialStatus({ ...statusPayload(), [field]: 'foreign' }, 'junin-production')).toThrow(MetaCredentialClientError);
  });

  it('requests only a plan first and binds application to its exact reviewed expiry and hashes', async () => {
    const status = statusFor('junin-production');
    request.mockResolvedValueOnce(json(planPayload(status)));
    const plan = await metaCredentialApi.plan(status, tokenFor(status.target), scope);
    expect(request.mock.calls[0][1]?.body).toEqual({ target: status.target, access_token: tokenFor(status.target),
      expected_revision: 0, expected_writer_epoch: 6 });
    request.mockResolvedValueOnce(json(receiptPayload(plan)));
    const receipt = await metaCredentialApi.apply(plan, tokenFor(status.target), scope);
    expect(receipt).toEqual({ target: status.target, revision: 1, expiresAt, planSha256: plan.planSha256 });
    expect(request.mock.calls[1][1]?.body).toEqual({ target: status.target, access_token: tokenFor(status.target),
      expires_at: expiresAt, expected_revision: 0, expected_writer_epoch: 6,
      approved_plan_sha256: plan.planSha256, expected_database_identity_sha256: plan.databaseIdentitySha256 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(['tenant_id', 'waba_id', 'phone_number_id', 'expected_revision', 'expected_writer_epoch', 'expires_at'])
    ('rejects a plan whose %s differs from the verified status or expiry', field => {
      const status = statusFor('junin-production');
      const payload = planPayload(status);
      expect(() => parseMetaCredentialPlan({ ...payload, plan: { ...payload.plan, [field]: 'other' } }, status))
        .toThrow(MetaCredentialClientError);
    });

  it('accepts a 30-day local policy even when the provider expiry is finite and later', () => {
    const status = statusFor('tdf-sandbox');
    const payload = planPayload(status);
    payload.expiry.provider_expires_at = expiresAt + 90 * 24 * 3600;
    expect(parseMetaCredentialPlan(payload, status).expirySource).toBe('local_policy');
  });

  it.each(['http://chatboc.ar', 'https://preview.vercel.app', 'https://chatboc.ar.attacker.invalid'])
    ('blocks credential dispatch from %s', async origin => {
      vi.stubGlobal('window', { location: { origin } });
      expect(() => metaCredentialApiBase()).toThrow(MetaCredentialClientError);
      await expect(metaCredentialApi.plan(statusFor('junin-production'), tokenFor('junin-production'), scope))
        .rejects.toMatchObject({ reasonCode: 'meta_credentials_production_panel_required' });
      expect(request).not.toHaveBeenCalled();
    });

  it.each(['short', 'synthetic credential with spaces', 'a'.repeat(4097)])('rejects invalid token input without dispatch', async token => {
    await expect(metaCredentialApi.plan(statusFor('junin-production'), token, scope)).rejects.toMatchObject({ reasonCode: 'meta_operation_token_input_invalid' });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['non_json', 'wrong_contract', 'wrong_revision', 'broken_json', 'network'])
    ('treats %s after apply as an uncertain write without retry or raw error exposure', async mode => {
      const plan = planFor(statusFor('junin-production'));
      if (mode === 'network') request.mockRejectedValueOnce(new Error(`transport echoed ${tokenFor(plan.target)}`));
      else if (mode === 'non_json') request.mockResolvedValueOnce(new Response('private upstream body', { headers: { 'Content-Type': 'text/html' } }));
      else if (mode === 'broken_json') request.mockResolvedValueOnce(new Response('{', { headers: { 'Content-Type': 'application/json' } }));
      else request.mockResolvedValueOnce(json({ ...receiptPayload(plan), ...(mode === 'wrong_contract' ? { contract: 'unexpected' } : { revision: 99 }) }));
      let failure: unknown;
      try { await metaCredentialApi.apply(plan, tokenFor(plan.target), scope); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(MetaCredentialClientError);
      expect(failure).toMatchObject({ outcomeUnverified: true });
      expect(JSON.stringify(failure)).not.toContain(tokenFor(plan.target));
      expect(request).toHaveBeenCalledOnce();
    });

  it('projects only the fixed server reason and never the error detail or token', async () => {
    request.mockImplementationOnce(async (_path, options) => {
      options?.onResponse?.(json({ reason_code: 'meta_operation_revision_conflict', detail: tokenFor('junin-production') }, 409));
      throw new Error(`private ${tokenFor('junin-production')}`);
    });
    await expect(metaCredentialApi.apply(planFor(statusFor('junin-production')), tokenFor('junin-production'), scope))
      .rejects.toMatchObject({ reasonCode: 'meta_operation_revision_conflict', outcomeUnverified: true,
        message: 'meta_operation_revision_conflict' });
    expect(request).toHaveBeenCalledOnce();
  });

  it('retires a returned plan after session scope changes', async () => {
    request.mockResolvedValueOnce(json(planPayload()));
    await expect(metaCredentialApi.plan(statusFor('junin-production'), tokenFor('junin-production'), { isCurrent: () => false }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});
