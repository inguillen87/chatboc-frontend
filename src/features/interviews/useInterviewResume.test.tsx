import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getResume: vi.fn(),
}));

vi.mock('./interviewsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./interviewsApi')>();
  return {
    ...actual,
    getInterviewResumeV2: mocks.getResume,
  };
});

import { interviewResumeFixture } from './interviewsTestFixture';
import { useInterviewResume } from './useInterviewResume';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe('useInterviewResume', () => {
  beforeEach(() => {
    mocks.getResume.mockReset();
    mocks.getResume.mockResolvedValue(interviewResumeFixture);
  });

  it('loads only the explicit tenant and normalized session checkpoint', async () => {
    const { result } = renderHook(() => useInterviewResume('42', 'escuela-demo'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getResume).toHaveBeenCalledTimes(1);
    expect(mocks.getResume).toHaveBeenCalledWith(42, 'escuela-demo');
    expect(result.current.data).toEqual(interviewResumeFixture);
  });

  it('stays disabled when tenant scope is missing', async () => {
    const { result } = renderHook(() => useInterviewResume('42', ''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mocks.getResume).not.toHaveBeenCalled();
  });
});
