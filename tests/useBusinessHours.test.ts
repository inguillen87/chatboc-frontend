/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBusinessHours } from '../src/hooks/useBusinessHours';

describe('useBusinessHours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          enabled: false,
          available: false,
          timezone: 'America/Argentina/Buenos_Aires',
          schedule: [],
          next_available: null,
        }),
      }),
    );
  });

  it('does not call legacy schedule endpoints without a tenant slug', async () => {
    renderHook(() => useBusinessHours());

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not call schedule when contract disables business hours', async () => {
    renderHook(() => useBusinessHours('entity123', 'demo', { enabled: false }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls same-origin tenant schedule when tenantSlug is provided', async () => {
    renderHook(() => useBusinessHours('entity123', 'demo'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/demo/live-chat/schedule?tenant_slug=demo&tenant=demo',
        expect.objectContaining({
          cache: 'no-store',
          credentials: 'omit',
          headers: expect.objectContaining({
            Accept: 'application/json',
            'X-Entity-Token': 'entity123',
            'X-Tenant-Slug': 'demo',
            'X-Token': 'entity123',
          }),
        }),
      );
    });
  });
});
