import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { getPublicSurveyLiveResults } from '@/api/encuestas';
import type { SurveyLivePublicResultsPayload } from '@/types/encuestas';
import { ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useSurveyLiveResults } from './useSurveyLiveResults';

vi.mock('@/api/encuestas', () => ({ getPublicSurveyLiveResults: vi.fn() }));

const clients: QueryClient[] = [];
const accessKey = (tenant = 'tdf', survey = 'consulta') =>
  `survey-live-results-access:${JSON.stringify([tenant, survey])}`;
const payloadKey = (params = '{}') =>
  `survey-live-results:${JSON.stringify(['tdf', 'consulta', params])}`;
const readNotice = (status: number) => {
  const raw = window.localStorage.getItem(accessKey());
  expect(raw).not.toBeNull();
  const notice = JSON.parse(raw!);
  expect(notice).toEqual({ v: 1, status, id: expect.any(String) });
  expect(notice.id).toMatch(/^[a-zA-Z0-9-]{1,128}$/);
  // The persisted notice contains only status/version and an opaque ID, never
  // the response payload or the ApiError's message/details.
  expect(Object.keys(notice).sort()).toEqual(['id', 'status', 'v']);
  return raw!;
};
const setupTab = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30000 } },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
};

// Separate QueryClients represent separate tab caches. JSDOM does not deliver a
// StorageEvent for a local write, matching the browser's writer-tab behavior.
// Explicit events below model the subsequent delivery to another same-origin
// tab, with the native event key, values, URL and actual storageArea identity.
const deliverRemoteStorage = async (
  key: string,
  oldValue: string | null,
  newValue: string | null,
  storageArea: Storage | null = window.localStorage,
) => {
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key, oldValue, newValue, storageArea,
      url: `${window.location.origin}/public-results-in-another-tab`,
    }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

beforeEach(() => {
  vi.mocked(getPublicSurveyLiveResults).mockReset();
  safeLocalStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in cross-tab unit tests'); }));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

it.each([401, 403, 404])('retracts already-visible results in the other tab after a matching remote %s', async (status) => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => {
    expect(writer.result.current.liveResults?.total_respuestas).toBe(12);
    expect(recipient.result.current.liveResults?.total_respuestas).toBe(12);
  });
  const previousMarker = window.localStorage.getItem(accessKey());
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Resultados retirados', status));
  await act(async () => { await writer.result.current.refetch(); });
  await waitFor(() => expect(writer.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(status);
  expect(recipient.result.current.accessWithdrawn).toBe(false);
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;

  await deliverRemoteStorage(accessKey(), previousMarker, notice);
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  expect(recipient.result.current.liveResults).toBeUndefined();
  expect(recipient.result.current.pollingIntervalMs).toBeNull();
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it('does not let an older in-flight 200 clear remote withdrawal or write persistent results', async () => {
  const pending = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockImplementation((_survey, _tenant, params) =>
    params?.canal === 'web' ? pending.promise : Promise.reject(new ApiError('Resultados retirados', 403)));
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), {
    wrapper: setupTab().wrapper,
  });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(1));
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'whatsapp' }), {
    wrapper: setupTab().wrapper,
  });
  await waitFor(() => expect(writer.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(403);
  await deliverRemoteStorage(accessKey(), null, notice);
  await act(async () => { pending.resolve({ total_respuestas: 27 }); await pending.promise; });
  await waitFor(() => expect(recipient.result.current.isFetching).toBe(false));

  expect.soft(recipient.result.current.accessWithdrawn).toBe(true);
  expect.soft(recipient.result.current.liveResults).toBeUndefined();
  expect.soft(window.localStorage.getItem(accessKey())).toBe(notice);
  expect.soft(window.localStorage.getItem(payloadKey('{"canal":"web"}'))).toBeNull();
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(2);
});

