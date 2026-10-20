import type { Prefs } from '@/components/chat/AccessibilityToggle';
import { apiFetch } from '@/utils/api';

export const ACCESSIBILITY_PREFERENCES_CONTRACT = 'user.accessibility_preferences.v1' as const;

export interface AccessibilityPreferencesContract {
  contract_version: typeof ACCESSIBILITY_PREFERENCES_CONTRACT;
  user_id: number | string;
  initialized: boolean;
  preferences: Prefs;
}

const preferenceKeys: Array<keyof Prefs> = [
  'dyslexia',
  'simplified',
  'highContrast',
  'largeControls',
  'captions',
  'reducedMotion',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const parseAccessibilityPreferences = (
  payload: unknown,
  expectedUserId?: number | string,
): AccessibilityPreferencesContract => {
  if (
    !isRecord(payload)
    || payload.contract_version !== ACCESSIBILITY_PREFERENCES_CONTRACT
    || !['number', 'string'].includes(typeof payload.user_id)
    || typeof payload.initialized !== 'boolean'
    || !isRecord(payload.preferences)
    || preferenceKeys.some((key) => typeof payload.preferences[key] !== 'boolean')
  ) {
    throw new Error('accessibility_preferences_contract_invalid');
  }
  if (
    expectedUserId !== undefined
    && String(payload.user_id) !== String(expectedUserId)
  ) {
    throw new Error('accessibility_preferences_identity_mismatch');
  }
  return payload as unknown as AccessibilityPreferencesContract;
};

const requestOptions = {
  cache: 'no-store' as const,
  omitTenant: true,
  persistTenantSlug: false,
  suppressPanel401Redirect: true,
  preserveAuthOn401: true,
};

export const getAccessibilityPreferences = async (expectedUserId: number | string) => {
  const payload = await apiFetch<unknown>('/api/accessibility/me', requestOptions);
  return parseAccessibilityPreferences(payload, expectedUserId);
};

export const updateAccessibilityPreferences = async (
  expectedUserId: number | string,
  preferences: Prefs,
) => {
  const payload = await apiFetch<unknown>('/api/accessibility/me', {
    ...requestOptions,
    method: 'PUT',
    body: preferences,
  });
  return parseAccessibilityPreferences(payload, expectedUserId);
};
