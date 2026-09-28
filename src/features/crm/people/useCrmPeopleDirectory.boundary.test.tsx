import React from 'react';
import {QueryClient,QueryClientProvider,focusManager} from '@tanstack/react-query';
import {act,renderHook,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',async()=>({...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {ApiError} from '@/utils/api';
import {parseCrmPeopleDirectoryPage,fetchCrmPeopleDirectoryPage,useCrmPeopleDirectory} from './useCrmPeopleDirectory';
const options={tenantSlug:'qa-a',q:'',marketing:'all' as const,channel:'all' as const};
const item=(id='person-1')=>({id,name:'Persona protegida '+id,email:'p***@example.test',phone:'***1234',pii_masked:true,source:'contact'});
const page=(patch:Record<string,unknown>={})=>({contract_version:'crm.people.directory.v2',tenant:{slug:'qa-a'},items:[item()],page:{limit:50,total:2,has_more:true,next_cursor:'page-2'},pii:{requested:false,masked:true,granted:false,permission:'crm_contacts_pii_read',reason_code:'pii_masked_by_default'},...patch});
const last=(patch:Record<string,unknown>={})=>page({items:[item('person-2')],page:{limit:50,total:2,has_more:false,next_cursor:null},...patch});
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,wrapper:({children}:{children:React.ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>};}
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
beforeEach(()=>mocks.fetch.mockReset());
afterEach(()=>{cleanup();vi.useRealTimers();focusManager.setFocused(undefined);});
describe('directory page validity',()=>{
 it.each([null,true,'',[],{},9007199254740992])('rejects non-verifiable totals %j',total=>{
  expect(()=>parseCrmPeopleDirectoryPage(page({page:{limit:50,total,has_more:false,next_cursor:null}}))).toThrow();
 });
 it.each([{limit:0,total:1,has_more:false,next_cursor:null},{limit:1,total:0,has_more:false,next_cursor:null},{limit:50,total:2,has_more:false,next_cursor:'extra'},{limit:50,total:2,has_more:true,next_cursor:42}])('rejects contradictory pagination %j',metadata=>{
  expect(()=>parseCrmPeopleDirectoryPage(page({page:metadata}))).toThrow();
 });
 it('rejects duplicate stable identities instead of rendering duplicate selectable rows',()=>{
  expect(()=>parseCrmPeopleDirectoryPage(page({items:[item(),item()]}))).toThrow();
 });
 it('rejects a page exceeding its published limit',()=>{
  expect(()=>parseCrmPeopleDirectoryPage(page({items:[item(),item('2')],page:{limit:1,total:2,has_more:false,next_cursor:null}}))).toThrow();
 });
 it.each([{tenant:{slug:'qa-b'}},{items:[{...item(),tenant_slug:'qa-b'}]},{filters:{q:'someone else',marketing:'all',channel:'all',sort:'recent_desc'}}])('rejects a foreign published request scope %j',patch=>{
  mocks.fetch.mockResolvedValue(page(patch));
  return expect(fetchCrmPeopleDirectoryPage(options)).rejects.toThrow();
 });
});
describe('directory cursor boundary',()=>{
 it.each([
  ['duplicate row',last({items:[item()]})],
  ['repeated cursor',page({items:[item('person-2')]})],
  ['changed PII policy',last({pii:{requested:true,masked:true,granted:false,permission:'crm_contacts_pii_read',reason_code:'pii_permission_required'}})],
 ])('rejects %s and clears the preceding population',async(_label,next)=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockResolvedValueOnce(next);
  const {wrapper,client}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  await act(async()=>{await result.current.fetchNextPage();});
  await waitFor(()=>expect(result.current.error).toBeTruthy());
  expect(result.current.data?.pages.flatMap(p=>p.items)??[]).toEqual([]);
  expect(result.current.hasNextPage).toBe(false);
  expect(client.getQueriesData({queryKey:['crm-people-directory-v2']}).some(([,data])=>JSON.stringify(data).includes('person-1'))).toBe(false);
 });
 it('does not retain names or free-form error bodies after next-page denial',async()=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockRejectedValueOnce(new ApiError('PRIVATE SERVER BODY',403));
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  let receipt:any;await act(async()=>{receipt=await result.current.fetchNextPage();});
  expect(receipt.data?.pages.flatMap((p:any)=>p.items)??[]).toEqual([]);
  await waitFor(()=>expect(result.current.error).toBeTruthy());
  expect(result.current.error?.message).toBe('No se pudieron cargar las personas');
  expect(result.current.hasNextPage).toBe(false);
 });
 it('restarts explicitly from the first page after rejection',async()=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockRejectedValueOnce(new ApiError('denied',403)).mockResolvedValueOnce(last({items:[item('new')],page:{limit:50,total:1,has_more:false,next_cursor:null}}));
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));await act(async()=>{await result.current.fetchNextPage();});
  await act(async()=>{await result.current.refetch();});
  expect(mocks.fetch.mock.calls[2][0]).not.toContain('cursor=');
  await waitFor(()=>expect(result.current.data?.pages[0]?.items[0]?.id).toBe('new'));
 });
 it('uses one request for two immediate load-more calls',async()=>{
  const pending=deferred<ReturnType<typeof last>>();mocks.fetch.mockResolvedValueOnce(page()).mockReturnValueOnce(pending.promise);
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  let a:Promise<unknown>,b:Promise<unknown>;act(()=>{a=result.current.fetchNextPage();b=result.current.fetchNextPage();});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async()=>{pending.resolve(last());await Promise.all([a!,b!]);});
  await waitFor(()=>expect(result.current.data?.pages).toHaveLength(2));
 });
});

