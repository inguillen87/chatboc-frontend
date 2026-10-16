import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import {
  retryApplicationInitializingRequest,
  retryTransientRead,
} from '@/utils/retryTransientRead';

describe('retryTransientRead', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it.each([500, 502, 503, 504])('does not retry an explicitly non-retryable shared error (%s)', async (status) => {
    const error = new ApiError('Dependency unavailable', status, {
      contract_version: 'shared.error.v1',
      status_code: status,
      reason_code: 'tenant_context_unavailable',
      retryable: false,
    });
    const request = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(retryTransientRead(request, [0, 0])).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retains bounded backoff for an explicitly retryable shared read error', async () => {
    vi.useFakeTimers();
    const request = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('Temporarily unavailable', 503, {
        contract_version: 'shared.error.v1',
        retryable: true,
      }, undefined, 20_000))
      .mockResolvedValueOnce('ready');

    const result = retryTransientRead(request, [250]);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('ready');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('preserves legacy retry behavior for an unversioned error body', async () => {
    const request = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('Unavailable', 503, { retryable: false }))
      .mockResolvedValueOnce('ready');

    await expect(retryTransientRead(request, [0])).resolves.toBe('ready');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry a retired read', async () => {
    const error = new DOMException('Scope retired', 'AbortError');
    const request = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(retryTransientRead(request, [0, 0])).rejects.toBe(error);
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

  it.each([false, true])('does not replay a shared dependency mutation error with retryable=%s', async (retryable) => {
    const error = new ApiError('Dependency unavailable', 503, {
      contract_version: 'shared.error.v1',
      reason_code: 'tenant_context_unavailable',
      retryable,
    });
    const request = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(retryApplicationInitializingRequest(request, [0, 0])).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