it.each([
  ['another tenant', 'otro-tenant', 'consulta'],
  ['another survey', 'tdf', 'otra-encuesta'],
])('ignores a localStorage withdrawal belonging to %s', async (_name, tenant, survey) => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(12));
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  const key = accessKey(tenant, survey);
  window.localStorage.setItem(key, '403');
  await deliverRemoteStorage(key, null, '403');

  expect(recipient.result.current.accessWithdrawn).toBe(false);
  expect(recipient.result.current.liveResults?.total_respuestas).toBe(12);
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it.each(['sessionStorage', 'null'] as const)('ignores a matching-key event whose storageArea is %s', async (area) => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(12));
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  if (area === 'sessionStorage') window.sessionStorage.setItem(accessKey(), '403');
  await deliverRemoteStorage(accessKey(), null, '403', area === 'sessionStorage' ? window.sessionStorage : null);

  expect(recipient.result.current.accessWithdrawn).toBe(false);
  expect(recipient.result.current.liveResults?.total_respuestas).toBe(12);
  expect(window.localStorage.getItem(accessKey())).toBeNull();
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it('does not recover on remote marker removal until this tab receives its own fresh 200', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Resultados retirados', 403));
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(403);
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 13 });
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(writer.result.current.liveResults?.total_respuestas).toBe(13));
  expect(window.localStorage.getItem(accessKey())).toBe(notice);
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  // Own recovery retains the notice. Simulate a separate remote removal (for
  // example an older tab) explicitly; deletion is never access verification.
  window.localStorage.removeItem(accessKey());
  await deliverRemoteStorage(accessKey(), notice, null);

  expect(recipient.result.current.accessWithdrawn).toBe(true);
  expect(recipient.result.current.liveResults).toBeUndefined();
  expect(recipient.result.current.pollingIntervalMs).toBeNull();
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await recipient.result.current.refetch(); });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(14));
  expect(recipient.result.current.accessWithdrawn).toBe(false);
});

it('blocks an old 200 settling before the queued remote storage task is delivered', async () => {
  const pending = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockImplementation((_survey, _tenant, params) =>
    params?.canal === 'web' ? pending.promise : Promise.reject(new ApiError('Private denial details', 403)));
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'web' }), {
    wrapper: setupTab().wrapper,
  });
  await waitFor(() => expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(1));
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf', { canal: 'whatsapp' }), {
    wrapper: setupTab().wrapper,
  });
  await waitFor(() => expect(writer.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(403);
  expect(notice).not.toContain('Private denial details');
  // No StorageEvent has been dispatched yet: the shared write precedes the
  // receiving browser's queued storage task, while this GET can settle first.
  await act(async () => { pending.resolve({ total_respuestas: 27 }); await pending.promise; });
  await waitFor(() => expect(recipient.result.current.isFetching).toBe(false));
  expect(recipient.result.current.accessWithdrawn).toBe(true);
  expect(recipient.result.current.liveResults).toBeUndefined();
  expect(window.localStorage.getItem(accessKey())).toBe(notice);
  expect(window.localStorage.getItem(payloadKey('{"canal":"web"}'))).toBeNull();
  await deliverRemoteStorage(accessKey(), null, notice);
  expect(recipient.result.current.accessWithdrawn).toBe(true);
});

