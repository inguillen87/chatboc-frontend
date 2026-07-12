/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBusinessHours } from '../src/hooks/useBusinessHours';

const scheduleResponse = (
  body: Record<string, unknown>,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
) =>
  ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

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

  it('uses the relative schedule endpoint supplied by the live-chat contract', async () => {
    renderHook(() =>
      useBusinessHours('entity123', 'demo', {
        scheduleEndpoint: ' /api/public/live-chat/schedule?source=widget ',
      }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/public/live-chat/schedule?source=widget',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it('falls back to the tenant schedule for a non-relative supplied endpoint', async () => {
    renderHook(() =>
      useBusinessHours('entity123', 'demo', {
        scheduleEndpoint: 'https://other.example/live-chat/schedule',
      }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/demo/live-chat/schedule?tenant_slug=demo&tenant=demo',
        expect.any(Object),
      );
    });
  });

  it('aborts the active request when the supplied endpoint changes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { rerender } = renderHook(
      ({ scheduleEndpoint }) =>
        useBusinessHours('entity123', 'demo', { scheduleEndpoint }),
      { initialProps: { scheduleEndpoint: '/api/schedules/a' } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal;

    rerender({ scheduleEndpoint: '/api/schedules/b' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/schedules/b');
  });

  it('clears tenant A availability when tenant B schedule fails', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        scheduleResponse({
          enabled: true,
          available: true,
          description: 'Lunes a viernes, 9 a 18',
          timezone: 'America/Argentina/Buenos_Aires',
        }),
      )
      .mockResolvedValueOnce(scheduleResponse({}, { ok: false, status: 503 }));

    const { result, rerender } = renderHook(
      ({ tenantSlug, scheduleEndpoint }) =>
        useBusinessHours('entity123', tenantSlug, { scheduleEndpoint }),
      {
        initialProps: {
          tenantSlug: 'tenant-a',
          scheduleEndpoint: '/api/schedules/a',
        },
      },
    );

    await waitFor(() => expect(result.current.isLiveChatEnabled).toBe(true));

    rerender({
      tenantSlug: 'tenant-b',
      scheduleEndpoint: '/api/schedules/b',
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual({
      isLiveChatEnabled: false,
      horariosAtencion: '',
      availabilityLabel: '',
      timezone: '',
    });
  });

  it('ignores a late tenant A response after tenant B schedule fails', async () => {
    const tenantAResponse = deferred<Response>();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(() => tenantAResponse.promise)
      .mockResolvedValueOnce(scheduleResponse({}, { ok: false, status: 503 }));

    const { result, rerender } = renderHook(
      ({ tenantSlug, scheduleEndpoint }) =>
        useBusinessHours('entity123', tenantSlug, { scheduleEndpoint }),
      {
        initialProps: {
          tenantSlug: 'tenant-a',
          scheduleEndpoint: '/api/schedules/a',
        },
      },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const tenantASignal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal;

    rerender({
      tenantSlug: 'tenant-b',
      scheduleEndpoint: '/api/schedules/b',
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(tenantASignal.aborted).toBe(true);

    await act(async () => {
      tenantAResponse.resolve(
        scheduleResponse({
          enabled: true,
          available: true,
          description: 'Horario de tenant A',
          timezone: 'Tenant/A',
        }),
      );
      await tenantAResponse.promise;
      await Promise.resolve();
    });

    expect(result.current).toEqual({
      isLiveChatEnabled: false,
      horariosAtencion: '',
      availabilityLabel: '',
      timezone: '',
    });
  });
});
