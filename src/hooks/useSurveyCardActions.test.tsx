import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSurveyCardActions } from './useSurveyCardActions';
afterEach(cleanup);
const deferred = () => { let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };

describe('survey card single-flight actions', () => {
  it('coalesces repeated close confirmations before a render', async () => {
    const operation = deferred(), close = vi.fn(() => operation.promise);
    const { result } = renderHook(() => useSurveyCardActions({ blocked: false, close }));
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.close(); b = result.current.close(); });
    expect(a).toBe(b);
    await act(async () => { await Promise.resolve(); });
    expect(close).toHaveBeenCalledTimes(1); expect(result.current.pending).toBe('close');
    await act(async () => { operation.resolve(); await a; });
    expect(result.current.pending).toBeNull();
  });
  it('coalesces repeated deletion confirmations', async () => {
    const operation = deferred(), remove = vi.fn(() => operation.promise);
    const { result } = renderHook(() => useSurveyCardActions({ blocked: false, delete: remove }));
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.delete(); b = result.current.delete(); });
    expect(a).toBe(b);
    await act(async () => { await Promise.resolve(); operation.resolve(); await a; });
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('does not enqueue a different mutation behind an active operation', async () => {
    const operation = deferred(), close = vi.fn(() => operation.promise), remove = vi.fn();
    const { result } = renderHook(() => useSurveyCardActions({ blocked: false, close, delete: remove }));
    let first!: Promise<void>; act(() => { first = result.current.close(); });
    await expect(result.current.delete()).rejects.toThrow('survey_card_action_pending');
    await act(async () => { await Promise.resolve(); operation.resolve(); await first; });
    expect(remove).not.toHaveBeenCalled();
  });
  it('does not execute callbacks retained from an unmounted scope', async () => {
    const close = vi.fn(); const { result, unmount } = renderHook(() => useSurveyCardActions({ blocked: false, close }));
    const retained = result.current.close; unmount();
    await expect(retained()).rejects.toThrow('survey_card_scope_expired'); expect(close).not.toHaveBeenCalled();
  });
  it('rechecks current capability for a callback retained from an earlier render', async () => {
    const close = vi.fn();
    const { result, rerender } = renderHook(({ allowed }) => useSurveyCardActions({ blocked: false, close: allowed ? close : undefined }), { initialProps: { allowed: true } });
    const retained = result.current.close; rerender({ allowed: false });
    await expect(retained()).rejects.toThrow('survey_card_action_unavailable'); expect(close).not.toHaveBeenCalled();
  });
  it('does not start queued microtask work if its scope unmounts first', async () => {
    const close = vi.fn(); const { result, unmount } = renderHook(() => useSurveyCardActions({ blocked: false, close }));
    let task!: Promise<void>; act(() => { task = result.current.close(); }); unmount();
    await expect(task).rejects.toThrow('survey_card_scope_expired'); expect(close).not.toHaveBeenCalled();
  });
  it('respects another pending operation declared by the parent', async () => {
    const close = vi.fn(); const { result } = renderHook(() => useSurveyCardActions({ blocked: true, close }));
    await expect(result.current.close()).rejects.toThrow('survey_card_action_unavailable'); expect(close).not.toHaveBeenCalled();
  });
  it('does not retry a rejected operation automatically', async () => {
    const close = vi.fn().mockRejectedValueOnce(new Error('server rejection')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSurveyCardActions({ blocked: false, close }));
    let first!: Promise<void>; act(() => { first = result.current.close(); });
    await act(async () => { await expect(first).rejects.toThrow('server rejection'); });
    expect(close).toHaveBeenCalledTimes(1); expect(result.current.pending).toBeNull();
    await act(async () => { await result.current.close(); }); expect(close).toHaveBeenCalledTimes(2);
  });
  it('releases the local lock after a synchronous handler exception', async () => {
    const close = vi.fn(() => { throw new Error('synchronous'); });
    const { result } = renderHook(() => useSurveyCardActions({ blocked: false, close }));
    let task!: Promise<void>; act(() => { task = result.current.close(); });
    await act(async () => { await expect(task).rejects.toThrow('synchronous'); });
    expect(result.current.isPending()).toBe(false);
  });
});
