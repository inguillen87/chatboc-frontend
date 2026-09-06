import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';
import { retryTransientRead } from '@/utils/retryTransientRead';

describe('retryTransientRead', () => {
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
});

