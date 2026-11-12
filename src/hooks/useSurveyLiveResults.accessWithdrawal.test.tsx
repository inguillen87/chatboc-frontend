import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { getPublicSurveyLiveResults } from '@/api/encuestas';
import type { SurveyLivePublicResultsPayload } from '@/types/encuestas';
import { ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useSurveyLiveResults } from './useSurveyLiveResults';

vi.mock('@/api/encuestas', () => ({ getPublicSurveyLiveResults: vi.fn() }));
const clients: QueryClient[] = [];
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};
const results: SurveyLivePublicResultsPayload = { total_respuestas: 12 };
const denied = (status = 403) => new ApiError('Resultados retirados', status);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
beforeEach(() => { vi.mocked(getPublicSurveyLiveResults).mockReset(); safeLocalStorage.clear(); });
afterEach(() => { clients.splice(0).forEach((client) => client.clear()); });

it.each([401, 403, 404])('keeps public results withdrawn after %s and a later network failure', async (status) => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValueOnce(results);
  const view = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setup().wrapper });
  await waitFor(() => expect(view.result.current.liveResults?.total_respuestas).toBe(12));
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValueOnce(denied(status)).mockRejectedValue(new Error('offline'));
  await act(async () => { await view.result.current.refetch(); });
  await waitFor(() => expect(view.result.current.accessWithdrawn).toBe(true));
  await act(async () => { await view.result.current.refetch(); });
  expect(view.result.current.accessWithdrawn).toBe(true);
  expect(view.result.current.liveResults).toBeUndefined();
  expect(view.result.current.pollingIntervalMs).toBeNull();
});

it('does not restore an older filter cache while a fresh request is still pending', async () => {
  const { client, wrapper } = setup();
  client.setQueryData(['survey-public-live-results', 'consulta', 'tdf', '{"canal":"web"}'], results);
  const pending = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValueOnce(denied()).mockReturnValue(pending.promise);
  const view = renderHook(({ canal }) => useSurveyLiveResults('consulta', 'tdf', { canal }), {
    wrapper, initialProps: { canal: 'whatsapp' },
  });
  await waitFor(() => expect(view.result.current.accessWithdrawn).toBe(true));
  view.rerender({ canal: 'web' });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2));
  expect(view.result.current.liveResults).toBeUndefined();
  await act(async () => { pending.resolve({ total_respuestas: 13 }); await pending.promise; });
  await waitFor(() => expect(view.result.current.liveResults?.total_respuestas).toBe(13));
  expect(view.result.current.accessWithdrawn).toBe(false);
});

it('remains withdrawn across remount and a new client with older persistent cache', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValueOnce(denied());
  const first = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setup().wrapper });
  await waitFor(() => expect(first.result.current.accessWithdrawn).toBe(true));
  first.unmount();
  safeLocalStorage.setItem(`survey-live-results:${JSON.stringify(['tdf', 'consulta', '{"canal":"web"}'])}`, JSON.stringify({ timestamp: Date.now(), data: results }));
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new Error('offline'));
  const second = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), { wrapper: setup().wrapper });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2));
  expect(second.result.current.accessWithdrawn).toBe(true);
  expect(second.result.current.liveResults).toBeUndefined();
});

it('does not use a request begun before withdrawal to restore results or persistent cache', async () => {
  const { wrapper } = setup();
  const old = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockImplementation((_slug, _tenant, params) =>
    params?.canal === 'web' ? old.promise : Promise.reject(denied()));
  const first = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), { wrapper });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(1));
  const second = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'whatsapp' }), { wrapper });
  await waitFor(() => expect(second.result.current.accessWithdrawn).toBe(true));
  await act(async () => { old.resolve(results); await old.promise; });
  expect(first.result.current.liveResults).toBeUndefined();
  expect(second.result.current.liveResults).toBeUndefined();
  expect(safeLocalStorage.getItem(`survey-live-results:${JSON.stringify(['tdf', 'consulta', '{"canal":"web"}'])}`)).toBeNull();
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await first.result.current.refetch(); });
  await waitFor(() => expect(first.result.current.liveResults?.total_respuestas).toBe(14));
  expect(second.result.current.accessWithdrawn).toBe(false);
});

