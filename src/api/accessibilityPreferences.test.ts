import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAccessibilityPreferences,
  parseAccessibilityPreferences,
  updateAccessibilityPreferences,
} from '@/api/accessibilityPreferences';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const preferences = {
  dyslexia: true,
  simplified: false,
  highContrast: true,
  largeControls: false,
  captions: true,
  reducedMotion: true,
};

const contract = {
  contract_version: 'user.accessibility_preferences.v1',
  user_id: 41,
  initialized: true,
  preferences,
};

describe('accessibility preferences API', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('loads the authenticated portable profile without ambient tenant scope', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(contract as never);

    await expect(getAccessibilityPreferences(41)).resolves.toEqual(contract);
    expect(apiFetch).toHaveBeenCalledWith('/api/accessibility/me', expect.objectContaining({
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    }));
  });

  it('writes all inclusive controls as booleans', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(contract as never);

    await updateAccessibilityPreferences(41, preferences);
    expect(apiFetch).toHaveBeenCalledWith('/api/accessibility/me', expect.objectContaining({
      method: 'PUT',
      body: preferences,
    }));
  });

  it('fails closed when the backend responds for another account', () => {
    expect(() => parseAccessibilityPreferences({ ...contract, user_id: 99 }, 41))
      .toThrow('accessibility_preferences_identity_mismatch');
  });

  it('rejects partial or non-boolean preference contracts', () => {
    expect(() => parseAccessibilityPreferences({
      ...contract,
      preferences: { ...preferences, reducedMotion: 'false' },
    }, 41)).toThrow('accessibility_preferences_contract_invalid');

    const { captions: _captions, ...partial } = preferences;
    expect(() => parseAccessibilityPreferences({ ...contract, preferences: partial }, 41))
      .toThrow('accessibility_preferences_contract_invalid');
  });
});
