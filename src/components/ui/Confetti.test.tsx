import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Confetti from './Confetti';
import {
  ACCESSIBILITY_EVENT,
  DEFAULT_ACCESSIBILITY_PREFS,
  persistAccessibilityPrefs,
  readAccessibilityPrefs,
} from '@/components/chat/AccessibilityToggle';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const mediaFixture = (initial = false) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return {
    change: (matches: boolean) => act(() => {
      query.matches = matches;
      for (const listener of listeners) listener();
    }),
  };
};

let frameId: number;
let frames: Map<number, FrameRequestCallback>;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;
let getContext: ReturnType<typeof vi.spyOn>;
let draw: ReturnType<typeof vi.fn>;

beforeEach(() => {
  safeLocalStorage.clear();
  frameId = 0;
  frames = new Map();
  requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  cancelFrame = vi.fn((id: number) => frames.delete(id));
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  draw = vi.fn();
  getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(), save: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    fillRect: draw, restore: vi.fn(), fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  safeLocalStorage.clear();
  document.documentElement.classList.remove('a11y-reduced-motion', 'a11y-simplified');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Confetti motion accessibility', () => {
  it.each(['system', 'local'] as const)('does not create a canvas or schedule frames with initial %s reduction', (source) => {
    mediaFixture(source === 'system');
    if (source === 'local') {
      persistAccessibilityPrefs({ ...DEFAULT_ACCESSIBILITY_PREFS, reducedMotion: true });
    }

    const view = render(<Confetti />);

    expect(view.container.querySelector('canvas')).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('draws decorative confetti and continues its frame loop when motion is enabled', () => {
    mediaFixture();
    const view = render(<Confetti />);

    expect(view.container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    expect(draw).toHaveBeenCalled();
    expect(frames.size).toBe(1);
    const [id, callback] = Array.from(frames.entries())[0];
    const drawsBeforeFrame = draw.mock.calls.length;
    act(() => {
      frames.delete(id);
      callback(16);
    });
    expect(draw.mock.calls.length).toBeGreaterThan(drawsBeforeFrame);
    expect(frames.size).toBe(1);
  });

  it('cancels the active frame and removes the canvas when the OS requests less motion', () => {
    const media = mediaFixture();
    const view = render(<Confetti />);
    const activeFrame = Array.from(frames.keys())[0];

    media.change(true);

    expect(view.container.querySelector('canvas')).toBeNull();
    expect(cancelFrame).toHaveBeenCalledWith(activeFrame);
    expect(frames.size).toBe(0);
    const scheduledAfterStop = requestFrame.mock.calls.length;
    act(() => window.dispatchEvent(new Event('resize')));
    expect(requestFrame).toHaveBeenCalledTimes(scheduledAfterStop);
  });

  it('honors local changes live and never lets a local opt-out override the OS', () => {
    const media = mediaFixture();
    const view = render(<Confetti />);
    const activeFrame = Array.from(frames.keys())[0];

    act(() => persistAccessibilityPrefs({ ...DEFAULT_ACCESSIBILITY_PREFS, reducedMotion: true }));
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(cancelFrame).toHaveBeenCalledWith(activeFrame);
    expect(frames.size).toBe(0);

    media.change(true);
    act(() => persistAccessibilityPrefs({ ...DEFAULT_ACCESSIBILITY_PREFS, reducedMotion: false }));
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(frames.size).toBe(0);

    media.change(false);
    expect(view.container.querySelector('canvas')).not.toBeNull();
    expect(frames.size).toBe(1);
  });

  it('releases the pending frame and listeners on unmount', () => {
    mediaFixture();
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const view = render(<Confetti />);
    const activeFrame = Array.from(frames.keys())[0];
    const resizeListener = added.mock.calls.find(([type]) => type === 'resize')?.[1];
    const preferenceListener = added.mock.calls.find(([type]) => type === ACCESSIBILITY_EVENT)?.[1];

    view.unmount();

    expect(cancelFrame).toHaveBeenCalledWith(activeFrame);
    expect(frames.size).toBe(0);
    expect(removed).toHaveBeenCalledWith('resize', resizeListener);
    expect(removed).toHaveBeenCalledWith(ACCESSIBILITY_EVENT, preferenceListener);
  });

  it('uses the current preference event even when storage cannot save the change', () => {
    mediaFixture();
    persistAccessibilityPrefs({ ...DEFAULT_ACCESSIBILITY_PREFS, reducedMotion: false });
    const view = render(<Confetti />);
    const activeFrame = Array.from(frames.keys())[0];
    vi.spyOn(safeLocalStorage, 'setItem').mockImplementation(() => undefined);

    act(() => persistAccessibilityPrefs({ ...DEFAULT_ACCESSIBILITY_PREFS, reducedMotion: true }));

    expect(readAccessibilityPrefs().reducedMotion).toBe(false);
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(cancelFrame).toHaveBeenCalledWith(activeFrame);
    expect(frames.size).toBe(0);
  });
});