it('ignores an older rejection after a newer request has verified public access', async () => {
  const { wrapper } = setup();
  const old = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockImplementation((_slug, _tenant, params) =>
    params?.canal === 'web' ? old.promise : Promise.resolve(results));
  renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), { wrapper });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(1));
  const second = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'whatsapp' }), { wrapper });
  await waitFor(() => expect(second.result.current.liveResults?.total_respuestas).toBe(12));
  await act(async () => { old.reject(denied()); await old.promise.catch(() => {}); });
  expect(second.result.current.accessWithdrawn).toBe(false);
  expect(second.result.current.liveResults?.total_respuestas).toBe(12);
});

it('keeps each filter unverified when a pre-withdrawal request finishes after another filter recovers', async () => {
  const { wrapper } = setup();
  const old = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockImplementation((_slug, _tenant, params) =>
    params?.canal === 'web' ? old.promise : Promise.reject(denied()));
  const first = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), { wrapper });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(1));
  const second = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'whatsapp' }), { wrapper });
  await waitFor(() => expect(second.result.current.accessWithdrawn).toBe(true));
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await second.result.current.refetch(); });
  await waitFor(() => expect(second.result.current.liveResults?.total_respuestas).toBe(14));
  await act(async () => { old.resolve(results); await old.promise; });
  expect(first.result.current.liveResults).toBeUndefined();
  expect(safeLocalStorage.getItem(`survey-live-results:${JSON.stringify(['tdf', 'consulta', '{"canal":"web"}'])}`)).toBeNull();
  await act(async () => { await first.result.current.refetch(); });
  await waitFor(() => expect(first.result.current.liveResults?.total_respuestas).toBe(14));
});

it('does not share persistent results between implicit tenant and a tenant named default', async () => {
  const { client, wrapper } = setup();
  client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: 30000 } });
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValueOnce(results).mockResolvedValueOnce({ total_respuestas: 3 });
  const first = renderHook(() => useSurveyLiveResults('consulta'), { wrapper });
  await waitFor(() => expect(first.result.current.liveResults?.total_respuestas).toBe(12));
  const second = renderHook(() => useSurveyLiveResults('consulta', 'default'), { wrapper });
  await waitFor(() => expect(second.result.current.liveResults?.total_respuestas).toBe(3));
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2);
  expect(first.result.current.liveResults?.total_respuestas).toBe(12);
});

it('requires each older filter to recover after a persisted withdrawal', async () => {
  safeLocalStorage.setItem(`survey-live-results-access:${JSON.stringify(['tdf', 'consulta'])}`, '403');
  const { client, wrapper } = setup();
  client.setQueryData(['survey-public-live-results', 'consulta', 'tdf', '{"canal":"web"}'], results);
  const pending = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockImplementation((_slug, _tenant, params) =>
    params?.canal === 'web' ? pending.promise : Promise.resolve({ total_respuestas: 14 }));
  const first = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), { wrapper });
  const second = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'whatsapp' }), { wrapper });
  await waitFor(() => expect(second.result.current.liveResults?.total_respuestas).toBe(14));
  expect(first.result.current.accessWithdrawn).toBe(false);
  expect(first.result.current.liveResults).toBeUndefined();
  await act(async () => { pending.resolve({ total_respuestas: 15 }); await pending.promise; });
  await waitFor(() => expect(first.result.current.liveResults?.total_respuestas).toBe(15));
});

it.each(['otra-encuesta', 'otro-tenant'])('does not propagate public withdrawal to %s', async (scope) => {
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValueOnce(denied()).mockResolvedValue(results);
  const { wrapper } = setup();
  const first = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper });
  await waitFor(() => expect(first.result.current.accessWithdrawn).toBe(true));
  const second = renderHook(() => useSurveyLiveResults(scope === 'otra-encuesta' ? scope : 'consulta', scope === 'otro-tenant' ? scope : 'tdf'), { wrapper });
  await waitFor(() => expect(second.result.current.liveResults?.total_respuestas).toBe(12));
  expect(first.result.current.accessWithdrawn).toBe(true);
});
