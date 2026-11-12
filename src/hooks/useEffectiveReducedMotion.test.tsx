import React, { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffectiveReducedMotion } from './useEffectiveReducedMotion';

const mediaFixture = (initial = false, legacy = false) => {
  const listeners = new Set<() => void>();
  const add = vi.fn((listener: () => void) => listeners.add(listener));
  const remove = vi.fn((listener: () => void) => listeners.delete(listener));
  const query = { matches: initial,
    ...(legacy ? { addListener: add, removeListener: remove } : {
      addEventListener: vi.fn((_name: string, listener: () => void) => add(listener)),
      removeEventListener: vi.fn((_name: string, listener: () => void) => remove(listener)),
    }),
  };
  const matchMedia = vi.fn(() => query);
  vi.stubGlobal('matchMedia', matchMedia);
  return { query, listeners, add, remove, matchMedia,
    change: (matches: boolean) => act(() => { query.matches = matches; for (const listener of listeners) listener(); }),
  };
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useEffectiveReducedMotion reactive system subscription', () => {
  it('reads the initial OS setting and applies local OR OS on live changes', () => {
    const media = mediaFixture(true);
    const view = renderHook(({ local }) => useEffectiveReducedMotion(local), { initialProps: { local: false } });
    expect(view.result.current).toBe(true);
    media.change(false); expect(view.result.current).toBe(false);
    view.rerender({ local: true }); expect(view.result.current).toBe(true);
    media.change(true); view.rerender({ local: false }); expect(view.result.current).toBe(true);
    media.change(false); expect(view.result.current).toBe(false);
    expect(media.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
  it('subscribes to legacy media queries and cleans up their exact listener', () => {
    const media = mediaFixture(false, true);
    const view = renderHook(() => useEffectiveReducedMotion());
    media.change(true); expect(view.result.current).toBe(true);
    expect(media.listeners.size).toBe(1);
    view.unmount(); expect(media.listeners.size).toBe(0);
    expect(media.remove).toHaveBeenCalledWith(media.add.mock.calls[0][0]);
  });
  it('balances modern listeners through StrictMode mount and unmount', () => {
    const media = mediaFixture();
    const view = renderHook(() => useEffectiveReducedMotion(), { wrapper: StrictMode });
    expect(media.listeners.size).toBe(1);
    media.change(true); expect(view.result.current).toBe(true);
    view.unmount(); expect(media.listeners.size).toBe(0);
    expect(media.remove).toHaveBeenCalledTimes(media.add.mock.calls.length);
  });
  it('keeps local settings functional when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const view = renderHook(({ local }) => useEffectiveReducedMotion(local), { initialProps: { local: false } });
    expect(view.result.current).toBe(false);
    view.rerender({ local: true }); expect(view.result.current).toBe(true);
  });
  it('uses a deterministic server snapshot without a window', () => {
    const Probe = ({ local }: { local: boolean }) => <output>{useEffectiveReducedMotion(local) ? 'reduce' : 'standard'}</output>;
    vi.stubGlobal('window', undefined);
    try {
      expect(renderToString(<Probe local={false} />)).toContain('standard');
      expect(renderToString(<Probe local />)).toContain('reduce');
    } finally { vi.unstubAllGlobals(); }
  });
});
