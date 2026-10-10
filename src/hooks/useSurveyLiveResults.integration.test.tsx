import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getPublicSurveyLiveResults } from '@/api/encuestas';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { ApiError } from '@/utils/api';
import { useSurveyLiveResults } from './useSurveyLiveResults';

vi.mock('@/api/encuestas', () => ({ getPublicSurveyLiveResults: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getPublicSurveyLiveResults).mockReset();
  safeLocalStorage.clear();
});
afterEach(() => vi.useRealTimers());

it('marks cached results stale on the first failure, counts successive failures and recovers', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const view = renderHook(() => useSurveyLiveResults('live-counter', 'tenant-counter'), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(view.result.current.liveStatus.status).toBe('live');
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new Error('offline'));
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await act(async () => {
      await view.result.current.refetch();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(view.result.current.consecutiveErrors).toBe(attempt);
    expect(view.result.current.liveResults?.total_respuestas).toBe(12);
    expect(view.result.current.liveStatus.status).toBe(attempt > 2 ? 'reconnecting' : 'stale');
  }
  expect(view.result.current.pollingIntervalMs).toBe(10000);
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 13 });
  await act(async () => {
    await view.result.current.refetch();
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(view.result.current.consecutiveErrors).toBe(0);
  expect(view.result.current.liveStatus.status).toBe('live');
  expect(view.result.current.liveResults?.total_respuestas).toBe(13);
  view.unmount();
  client.clear();
});

it('removes withdrawn results from the displayed and persistent cache and stops polling', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const view = renderHook(() => useSurveyLiveResults('withdrawn', 'tenant'), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(view.result.current.liveResults?.total_respuestas).toBe(12);
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Resultados ocultos', 403, { reason_code: 'live_results_hidden' }));
  await act(async () => { await view.result.current.refetch(); await vi.advanceTimersByTimeAsync(1); });
  expect(view.result.current.liveResults).toBeUndefined();
  expect(view.result.current.liveStatus.label).toBe('Resultados no disponibles');
  expect(view.result.current.pollingIntervalMs).toBeNull();
  expect(safeLocalStorage.getItem('survey-live-results:tenant:withdrawn:{}')).toBeNull();
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
  view.unmount();
  client.clear();
});
