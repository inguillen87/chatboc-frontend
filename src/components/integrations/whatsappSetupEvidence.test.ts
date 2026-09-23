import { describe, expect, it } from 'vitest';
import { isCompletedSetupStatus, isUsableSenderStatus, checklistConfirmed, readSetupContract } from './whatsappSetupEvidence';

describe('explicit WhatsApp setup evidence', () => {
  it.each(['inactive', 'disconnected', 'not_ready', 'ready_for_embedded_signup', 'provisioning_plan_ready', 'not_active', '', null, true])('does not treat %s as completion', status => {
    expect(isCompletedSetupStatus(status)).toBe(false);
    expect(isUsableSenderStatus(status)).toBe(false);
  });
  it.each(['ONLINE', ' connected ', 'active', 'approved'])('recognizes explicit sender status %s', status => {
    expect(isUsableSenderStatus(status)).toBe(true);
  });
  it('distinguishes generic completion from a usable sender', () => {
    expect(isCompletedSetupStatus('done')).toBe(true);
    expect(isUsableSenderStatus('done')).toBe(false);
    expect(isUsableSenderStatus('ONLINE:UPDATING')).toBe(true);
  });
  it('requires one consistent checklist receipt', () => {
    const item = { id: 'templates_webviews', done: true, status: 'ready' };
    expect(checklistConfirmed([item], item.id)).toBe(true);
    expect(checklistConfirmed([{ ...item, done: false }], item.id)).toBe(false);
    expect(checklistConfirmed([{ ...item, done: 'true' }], item.id)).toBe(false);
    expect(checklistConfirmed([{ ...item, status: 'not_ready' }], item.id)).toBe(false);
    expect(checklistConfirmed([item, item], item.id)).toBe(false);
  });
  it('checks the requested tenant and exact contract version', () => {
    const contract = { contract_version: 'twilio.tech_provider.v1', tenant: { slug: 'a' } };
    expect(readSetupContract({ contract }, 'a')).toBe(contract);
    expect(() => readSetupContract({ contract }, 'b')).toThrow();
    expect(() => readSetupContract({ contract, tenant: { slug: 'b' } }, 'a')).toThrow();
    expect(() => readSetupContract({ contract: { ...contract, contract_version: 'unknown' } }, 'a')).toThrow();
    expect(() => readSetupContract({ ...contract, tenant: undefined }, 'a')).toThrow();
  });
});
