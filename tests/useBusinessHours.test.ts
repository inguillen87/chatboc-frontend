/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../src/utils/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../src/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(),
  },
}));

import { apiFetch } from '../src/utils/api';
import { safeLocalStorage } from '../src/utils/safeLocalStorage';
import { useBusinessHours } from '../src/hooks/useBusinessHours';

describe('useBusinessHours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /auth/profile when auth token exists', async () => {
    (safeLocalStorage.getItem as any).mockImplementation((key: string) =>
      key === 'authToken' ? 'token123' : null
    );

    renderHook(() => useBusinessHours());

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/auth/profile');
    });
  });

  it('calls /perfil with entity token when auth token missing', async () => {
    (safeLocalStorage.getItem as any).mockImplementation((key: string) =>
      key === 'entityToken' ? 'entity123' : null
    );

    renderHook(() => useBusinessHours('entity123'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/perfil', { skipAuth: true, entityToken: 'entity123' });
    });
  });
});
