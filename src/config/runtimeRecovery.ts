export const RECOVERY_STATES = ['offline', 'checking', 'waiting', 'verified', 'unavailable', 'mismatch'] as const;
export type RecoveryState = typeof RECOVERY_STATES[number];
export interface RuntimeRecoveryUI {
  contract_version: 'chatboc.runtime_recovery_ui.v1';
  scope: 'platform';
  region_label: string;
  check_label: string;
  dismiss_label: string;
  states: Record<RecoveryState, { title: string; detail: string }>;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && !!value.trim() && value.length <= max && !/\p{Cc}/u.test(value);

/** Only server-published platform copy is accepted; there are no local messages. */
export function readRuntimeRecoveryUI(value: unknown): RuntimeRecoveryUI | null {
  if (!object(value) || value.contract_version !== 'chatboc.runtime_recovery_ui.v1' || value.scope !== 'platform' ||
      !text(value.region_label) || !text(value.check_label) || !text(value.dismiss_label) || !object(value.states)) return null;
  const states = {} as RuntimeRecoveryUI['states'];
  for (const name of RECOVERY_STATES) {
    const state = value.states[name];
    if (!object(state) || !text(state.title) || !text(state.detail, 1600)) return null;
    states[name] = { title: state.title, detail: state.detail };
  }
  return { contract_version: value.contract_version, scope: value.scope, region_label: value.region_label,
    check_label: value.check_label, dismiss_label: value.dismiss_label, states };
}