it('retracts recovered results for a second 403 with a distinct opaque notice', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => {
    expect(writer.result.current.liveResults?.total_respuestas).toBe(12);
    expect(recipient.result.current.liveResults?.total_respuestas).toBe(12);
  });
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('First private denial', 403));
  await act(async () => { await writer.result.current.refetch(); });
  const firstNotice = readNotice(403);
  await deliverRemoteStorage(accessKey(), null, firstNotice);
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await recipient.result.current.refetch(); });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(14));
  expect(window.localStorage.getItem(accessKey())).toBe(firstNotice);
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Second private denial', 403));
  await act(async () => { await writer.result.current.refetch(); });
  const secondNotice = readNotice(403);
  expect(secondNotice).not.toBe(firstNotice);
  expect(JSON.parse(secondNotice).id).not.toBe(JSON.parse(firstNotice).id);
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  await deliverRemoteStorage(accessKey(), firstNotice, secondNotice);
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  expect(recipient.result.current.liveResults).toBeUndefined();
  expect(recipient.result.current.pollingIntervalMs).toBeNull();
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it('ignores a superseded delayed notice after this tab verifies the newer notice with its own GET', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(12));
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Retirado', 403));
  await act(async () => { await writer.result.current.refetch(); });
  const oldNotice = readNotice(403);
  await deliverRemoteStorage(accessKey(), null, oldNotice);
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  await act(async () => { await writer.result.current.refetch(); });
  const currentNotice = readNotice(403);
  expect(currentNotice).not.toBe(oldNotice);
  // The GET sees the current shared notice before its event is delivered.
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await recipient.result.current.refetch(); });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(14));
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  await deliverRemoteStorage(accessKey(), null, oldNotice);
  expect(recipient.result.current.accessWithdrawn).toBe(false);
  expect(recipient.result.current.liveResults?.total_respuestas).toBe(14);
  expect(window.localStorage.getItem(accessKey())).toBe(currentNotice);
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it('does not re-withdraw recovered results when the same notice is delivered again', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Retirado', 403));
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(403);
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await recipient.result.current.refetch(); });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(14));
  expect(window.localStorage.getItem(accessKey())).toBe(notice);
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  await deliverRemoteStorage(accessKey(), null, notice);
  expect(recipient.result.current.accessWithdrawn).toBe(false);
  expect(recipient.result.current.liveResults?.total_respuestas).toBe(14);
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it('does not release withdrawn results for a malformed remote value', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Retirado', 403));
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(403);
  const malformed = '{not-json';
  window.localStorage.setItem(accessKey(), malformed);
  const attempts = vi.mocked(getPublicSurveyLiveResults).mock.calls.length;
  await deliverRemoteStorage(accessKey(), notice, malformed);
  expect(recipient.result.current.accessWithdrawn).toBe(true);
  expect(recipient.result.current.liveResults).toBeUndefined();
  expect(recipient.result.current.pollingIntervalMs).toBeNull();
  expect(getPublicSurveyLiveResults).toHaveBeenCalledTimes(attempts);
});

it('does not hydrate another tab\'s recovered cache into a new client whose own GET is still pending', async () => {
  vi.mocked(getPublicSurveyLiveResults).mockRejectedValue(new ApiError('Retirado', 403));
  const writer = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(writer.result.current.accessWithdrawn).toBe(true));
  const notice = readNotice(403);
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await writer.result.current.refetch(); });
  await waitFor(() => expect(writer.result.current.liveResults?.total_respuestas).toBe(14));
  expect(JSON.parse(window.localStorage.getItem(payloadKey())!).data.total_respuestas).toBe(14);
  expect(window.localStorage.getItem(accessKey())).toBe(notice);
  const pending = deferred<SurveyLivePublicResultsPayload>();
  vi.mocked(getPublicSurveyLiveResults).mockReturnValue(pending.promise);
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.isFetching).toBe(true));
  expect(recipient.result.current.accessWithdrawn).toBe(true);
  expect(recipient.result.current.liveResults).toBeUndefined();
  await act(async () => { pending.resolve({ total_respuestas: 16 }); await pending.promise; });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(16));
  expect(recipient.result.current.accessWithdrawn).toBe(false);
  expect(window.localStorage.getItem(accessKey())).toBe(notice);
});

it.each([401, 403, 404])('accepts a matching remote legacy status %s without treating it as recovery', async (status) => {
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 12 });
  const recipient = renderHook(() => useSurveyLiveResults('consulta', 'tdf'), { wrapper: setupTab().wrapper });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(12));
  const legacyNotice = String(status);
  window.localStorage.setItem(accessKey(), legacyNotice);
  await deliverRemoteStorage(accessKey(), null, legacyNotice);
  await waitFor(() => expect(recipient.result.current.accessWithdrawn).toBe(true));
  expect(recipient.result.current.liveResults).toBeUndefined();
  vi.mocked(getPublicSurveyLiveResults).mockResolvedValue({ total_respuestas: 14 });
  await act(async () => { await recipient.result.current.refetch(); });
  await waitFor(() => expect(recipient.result.current.liveResults?.total_respuestas).toBe(14));
  expect(recipient.result.current.accessWithdrawn).toBe(false);
  expect(window.localStorage.getItem(accessKey())).toBe(legacyNotice);
});