describe('pagination preservation and recovery',()=>{
 it('does not combine an empty page with a promised continuation',()=>{
  expect(()=>parseCrmPeopleDirectoryPage(page({items:[]}))).toThrow();
 });
 it('refetches a multi-page population sequentially with fresh cursors',async()=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockResolvedValueOnce(last());
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.data?.pages).toHaveLength(1));
  await act(async()=>{await result.current.fetchNextPage();});
  const delayed=deferred<ReturnType<typeof page>>();
  mocks.fetch.mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(last({items:[item('fresh-2')]}));
  let refresh:Promise<unknown>;act(()=>{refresh=result.current.refetch();});
  await waitFor(()=>expect(result.current.data?.pages??[]).toHaveLength(0));
  await act(async()=>{delayed.resolve(page({items:[item('fresh-1')],page:{limit:50,total:2,has_more:true,next_cursor:'fresh-cursor'}}));await refresh!;});
  expect(mocks.fetch.mock.calls[2][0]).not.toContain('cursor=');
  expect(mocks.fetch.mock.calls[3][0]).toContain('cursor=fresh-cursor');
  await waitFor(()=>expect(result.current.data?.pages.flatMap(page=>page.items.map(row=>row.id))).toEqual(['fresh-1','fresh-2']));
 });
 it('does not keep the first page when a later page of revalidation fails',async()=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockResolvedValueOnce(last());
  const {wrapper,client}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.data?.pages).toHaveLength(1));await act(async()=>{await result.current.fetchNextPage();});
  mocks.fetch.mockResolvedValueOnce(page({items:[item('fresh')]})).mockRejectedValueOnce(new ApiError('private-body',500));
  let receipt:any;await act(async()=>{receipt=await result.current.refetch();});
  expect(receipt.data).toBeUndefined();
  await waitFor(()=>expect(result.current.data).toBeUndefined());
  expect(result.current.isSuccess).toBe(false);
  expect(JSON.stringify(client.getQueriesData({queryKey:['crm-people-directory-v2']}))).not.toContain('person-');
 });
 it('does not fall back to legacy for a continuation 404',async()=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockRejectedValueOnce(new ApiError('missing cursor',404));
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.data?.pages).toHaveLength(1));await act(async()=>{await result.current.fetchNextPage();});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);await waitFor(()=>expect(result.current.data).toBeUndefined());
 });
 it('preserves the existing fully protected legacy first-page fallback',async()=>{
  mocks.fetch.mockRejectedValueOnce(new ApiError('v2 absent',404)).mockResolvedValueOnce([{id:1,name:'PRIVATE NAME',email:'secret@example.test'}]);
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.pages[0].contractVersion).toBe('legacy.crm.clientes');
  expect(JSON.stringify(result.current.data)).not.toContain('PRIVATE');expect(JSON.stringify(result.current.data)).not.toContain('secret@');
  expect(result.current.hasNextPage).toBe(false);
 });
});

