import React, { useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFixedHeaderOffset } from './useFixedHeaderOffset';
const property = '--chatboc-fixed-header-height';
let height = 64.5; let measure: () => void;
const disconnect = vi.fn(); const observe = vi.fn();
function Header({ empty = false }: { empty?: boolean }) {
  const ref = useRef<HTMLElement>(null); useFixedHeaderOffset(ref);
  return empty ? null : <header ref={ref}>Cabecera</header>;
}
beforeEach(() => {
  height = 64.5; disconnect.mockReset(); observe.mockReset();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height } as DOMRect));
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { measure = callback; }
    observe = observe; disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.removeProperty(property); });
describe('fixed header space for runtime feedback', () => {
  it('measures and rounds the header height including responsive changes', () => {
    render(<Header />); expect(document.documentElement.style.getPropertyValue(property)).toBe('65px');
    height = 88; act(() => measure()); expect(document.documentElement.style.getPropertyValue(property)).toBe('88px');
    expect(observe).toHaveBeenCalledTimes(1);
  });
  it('supports window resizing when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined); render(<Header />); height = 72;
    act(() => window.dispatchEvent(new Event('resize')));
    expect(document.documentElement.style.getPropertyValue(property)).toBe('72px');
  });
  it('restores the preceding offset and disconnects listeners', () => {
    document.documentElement.style.setProperty(property, '12px'); const view = render(<Header />); view.unmount();
    expect(document.documentElement.style.getPropertyValue(property)).toBe('12px'); expect(disconnect).toHaveBeenCalledTimes(1);
    height = 200; act(() => window.dispatchEvent(new Event('resize')));
    expect(document.documentElement.style.getPropertyValue(property)).toBe('12px');
  });
  it('does not clear a newer offset written by another owner', () => {
    const view = render(<Header />); document.documentElement.style.setProperty(property, '90px'); view.unmount();
    expect(document.documentElement.style.getPropertyValue(property)).toBe('90px');
  });
  it('rejects invalid measurements without losing the last valid offset', () => {
    render(<Header />); height = NaN; act(() => measure()); height = -5; act(() => measure());
    expect(document.documentElement.style.getPropertyValue(property)).toBe('65px');
  });
  it('does not create observers without a header', () => {
    render(<Header empty />); expect(observe).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue(property)).toBe('');
  });
});
