import { describe, expect, it } from 'vitest';
import { waitForAbort, throwIfAborted } from './waitForAbort';

describe('local waiting cancellation', () => {
  it('keeps shared work available to a second caller', async () => {
    let resolve!: (value: string) => void;
    const task = new Promise<string>((accept) => { resolve = accept; });
    const first = new AbortController();
    const cancelled = waitForAbort(task, first.signal).catch((error) => error.name);
    const second = waitForAbort(task, new AbortController().signal);
    first.abort(); expect(await cancelled).toBe('AbortError');
    resolve('done'); expect(await second).toBe('done');
  });
  it('rejects an already cancelled wait', async () => {
    const controller = new AbortController(); controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow();
    await expect(waitForAbort(Promise.resolve(1), controller.signal)).rejects.toBeDefined();
  });
  it('retains ordinary rejection when no signal is provided', async () => {
    await expect(waitForAbort(Promise.reject(new Error('failed')))).rejects.toThrow('failed');
  });
});