describe('directory view scope lifecycle',()=>{
 it('never applies a pending load-more result after changing organization',async()=>{
  const pending=deferred<ReturnType<typeof last>>();
  mocks.fetch.mockResolvedValueOnce(page()).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(last({tenant:{slug:'qa-b'},items:[item('other')]}));
  const {wrapper,client}=setup();const {result,rerender}=renderHook(({tenantSlug})=>useCrmPeopleDirectory({...options,tenantSlug}),{wrapper,initialProps:{tenantSlug:'qa-a'}});
  await waitFor(()=>expect(result.current.data?.pages).toHaveLength(1));
  let late:Promise<any>;act(()=>{late=result.current.fetchNextPage();});
  rerender({tenantSlug:'qa-b'});await waitFor(()=>expect(result.current.data?.pages[0].items[0].id).toBe('other'));
  await act(async()=>{pending.resolve(last());await late!;});
  expect((await late!).data).toBeUndefined();expect(result.current.data?.pages[0].items[0].id).toBe('other');
  expect(client.getQueriesData({queryKey:['crm-people-directory-v2','qa-a']})).toEqual([]);
 });
 it.each([{q:'changed'},{channel:'email' as const},{marketing:'true' as const}])('restarts from the first page when filters change %j',async patch=>{
  mocks.fetch.mockResolvedValueOnce(page()).mockResolvedValueOnce(last({filters:{...options,...patch,sort:'recent_desc'},items:[item('filtered')]}));
  const {wrapper}=setup();const {result,rerender}=renderHook(filters=>useCrmPeopleDirectory(filters),{wrapper,initialProps:options});
  await waitFor(()=>expect(result.current.data?.pages).toHaveLength(1));rerender({...options,...patch});
  await waitFor(()=>expect(result.current.data?.pages[0].items[0].id).toBe('filtered'));
  expect(mocks.fetch.mock.calls[1][0]).not.toContain('cursor=');expect(result.current.data?.pages).toHaveLength(1);
 });
 it('does not reactivate an invalid scope through retained imperative callbacks',async()=>{
  mocks.fetch.mockResolvedValueOnce(page());const {wrapper}=setup();
  const {result,rerender}=renderHook(({tenantSlug})=>useCrmPeopleDirectory({...options,tenantSlug}),{wrapper,initialProps:{tenantSlug:'qa-a'}});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));const oldRefetch=result.current.refetch,oldNext=result.current.fetchNextPage;
  rerender({tenantSlug:''});
  await act(async()=>{await oldRefetch();await oldNext();await result.current.refetch();await result.current.fetchNextPage();});
  expect(result.current.data).toBeUndefined();expect(result.current.hasNextPage).toBe(false);expect(result.current.isPending).toBe(false);
  expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('cancels an unmounted view without contaminating a later mount of the same filter',async()=>{
  const pending=deferred<ReturnType<typeof page>>();mocks.fetch.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(last({items:[item('current')]}));
  const {wrapper,client}=setup();const first=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});first.unmount();
  const second=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});await waitFor(()=>expect(second.result.current.isSuccess).toBe(true));
  await act(async()=>{pending.resolve(page());await pending.promise;});
  expect(second.result.current.data?.pages[0].items[0].id).toBe('current');
  expect(JSON.stringify(client.getQueriesData({queryKey:['crm-people-directory-v2']}))).not.toContain('person-1');
 });
 it('works under StrictMode without applying cancelled responses',async()=>{
  mocks.fetch.mockResolvedValue(last());const {wrapper:Base}=setup();
  const wrapper=({children}:{children:React.ReactNode})=><React.StrictMode><Base>{children}</Base></React.StrictMode>;
  const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));expect(result.current.data?.pages).toHaveLength(1);
 });
 it('revalidates stale pages on focus while a disabled scope remains inert',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2030-01-01T12:00:00Z'));
  mocks.fetch.mockResolvedValueOnce(last()).mockResolvedValueOnce(last({items:[item('refocused')]}));
  const {wrapper}=setup();const {result,rerender}=renderHook(({tenantSlug})=>useCrmPeopleDirectory({...options,tenantSlug}),{wrapper,initialProps:{tenantSlug:'qa-a'}});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  act(()=>{focusManager.setFocused(false);vi.setSystemTime(new Date('2030-01-01T12:00:31Z'));focusManager.setFocused(true);});
  await waitFor(()=>expect(result.current.data?.pages[0].items[0].id).toBe('refocused'));
  rerender({tenantSlug:''});act(()=>{focusManager.setFocused(false);vi.setSystemTime(new Date('2030-01-01T12:01:10Z'));focusManager.setFocused(true);});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);await waitFor(()=>expect(result.current.data).toBeUndefined());
 });
});

describe('privacy and empty-population edge cases',()=>{
 it('retires a previously granted population when a later page masks PII',async()=>{
  const privatePage=page({items:[{...item(),name:'PRIVATE GRANTED NAME',pii_masked:false,contact_id:'contact-secret'}],pii:{...page().pii,requested:true,masked:false,granted:true,reason_code:null}});
  mocks.fetch.mockResolvedValueOnce(privatePage).mockResolvedValueOnce(last());
  const {wrapper,client}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.data?.pages[0].items[0].name).toBe('PRIVATE GRANTED NAME'));
  let receipt:any;await act(async()=>{receipt=await result.current.fetchNextPage();});
  expect(receipt.data).toBeUndefined();await waitFor(()=>expect(result.current.data).toBeUndefined());
  expect(JSON.stringify(client.getQueriesData({queryKey:['crm-people-directory-v2']}))).not.toContain('PRIVATE GRANTED NAME');
 });
 it('keeps a verified empty terminal page as success rather than a permanent loader',async()=>{
  mocks.fetch.mockResolvedValue(page({items:[],page:{limit:50,total:0,has_more:false,next_cursor:null}}));
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));expect(result.current.isPending).toBe(false);expect(result.current.hasNextPage).toBe(false);
 });
 it('does not infer success from the temporary empty cache during an initial read',async()=>{
  const pending=deferred<ReturnType<typeof last>>();mocks.fetch.mockReturnValueOnce(pending.promise);
  const {wrapper}=setup();const {result}=renderHook(()=>useCrmPeopleDirectory(options),{wrapper});
  expect(result.current.isSuccess).toBe(false);expect(result.current.isPending).toBe(true);
  await act(async()=>{pending.resolve(last());await pending.promise;});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
 });
 it('accepts omitted optional filter and tenant echoes without inventing them',async()=>{
  const value=last();delete value.tenant;delete value.filters;mocks.fetch.mockResolvedValue(value);
  await expect(fetchCrmPeopleDirectoryPage(options)).resolves.toMatchObject({page:{has_more:false}});
 });
});
