import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { surveyCardFixture } from '../../tests/fixtures/survey-card-actions';

const api = vi.hoisted(() => ({
  adminCreateSurvey: vi.fn(), adminCloseSurvey: vi.fn(), adminDeleteSurvey: vi.fn(),
  adminDuplicateSurvey: vi.fn(), adminGetSurvey: vi.fn(), adminListSurveys: vi.fn(),
  adminSeedSurvey: vi.fn(), adminUpdateSurvey: vi.fn(),
}));
vi.mock('@/api/encuestas', () => api);
vi.mock('@/features/surveys/surveysApi', () => ({ publishSurveyV2: vi.fn() }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'qa-a' }) }));
vi.mock('@/utils/safeLocalStorage', () => ({ safeLocalStorage: { getItem: () => null } }));
import { useSurveyAdmin } from './useSurveyAdmin';

const clients: QueryClient[] = [];
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
  clients.push(client);
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
const snapshot = () => ({ data: [surveyCardFixture()], tenant: { id: 7, slug: 'qa-a' } });
const failure = (status: number) => Object.assign(new Error(`read failure ${status}`), { status });

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.adminListSurveys.mockResolvedValue(snapshot());
  api.adminGetSurvey.mockResolvedValue(surveyCardFixture());
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
});

describe('useSurveyAdmin read-back and cached access', () => {
  it('does not return cached data as a successful default refresh after an error', async () => {
    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));
    api.adminListSurveys.mockRejectedValue(failure(503));
    await act(async () => expect(await result.current.refetchList()).toBeUndefined());
    await waitFor(() => expect(result.current.listRefreshError).toBeTruthy());
    expect(result.current.surveys?.data).toHaveLength(1);
    expect(result.current.listError).toBeNull();
    expect(api.adminListSurveys).toHaveBeenCalledTimes(2);
  });

  it('rejects a strict refresh and clears the stale marker only after a successful read', async () => {
    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));
    const error = failure(503);
    api.adminListSurveys.mockRejectedValue(error);
    await act(async () => { await expect(result.current.refetchList({ throwOnError: true })).rejects.toBe(error); });
    await waitFor(() => expect(result.current.listRefreshError).toBeTruthy());
    api.adminListSurveys.mockResolvedValue({ ...snapshot(), data: [] });
    await act(async () => { await result.current.refetchList({ throwOnError: true }); });
    await waitFor(() => expect(result.current.listRefreshError).toBeNull());
    expect(result.current.surveys?.data).toEqual([]);
    expect(api.adminCloseSurvey).not.toHaveBeenCalled();
    expect(api.adminDeleteSurvey).not.toHaveBeenCalled();
  });

  it.each([401, 403])('hides cached instruments and counts after a %s refresh', async status => {
    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.surveys?.data).toHaveLength(1));
    api.adminListSurveys.mockRejectedValue(failure(status));
    await act(async () => { await result.current.refetchList(); });
    await waitFor(() => expect(result.current.surveys).toBeUndefined());
    expect(result.current.surveyListProgress).toEqual({ loaded: 0, total: null });
    expect(result.current.hasMoreSurveys).toBe(false);
    expect(result.current.listError).toBeTruthy();
    expect(result.current.listRefreshError).toBeNull();
  });

  it('does not confuse a next-page error with invalidation of the loaded snapshot', async () => {
    api.adminListSurveys.mockResolvedValueOnce({
      ...snapshot(),
      pagination: { has_more: true, next_cursor: 'page-2', total_items: 2 },
    });
    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.hasMoreSurveys).toBe(true));
    api.adminListSurveys.mockRejectedValue(failure(503));
    await act(async () => { await result.current.loadMoreSurveys(); });
    await waitFor(() => expect(result.current.loadMoreError).toBeTruthy());
    expect(result.current.surveys?.data).toHaveLength(1);
    expect(result.current.listRefreshError).toBeNull();
    expect(result.current.listError).toBeNull();
  });

  it('does hide the cached first page when the next page revokes access', async () => {
    api.adminListSurveys.mockResolvedValueOnce({
      ...snapshot(),
      pagination: { has_more: true, next_cursor: 'page-2', total_items: 2 },
    });
    const { result } = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.hasMoreSurveys).toBe(true));
    api.adminListSurveys.mockRejectedValue(failure(403));
    await act(async () => { await result.current.loadMoreSurveys(); });
    await waitFor(() => expect(result.current.surveys).toBeUndefined());
    expect(result.current.listError).toBeTruthy();
  });

  it('hides the cached detail when its own read loses authorization', async () => {
    const { result } = renderHook(() => useSurveyAdmin({ id: 301 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.survey?.id).toBe(301));
    api.adminGetSurvey.mockRejectedValue(failure(403));
    await act(async () => { await result.current.refetchSurvey(); });
    await waitFor(() => expect(result.current.survey).toBeUndefined());
    expect(result.current.surveyError).toBeTruthy();
  });
});
