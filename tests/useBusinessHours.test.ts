/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock the API and storage
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

  it('calls /live-chat/schedule when auth token exists but no tenantSlug', async () => {
    (safeLocalStorage.getItem as any).mockImplementation((key: string) =>
      key === 'authToken' ? 'token123' : null
    );

    renderHook(() => useBusinessHours());

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/live-chat/schedule', {
        skipAuth: false,
        entityToken: undefined,
        tenantSlug: undefined
      });
    });
  });

  it('calls /live-chat/schedule with entity token when auth token missing and no tenantSlug', async () => {
    (safeLocalStorage.getItem as any).mockImplementation((key: string) => null);

    renderHook(() => useBusinessHours('entity123'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/live-chat/schedule', {
        skipAuth: true,
        entityToken: 'entity123',
        tenantSlug: undefined
      });
    });
  });

  it('calls /api/demo/live-chat/schedule when tenantSlug is provided', async () => {
    (safeLocalStorage.getItem as any).mockImplementation((key: string) => null);

    renderHook(() => useBusinessHours(undefined, 'demo'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/demo/live-chat/schedule', {
        skipAuth: true,
        entityToken: undefined,
        tenantSlug: 'demo'
      });
    });
  });
});
