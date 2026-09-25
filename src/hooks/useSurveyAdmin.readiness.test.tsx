import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({slug:'org-a' as string|null,list:vi.fn(),detail:vi.fn(),storage:vi.fn()}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:mock.slug})}));
vi.mock('@/utils/safeLocalStorage',()=>({safeLocalStorage:{getItem:mock.storage}}));
vi.mock('@/api/encuestas',()=>({adminListSurveys:mock.list,adminGetSurvey:mock.detail,
  adminCreateSurvey:vi.fn(),adminCloseSurvey:vi.fn(),adminDeleteSurvey:vi.fn(),adminDuplicateSurvey:vi.fn(),adminSeedSurvey:vi.fn(),adminUpdateSurvey:vi.fn()}));
vi.mock('@/features/surveys/surveysApi',()=>({publishSurveyV2:vi.fn()}));
import {useSurveyAdmin} from './useSurveyAdmin';
const page=(id=12,extra={})=>({contract_version:'surveys.admin_list.v2',tenant:{id:7,slug:'org-a'},data:[{id,tenant_id:7,titulo:'Encuesta privada',preguntas:[]}],...extra});
const deferred=()=>{let resolve!:(value:unknown)=>void;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const clients:QueryClient[]=[];
const wrapper=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);return ({children}:{children:React.ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;};
beforeEach(()=>{mock.slug='org-a';mock.list.mockReset().mockResolvedValue(page());mock.detail.mockReset();mock.storage.mockReset().mockReturnValue(null);});
afterEach(()=>{cleanup();clients.forEach(client=>client.clear());clients.length=0;});
describe('survey list freshness and scope',()=>{
  it.each([401,403,500])('retires the cached list after refresh fails with %s',async status=>{
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.surveys?.data).toHaveLength(1));
    mock.list.mockRejectedValueOnce({status});await act(async()=>{await result.current.refetchList();});
    await waitFor(()=>expect(result.current.listError).toBeTruthy());expect(result.current.surveys).toBeUndefined();
    expect(result.current.surveyListProgress.loaded).toBe(0);
  });
  it('hides the previous results until a manual refresh completes',async()=>{
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.surveys?.data).toHaveLength(1));
    const pending=deferred();mock.list.mockReturnValueOnce(pending.promise);
    let refresh:Promise<unknown>;act(()=>{refresh=result.current.refetchList();});
    await waitFor(()=>expect(result.current.isLoadingList).toBe(true));expect(result.current.surveys).toBeUndefined();
    await act(async()=>{pending.resolve(page(13));await refresh;});await waitFor(()=>expect(result.current.surveys?.data[0].id).toBe(13));
  });
});
describe('survey list pagination and lifecycle',()=>{
  const paging=(cursor:string|null,next:string|null)=>({contract_version:'surveys.pagination.v1',cursor,next_cursor:next,has_more:next!==null,returned:1,total_items:2});
  it('does not recover a historical local-storage tenant while no scope is selected',()=>{
    mock.slug=null;mock.storage.mockReturnValue('org-a');
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});
    expect(mock.list).not.toHaveBeenCalled();expect(result.current.surveys).toBeUndefined();expect(result.current.tenantScopeError).toBeTruthy();
  });
  it.each([401,403,404])('retires loaded instruments after pagination is denied with %s',async status=>{
    mock.list.mockResolvedValueOnce(page(12,{pagination:paging(null,'next')})).mockRejectedValueOnce({status});
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.hasMoreSurveys).toBe(true));
    await act(async()=>{await result.current.loadMoreSurveys();});
    await waitFor(()=>expect(result.current.listError).toBeTruthy());expect(result.current.surveys).toBeUndefined();expect(result.current.hasMoreSurveys).toBe(false);
  });
  it('keeps received pages for a temporary pagination failure and retries only on request',async()=>{
    mock.list.mockResolvedValueOnce(page(12,{pagination:paging(null,'next')})).mockRejectedValueOnce({status:503}).mockResolvedValueOnce(page(11,{pagination:paging('next',null)}));
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.hasMoreSurveys).toBe(true));
    await act(async()=>{await result.current.loadMoreSurveys();});await waitFor(()=>expect(result.current.loadMoreError).toBeTruthy());
    expect(result.current.surveys?.data).toHaveLength(1);expect(mock.list).toHaveBeenCalledTimes(2);
    await act(async()=>{await result.current.loadMoreSurveys();});await waitFor(()=>expect(result.current.surveys?.data).toHaveLength(2));
    expect(result.current.loadMoreError).toBeNull();expect(mock.list).toHaveBeenCalledTimes(3);
  });
  it('does not start load-more or another refresh while a refresh is pending',async()=>{
    mock.list.mockResolvedValueOnce(page(12,{pagination:paging(null,'next')}));const pending=deferred();
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.hasMoreSurveys).toBe(true));
    mock.list.mockReturnValueOnce(pending.promise);let refresh:Promise<unknown>;
    act(()=>{refresh=result.current.refetchList();void result.current.refetchList();void result.current.loadMoreSurveys();});
    expect(mock.list).toHaveBeenCalledTimes(2);await act(async()=>{pending.resolve(page(10));await refresh;});
    await waitFor(()=>expect(result.current.surveys?.data[0].id).toBe(10));
  });
  it('discards an old response after switching A to B to A',async()=>{
    const old=deferred();mock.list.mockReturnValueOnce(old.promise);
    const view=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});
    mock.slug='org-b';mock.list.mockResolvedValueOnce(page(20,{tenant:{id:8,slug:'org-b'},data:[{id:20,tenant_id:8,titulo:'B'}]}));view.rerender();
    await waitFor(()=>expect(view.result.current.surveys?.data[0].id).toBe(20));
    mock.slug='org-a';mock.list.mockResolvedValueOnce(page(21));view.rerender();
    await waitFor(()=>expect(view.result.current.surveys?.data[0].id).toBe(21));
    await act(async()=>old.resolve(page(1)));expect(view.result.current.surveys?.data[0].id).toBe(21);
  });
  it('rejects duplicate records across pages rather than silently keeping an older copy',async()=>{
    mock.list.mockResolvedValueOnce(page(12,{pagination:paging(null,'next')})).mockResolvedValueOnce(page(12,{pagination:paging('next',null)}));
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.hasMoreSurveys).toBe(true));
    await act(async()=>{await result.current.loadMoreSurveys();});await waitFor(()=>expect(result.current.listError).toBeTruthy());
    expect(result.current.surveys).toBeUndefined();
  });
  it('does not certify the received count as the backend total when no total exists',async()=>{
    const {result}=renderHook(()=>useSurveyAdmin(),{wrapper:wrapper()});await waitFor(()=>expect(result.current.surveys?.data).toHaveLength(1));
    expect(result.current.surveyListProgress).toEqual({loaded:1,total:null});
  });
  it('keeps one request when equal filters are passed as a new object',async()=>{
    const {result,rerender}=renderHook(({filters})=>useSurveyAdmin({listParams:filters}),{wrapper:wrapper(),initialProps:{filters:{limit:50}}});
    await waitFor(()=>expect(result.current.surveys?.data).toHaveLength(1));rerender({filters:{limit:50}});expect(mock.list).toHaveBeenCalledOnce();
  });
});
