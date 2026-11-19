export interface DemoTrialPolicy {
  contract_version: 'demo.trial_policy.v1';
  scope: string;
  max_messages: number;
}

export interface DemoTrialUsage {
  channel: 'chat';
  limit: number;
  used: number;
  remaining: number;
}

export interface DemoTrialUpgradeAction {
  id: string;
  label: string;
  href?: string;
  leadCaptureEndpoint?: string;
}

export interface DemoTrialUpgrade {
  title?: string;
  actions: DemoTrialUpgradeAction[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const readSafeHref = (...values: unknown[]): string | null => {
  const href = values.map(readText).find((value): value is string => Boolean(value));
  if (!href) return null;
  try {
    const parsed = new URL(href, 'https://chatboc.invalid');
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? href : null;
  } catch {
    return null;
  }
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;

const DEMO_TRIAL_LIMIT_CODES = new Set([
  'demo_message_limit_reached',
  'anonymous_trial_limit_reached',
  'anonymous_message_limit_reached',
]);

export const normalizeDemoTrialUsage = (value: unknown): DemoTrialUsage | null => {
  if (!isRecord(value)) return null;

  const { channel, limit, used, remaining } = value;
  if (
    channel !== 'chat' ||
    !isCount(limit) ||
    !isCount(used) ||
    !isCount(remaining) ||
    remaining > limit
  ) {
    return null;
  }

  return { channel, limit, used, remaining };
};

export const retainValidDemoTrialUsage = (
  current: DemoTrialUsage | null,
  candidate: unknown,
): DemoTrialUsage | null => normalizeDemoTrialUsage(candidate) ?? current;

export const deriveDemoTrialUsageFromPolicy = (value: unknown): DemoTrialUsage | null => {
  if (!isRecord(value)) return null;
  if (
    value.contract_version !== 'demo.trial_policy.v1' ||
    !readText(value.scope) ||
    !isCount(value.max_messages)
  ) {
    return null;
  }

  return {
    channel: 'chat',
    limit: value.max_messages,
    used: 0,
    remaining: value.max_messages,
  };
};

export const resolveInitialDemoTrialUsage = (
  usage: unknown,
  policy: unknown,
): DemoTrialUsage | null =>
  normalizeDemoTrialUsage(usage) ?? deriveDemoTrialUsageFromPolicy(policy);

export const formatDemoTrialUsage = (usage: DemoTrialUsage): string => {
  if (usage.remaining === 0) return `Usaste tus ${usage.limit} consultas de prueba`;
  if (usage.remaining === 1) return 'Te queda 1 consulta de prueba';
  if (usage.used === 0 && usage.remaining === usage.limit) {
    return `Tenés ${usage.limit} consultas de prueba`;
  }
  return `Te quedan ${usage.remaining} de ${usage.limit} consultas de prueba`;
};

export const readDemoTrialUsage = (payload: unknown): unknown =>
  isRecord(payload) ? payload.trial_usage : undefined;

const readUpgradeAction = (
  value: unknown,
  fallbackId: string,
): DemoTrialUpgradeAction | null => {
  if (!isRecord(value)) return null;
  const label = readText(value.label) ?? readText(value.cta_label);
  if (!label) return null;

  const href = readSafeHref(
    value.href,
    value.url,
    value.action_url,
    value.create_account_url,
    value.contact_url,
  );
  const leadCaptureEndpoint =
    readText(value.lead_capture_endpoint) ?? readText(value.leadCaptureEndpoint);
  if (!href && !leadCaptureEndpoint) return null;

  return {
    id: readText(value.id) ?? fallbackId,
    label,
    ...(href ? { href } : {}),
    ...(leadCaptureEndpoint ? { leadCaptureEndpoint } : {}),
  };
};

export const normalizeDemoTrialUpgrade = (value: unknown): DemoTrialUpgrade | null => {
  if (!isRecord(value)) return null;

  const actions = Array.isArray(value.actions)
    ? value.actions
        .map((action, index) => readUpgradeAction(action, `trial-upgrade-${index}`))
        .filter((action): action is DemoTrialUpgradeAction => Boolean(action))
    : [];
  const legacyAction = readUpgradeAction(value, 'trial-upgrade');
  if (legacyAction) actions.unshift(legacyAction);

  const uniqueActions = actions.filter(
    (action, index) =>
      actions.findIndex(
        (candidate) =>
          candidate.label === action.label &&
          candidate.href === action.href &&
          candidate.leadCaptureEndpoint === action.leadCaptureEndpoint,
      ) === index,
  );
  const title = readText(value.title) ?? undefined;
  if (!title && uniqueActions.length === 0) return null;

  return { ...(title ? { title } : {}), actions: uniqueActions };
};

export const readDemoTrialUpgrade = (payload: unknown): DemoTrialUpgrade | null =>
  isRecord(payload) ? normalizeDemoTrialUpgrade(payload.upgrade) : null;

export const isDemoTrialLimitPayload = (payload: unknown): boolean => {
  if (!isRecord(payload)) return false;
  const reasonCode = readText(payload.reason_code);
  const errorCode = readText(payload.error);
  return (
    errorCode === 'demo_limit_reached' ||
    Boolean(reasonCode && DEMO_TRIAL_LIMIT_CODES.has(reasonCode)) ||
    Boolean(errorCode && DEMO_TRIAL_LIMIT_CODES.has(errorCode))
  );
};

export const readDemoTrialLimitMessage = (payload: unknown): string | null =>
  isDemoTrialLimitPayload(payload) && isRecord(payload)
    ? readText(payload.message) ?? readText(payload.detail) ?? readText(payload.description)
    : null;
