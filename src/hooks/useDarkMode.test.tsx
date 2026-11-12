import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDarkMode } from './useDarkMode';

const originalClass = document.documentElement.className;

beforeEach(() => {
  localStorage.removeItem('theme');
  document.documentElement.classList.remove('dark');
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
    media, matches: false,
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.className = originalClass;
  localStorage.removeItem('theme');
});

describe('useDarkMode host synchronization', () => {
  it('follows the real root class in both directions without a custom event', async () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useDarkMode());
    expect(result.current).toBe(true);

    act(() => document.documentElement.classList.remove('dark'));
    await waitFor(() => expect(result.current).toBe(false));

    act(() => document.documentElement.classList.add('dark'));
    await waitFor(() => expect(result.current).toBe(true));

    act(() => document.documentElement.classList.add('a11y-high-contrast'));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBe(true);
  });

  it('retains themechange compatibility and reads the root class rather than stale storage', async () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useDarkMode());
    expect(result.current).toBe(false);
    await act(async () => {
      document.documentElement.classList.add('dark');
      window.dispatchEvent(new Event('themechange'));
      await Promise.resolve();
    });
    expect(result.current).toBe(true);
  });

  it('disconnects its root-class observer and removes its event listener on unmount', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useDarkMode());
    const index = observe.mock.calls.findIndex(([target, options]) =>
      target === document.documentElement && options?.attributeFilter?.join(',') === 'class');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(observe.mock.calls[index][1]).toEqual({ attributes: true, attributeFilter: ['class'] });
    const observer = observe.mock.contexts[index];
    unmount();
    expect(disconnect.mock.contexts).toContain(observer);
    expect(removeListener).toHaveBeenCalledWith('themechange', expect.any(Function));
  });
});
