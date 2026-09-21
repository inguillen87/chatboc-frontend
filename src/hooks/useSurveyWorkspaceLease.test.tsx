import { StrictMode, type ReactNode } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSurveyWorkspaceLease } from './useSurveyWorkspaceLease';

afterEach(cleanup);
describe('useSurveyWorkspaceLease', () => {
  it('keeps the same workspace completion current across ordinary rerenders', () => {
    const { result, rerender } = renderHook(() => useSurveyWorkspaceLease());
    const isCurrent = result.current();
    rerender();
    expect(isCurrent()).toBe(true);
  });
  it('invalidates completions and refuses new work after unmount', () => {
    const { result, unmount } = renderHook(() => useSurveyWorkspaceLease());
    const capture = result.current;
    const isCurrent = capture();
    unmount();
    expect(isCurrent()).toBe(false);
    expect(() => capture()).toThrow('survey_workspace_unmounted');
  });
  it('creates an active final lifetime under StrictMode and invalidates it on exit', () => {
    const { result, unmount } = renderHook(() => useSurveyWorkspaceLease(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });
    const isCurrent = result.current();
    expect(isCurrent()).toBe(true);
    unmount();
    expect(isCurrent()).toBe(false);
  });
});
