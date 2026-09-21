import { describe, expect, it } from 'vitest';
import fixture from '../../tests/fixtures/runtime-recovery-ui.json';
import { readRuntimeRecoveryUI, RECOVERY_STATES } from './runtimeRecovery';
describe('server recovery UI contract', () => {
  it('accepts the exact public backend configuration', () => { expect(readRuntimeRecoveryUI(fixture)).toEqual(fixture); });
  it('preserves server customization rather than replacing its labels', () => {
    const data = { ...fixture, check_label: 'Consultar servicio', region_label: 'Conexión pública' };
    expect(readRuntimeRecoveryUI(data)?.check_label).toBe(data.check_label);
  });
  it.each(RECOVERY_STATES)('requires the complete %s state', name => {
    const states = { ...fixture.states }; delete (states as Record<string, unknown>)[name];
    expect(readRuntimeRecoveryUI({ ...fixture, states })).toBeNull();
  });
  it.each([null, [], {}, { ...fixture, scope: 'tenant' }, { ...fixture, contract_version: 'unknown' },
    { ...fixture, check_label: '' }, { ...fixture, region_label: 'x'.repeat(201) },
    { ...fixture, dismiss_label: 'hidden\u0000control' }, { ...fixture, states: [] },
    { ...fixture, states: { ...fixture.states, offline: { title: 'Valid', detail: 'x'.repeat(1601) } } },
  ])('rejects unsupported, incomplete or unsafe contracts %#', value => {
    expect(readRuntimeRecoveryUI(value)).toBeNull();
  });
  it('drops non-contract data instead of carrying private fields into the UI', () => {
    expect(readRuntimeRecoveryUI({ ...fixture, tenant: 'private', token: 'secret' })).toEqual(fixture);
  });
});
