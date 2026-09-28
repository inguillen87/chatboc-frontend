import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const fetchMock=vi.hoisted(()=>vi.fn());
vi.mock('@/utils/api',()=>({apiFetch:fetchMock,getErrorMessage:(error:Error)=>error.message}));
import {useCrmContactHistory} from './useCrmContactHistory';
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
const payload=(id='42',tenant?:string)=>({contact:{id},...(tenant?{tenant_slug:tenant}:{}),interactions:[{content:'Contenido exclusivo '+id,ts:'2026-09-28T12:00:00Z'}]});
const setup=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,wrapper:({children}:{children:React.ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>};};
beforeEach(()=>fetchMock.mockReset());
describe('CRM history identity and freshness boundary',()=>{
 it.each([{contact:{id:'84'}},{contact:{id:'42'},contact_id:'84'},{contact:{id:'42'},tenant_slug:'other'},{contact:{id:'42',tenant_slug:'other'}},{contact:{id:'42'},tenant:{slug:'other'}},{contact:{}},{contact:[]},{}])('rejects an absent or inconsistent identity %j',async patch=>{
  fetchMock.mockResolvedValue({...payload(),...patch,contact:patch.contact});
  const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),setup());
  await waitFor(()=>expect(result.current.error).not.toBeNull());expect(result.current.data).toBeNull();
 });
 it.each([401,403,404,500])('drops previous content and refetch receipt on HTTP %i',async status=>{
  fetchMock.mockResolvedValueOnce(payload()).mockRejectedValueOnce(Object.assign(new Error('PIN: 8432'),{status}));
  const {client,wrapper}=setup();const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),{wrapper});
  await waitFor(()=>expect(result.current.data?.contactId).toBe('42'));
  let receipt:unknown;await act(async()=>{receipt=await result.current.refetch();});
  expect(receipt).toMatchObject({data:null});
  await waitFor(()=>expect(result.current.error).not.toBeNull());expect(result.current.data).toBeNull();
  expect(result.current.error).not.toContain('8432');
  expect(JSON.stringify(client.getQueriesData({queryKey:['crm','contact-history']}))).not.toContain('Contenido exclusivo');
 });
 it('removes data when disabled and does not allow manual refetch to bypass it',async()=>{
  fetchMock.mockResolvedValue(payload());
  const {result,rerender}=renderHook(({enabled})=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled}),{...setup(),initialProps:{enabled:true}});
  await waitFor(()=>expect(result.current.data).not.toBeNull());rerender({enabled:false});
  expect(result.current.data).toBeNull();await act(async()=>{await result.current.refetch();});expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('does not expose a previous snapshot while refreshing',async()=>{
  const pending=deferred<ReturnType<typeof payload>>();fetchMock.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
  const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),setup());
  await waitFor(()=>expect(result.current.data).not.toBeNull());
  let request:Promise<unknown>;act(()=>{request=result.current.refetch();});
  await waitFor(()=>expect(result.current.isFetching).toBe(true));expect(result.current.data).toBeNull();
  await act(async()=>{pending.resolve(payload());await request;});await waitFor(()=>expect(result.current.data?.contactId).toBe('42'));
 });
 it('discards a manual read completed after switching organization',async()=>{
  const pending=deferred<ReturnType<typeof payload>>();fetchMock.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise).mockResolvedValue(payload('42','mendoza'));
  const {result,rerender}=renderHook(({tenantSlug})=>useCrmContactHistory({tenantSlug,contactId:'42',enabled:true}),{...setup(),initialProps:{tenantSlug:'junin'}});
  await waitFor(()=>expect(result.current.data).not.toBeNull());
  let request:Promise<unknown>;act(()=>{request=result.current.refetch();});rerender({tenantSlug:'mendoza'});
  let receipt:unknown;await act(async()=>{pending.resolve(payload());receipt=await request;});
  expect(receipt).toMatchObject({data:null});
 });
 it.each([null,[],{contact:{id:'42'},interactions:{}},{contact:{id:'42'},interactions:[null]}])('rejects a malformed history %j instead of reporting an empty success',async value=>{
  fetchMock.mockResolvedValue(value);const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),setup());
  await waitFor(()=>expect(result.current.error).not.toBeNull());expect(result.current.data).toBeNull();
 });
});

describe('history session lifecycle',()=>{
 it('loads in StrictMode after cancellation of initialization',async()=>{
  fetchMock.mockResolvedValue(payload());const {wrapper:Provider}=setup();
  const wrapper=({children}:{children:React.ReactNode})=><React.StrictMode><Provider>{children}</Provider></React.StrictMode>;
  const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),{wrapper});
  await waitFor(()=>expect(result.current.data?.contactId).toBe('42'));expect(result.current.error).toBeNull();
 });
 it('starts a new read for a new mounted view of the same contact',async()=>{
  const {client,wrapper}=setup();fetchMock.mockResolvedValueOnce(payload());
  const first=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),{wrapper});
  await waitFor(()=>expect(first.result.current.data).not.toBeNull());first.unmount();
  expect(client.getQueriesData({queryKey:['crm','contact-history']})).toEqual([]);
  fetchMock.mockRejectedValueOnce(Object.assign(new Error('Unavailable'),{status:403}));
  const second=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),{wrapper});
  expect(second.result.current.data).toBeNull();await waitFor(()=>expect(second.result.current.error).not.toBeNull());
  expect(second.result.current.data).toBeNull();expect(fetchMock).toHaveBeenCalledTimes(2);
 });
 it('recovers with a new validated read after a rejected identity',async()=>{
  fetchMock.mockResolvedValueOnce(payload('84')).mockResolvedValueOnce(payload());
  const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),setup());
  await waitFor(()=>expect(result.current.error).not.toBeNull());
  await act(async()=>{await result.current.refetch();});await waitFor(()=>expect(result.current.data?.contactId).toBe('42'));
  expect(result.current.error).toBeNull();
 });
});

describe('retired requests',()=>{
 it('discards a read completed after disabling the detail',async()=>{
  const pending=deferred<ReturnType<typeof payload>>();
  fetchMock.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
  const {client,wrapper}=setup();
  const {result,rerender}=renderHook(({enabled})=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled}),{wrapper,initialProps:{enabled:true}});
  await waitFor(()=>expect(result.current.data).not.toBeNull());let request:Promise<unknown>;
  act(()=>{request=result.current.refetch();});await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
  rerender({enabled:false});let receipt:unknown;
  await act(async()=>{pending.resolve(payload());receipt=await request;});
  expect(receipt).toMatchObject({data:null});expect(result.current.data).toBeNull();
  expect(client.getQueriesData({queryKey:['crm','contact-history']}).every(([,data])=>data==null)).toBe(true);
 });
 it.each([{tenant_slug:'other'},{contact_id:'84'}])('does not expose inconsistent interaction scope %j',async fields=>{
  fetchMock.mockResolvedValue({...payload(),interactions:[{...payload().interactions[0],...fields}]});
  const {result}=renderHook(()=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled:true}),setup());
  await waitFor(()=>expect(result.current.error).not.toBeNull());expect(result.current.data).toBeNull();
 });
 it('keeps a callback from an old selection inactive',async()=>{
  fetchMock.mockResolvedValue(payload());
  const {result,rerender}=renderHook(({enabled})=>useCrmContactHistory({tenantSlug:'junin',contactId:'42',enabled}),{...setup(),initialProps:{enabled:true}});
  await waitFor(()=>expect(result.current.data).not.toBeNull());const oldRefetch=result.current.refetch;
  rerender({enabled:false});await act(async()=>{expect(await oldRefetch()).toEqual({data:null});});
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
});
