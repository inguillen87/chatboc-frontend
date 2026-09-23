import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import {
  retryApplicationInitializingRequest,
  retryTransientRead,
} from '@/utils/retryTransientRead';

describe('retryTransientRead', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recovers an idempotent read after a transient runtime failure', async () => {
    const request = vi
      .fn<() => Promise<{ status: string }>>()
      .mockRejectedValueOnce(new ApiError('cold start failed', 500))
      .mockResolvedValueOnce({ status: 'ready' });

    await expect(retryTransientRead(request, [0])).resolves.toEqual({ status: 'ready' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent contract error', async () => {
    const request = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new ApiError('invalid request', 400));

    await expect(retryTransientRead(request, [0, 0])).rejects.toMatchObject({ status: 400 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('honors a bounded Retry-After hint for a transient read', async () => {
    const timeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: () => void) => {
        callback();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);
    const request = vi
      .fn<() => Promise<{ status: string }>>()
      .mockRejectedValueOnce(new ApiError('starting', 503, null, undefined, 2_000))
      .mockResolvedValueOnce({ status: 'ready' });

    await expect(retryTransientRead(request, [250])).resolves.toEqual({ status: 'ready' });
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2_000);
  });

  it('retries a fetch-style network TypeError for an idempotent read', async () => {
    const request = vi
      .fn<() => Promise<{ status: string }>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ status: 'ready' });

    await expect(retryTransientRead(request, [0])).resolves.toEqual({ status: 'ready' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries an explicitly unprocessed bootstrap mutation', async () => {
    const request = vi
      .fn<() => Promise<{ session: string }>>()
      .mockRejectedValueOnce(new ApiError('starting', 503, {
        contract_version: 'chatboc.bootstrap.v1',
        reason_code: 'application_initializing',
        retryable: true,
      }))
      .mockResolvedValueOnce({ session: 'ready' });

    await expect(retryApplicationInitializingRequest(request, [0])).resolves.toEqual({
      session: 'ready',
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not replay an ambiguous mutation failure', async () => {
    const request = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new ApiError('gateway unavailable', 503));

    await expect(retryApplicationInitializingRequest(request, [0, 0])).rejects.toMatchObject({
      status: 503,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
