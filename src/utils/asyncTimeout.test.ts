import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AsyncOperationTimeoutError,
  withAsyncTimeout,
} from '@/utils/asyncTimeout';

describe('withAsyncTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a successful response and clears the fallback timer', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    await expect(withAsyncTimeout(Promise.resolve('ready'), 8_000, 'navigation')).resolves.toBe(
      'ready',
    );
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves the original request error instead of converting it to a timeout', async () => {
    vi.useFakeTimers();
    const backendError = new Error('backend unavailable');

    await expect(
      withAsyncTimeout(Promise.reject(backendError), 8_000, 'navigation'),
    ).rejects.toBe(backendError);
  });

  it('rejects a request that never settles after the configured timeout', async () => {
    vi.useFakeTimers();
    const pending = withAsyncTimeout(
      new Promise<never>(() => undefined),
      8_000,
      'Backoffice navigation',
    );
    const expectation = expect(pending).rejects.toMatchObject({
      name: 'AsyncOperationTimeoutError',
      code: 'ASYNC_OPERATION_TIMEOUT',
      timeoutMs: 8_000,
    } satisfies Partial<AsyncOperationTimeoutError>);

    await vi.advanceTimersByTimeAsync(8_000);
    await expectation;
  });
});
