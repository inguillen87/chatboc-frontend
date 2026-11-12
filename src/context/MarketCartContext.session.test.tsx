import React from 'react';
import {act,cleanup,render,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {MarketCartResponse} from '@/types/market';
const mocks=vi.hoisted(()=>({read:vi.fn(),add:vi.fn(),stored:vi.fn(),persist:vi.fn()}));
vi.mock('@/api/market',()=>({fetchMarketCart:mocks.read,addMarketItem:mocks.add}));
vi.mock('@/utils/marketStorage',()=>({readStoredCart:mocks.stored,persistStoredCart:mocks.persist}));
import {MarketCartProvider,useMarketCart} from './MarketCartContext';
const cart=(quantity=1,name='Producto'):MarketCartResponse=>({items:[{id:'p1',name,quantity,price:10}],totalAmount:quantity*10,totalPoints:0,
 customer_profile:{name:'Cliente'},checkout_options:{payment_required:true,gateway_configured:true},checkout_preview:{payment_ready:true,amount_validated:true,stock_status:'available'},mercadopago_ready:true});
const deferred=<T,>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let current:ReturnType<typeof useMarketCart>;
const Capture=()=>{current=useMarketCart();return <span>{current.items[0]?.name}</span>;};
const tree=(tenant:string|null,path='/t/qa-a/market')=><MemoryRouter initialEntries={[path]}><MarketCartProvider tenantSlug={tenant}><Capture/></MarketCartProvider></MemoryRouter>;
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockReset();mocks.add.mockReset();mocks.stored.mockReset();mocks.stored.mockReturnValue({items:[],totalAmount:null,totalPoints:null});});
afterEach(cleanup);
const loaded=async()=>{mocks.read.mockResolvedValueOnce(cart());const view=render(tree('qa-a'));await waitFor(()=>expect(current.isLoading).toBe(false));return view;};
describe('cart operation lifecycle',()=>{
 it('does not restore the old quantity when an earlier GET finishes after an add',async()=>{
  await loaded();const late=deferred<MarketCartResponse>();mocks.read.mockReturnValueOnce(late.promise);mocks.add.mockResolvedValueOnce(cart(2));
  let reading:Promise<void>;act(()=>{reading=current.refreshCart();});await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2));
  await act(async()=>{expect(await current.addItem('p1')).toBe(true);});
  await act(async()=>{late.resolve(cart(1));await reading!;});
  expect(current.items[0].quantity).toBe(2);expect(mocks.persist.mock.calls.at(-1)[1].items[0].quantity).toBe(2);
 });
 it('keeps loading active while add is pending even when an old GET finishes',async()=>{
  await loaded();const read=deferred<MarketCartResponse>(),add=deferred<MarketCartResponse>();mocks.read.mockReturnValueOnce(read.promise);mocks.add.mockReturnValueOnce(add.promise);
  let a:Promise<void>,b:Promise<boolean>;act(()=>{a=current.refreshCart();});await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2));act(()=>{b=current.addItem('p1');});
  await act(async()=>{read.resolve(cart());await a!;});expect(current.isLoading).toBe(true);
  await act(async()=>{add.resolve(cart(2));await b!;});expect(current.isLoading).toBe(false);
 });
 it('does not send a second add before React commits the disabled state',async()=>{
  await loaded();const add=deferred<MarketCartResponse>();mocks.add.mockReturnValue(add.promise);
  let first:Promise<boolean>,second:Promise<boolean>;act(()=>{first=current.addItem('p1');second=current.addItem('p1');});
  await waitFor(()=>expect(mocks.add).toHaveBeenCalledOnce());
  expect(await second!).toBe(false);await act(async()=>{add.resolve(cart(2));expect(await first!).toBe(true);});
 });
 it('coalesces duplicate reads rather than racing two snapshots',async()=>{
  await loaded();const read=deferred<MarketCartResponse>();mocks.read.mockReturnValue(read.promise);
  let a:Promise<void>,b:Promise<void>;act(()=>{a=current.refreshCart();b=current.refreshCart();});
  await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2));
  await act(async()=>{read.resolve(cart(2));await Promise.all([a!,b!]);});
 });
 it('retires checkout eligibility, contact and cached items after current read failure',async()=>{
  await loaded();mocks.read.mockRejectedValueOnce(new Error('server failure'));
  await act(async()=>{await current.refreshCart();});
  expect(current.items).toEqual([]);expect(current.totalAmount).toBeNull();expect(current.customerProfile).toBeNull();
  expect(current.checkoutOptions).toBeNull();expect(current.checkoutPreview).toBeNull();expect(current.mercadopagoReady).toBeNull();
  expect(mocks.persist.mock.calls.at(-1)).toEqual(['qa-a',{items:[],totalAmount:null,totalPoints:null}]);
 });
 it('isolates organizations without asking every provider consumer to supply a key',async()=>{
  const pending=deferred<MarketCartResponse>();mocks.read.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(cart(3,'Empresa B'));
  const view=render(tree('qa-a'));await waitFor(()=>expect(mocks.read).toHaveBeenCalledOnce());view.rerender(tree('qa-b'));
  await waitFor(()=>expect(current.items[0]?.name).toBe('Empresa B'));
  await act(async()=>{pending.resolve(cart(1,'Empresa A'));await pending.promise;});
  expect(current.items[0]?.name).toBe('Empresa B');expect(mocks.persist.mock.calls.every(([tenant])=>tenant==='qa-b')).toBe(true);
 });
 it('does not write browser storage or report add success after unmount',async()=>{
  const view=await loaded();mocks.persist.mockClear();const pending=deferred<MarketCartResponse>();mocks.add.mockReturnValueOnce(pending.promise);
  let work:Promise<boolean>;act(()=>{work=current.addItem('p1');});await waitFor(()=>expect(mocks.add).toHaveBeenCalledOnce());view.unmount();
  await act(async()=>{pending.resolve(cart(2));expect(await work!).toBe(false);});expect(mocks.persist).not.toHaveBeenCalled();
 });
 it('makes retained callbacks inert once their provider was retired',async()=>{
  const view=await loaded();const {refreshCart,addItem}=current;view.unmount();
  await refreshCart();expect(await addItem('p1')).toBe(false);
  expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.add).not.toHaveBeenCalled();
 });
 it.each(['/admin','/qa-a/admin','/t/qa-a/admin','/t/qa-a/analytics'])('does not read or mutate a public cart on %s',async path=>{
  mocks.read.mockResolvedValue(cart());mocks.add.mockResolvedValue(cart(2));mocks.stored.mockReturnValue(cart());
  render(tree('qa-a',path));await act(async()=>{await current.refreshCart();expect(await current.addItem('p1')).toBe(false);});
  expect(mocks.read).not.toHaveBeenCalled();expect(mocks.add).not.toHaveBeenCalled();expect(current.items).toEqual([]);
 });
});

describe('cart read recovery and mutation ordering',()=>{
 it('defers and coalesces explicit refreshes requested during a pending write',async()=>{
  await loaded();const add=deferred<MarketCartResponse>();mocks.add.mockReturnValueOnce(add.promise);mocks.read.mockResolvedValueOnce(cart(3));
  let adding:Promise<boolean>,one:Promise<void>,two:Promise<void>;
  act(()=>{adding=current.addItem('p1');one=current.refreshCart();two=current.refreshCart();});
  await waitFor(()=>expect(mocks.add).toHaveBeenCalledOnce());expect(mocks.read).toHaveBeenCalledOnce();
  await act(async()=>{add.resolve(cart(2));await Promise.all([adding!,one!,two!]);});
  expect(mocks.read).toHaveBeenCalledTimes(2);expect(current.items[0].quantity).toBe(3);expect(current.isLoading).toBe(false);
 });
 it('does not let a stale read error erase a confirmed add or its storage',async()=>{
  await loaded();const stale=deferred<MarketCartResponse>();mocks.read.mockReturnValueOnce(stale.promise);mocks.add.mockResolvedValueOnce(cart(2));
  let reading:Promise<void>;act(()=>{reading=current.refreshCart();});await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2));
  await act(async()=>{await current.addItem('p1');});await act(async()=>{stale.reject(new Error('OLD ERROR'));await reading!;});
  expect(current.error).toBeNull();expect(current.items[0].quantity).toBe(2);expect(mocks.persist.mock.calls.at(-1)[1].items[0].quantity).toBe(2);
 });
 it('allows another deliberate add after the prior one has completed',async()=>{
  await loaded();mocks.add.mockResolvedValueOnce(cart(2)).mockResolvedValueOnce(cart(3));
  await act(async()=>{expect(await current.addItem('p1')).toBe(true);});
  await act(async()=>{expect(await current.addItem('p1')).toBe(true);});
  expect(mocks.add).toHaveBeenCalledTimes(2);expect(current.items[0].quantity).toBe(3);
 });
 it('recovers from a rejected read with current receipt and capabilities only',async()=>{
  await loaded();mocks.read.mockRejectedValueOnce(new Error('READ FAILURE')).mockResolvedValueOnce(cart(4,'Recuperado'));
  await act(async()=>{await current.refreshCart();});expect(current.error).toBe('READ FAILURE');
  await act(async()=>{await current.refreshCart();});expect(current.error).toBeNull();expect(current.items[0].name).toBe('Recuperado');expect(current.mercadopagoReady).toBe(true);
 });
 it('clears stale permission and data on failed writes but does not retry the POST',async()=>{
  await loaded();mocks.add.mockRejectedValueOnce(new Error('WRITE FAILURE'));
  await act(async()=>{expect(await current.addItem('p1')).toBe(false);});
  expect(mocks.add).toHaveBeenCalledOnce();expect(current.items).toEqual([]);expect(current.checkoutPreview).toBeNull();expect(current.isLoading).toBe(false);
 });
 it.each([0,-1,NaN,Infinity])('does not send an invalid quantity %s',async quantity=>{
  await loaded();await act(async()=>{expect(await current.addItem('p1',quantity)).toBe(false);});expect(mocks.add).not.toHaveBeenCalled();
 });
 it('preserves positive fractional quantities accepted by the API instead of forcing units',async()=>{
  await loaded();mocks.add.mockResolvedValueOnce(cart(0.5));await act(async()=>{expect(await current.addItem('p1',0.5)).toBe(true);});
  expect(mocks.add).toHaveBeenCalledWith('qa-a',{productId:'p1',quantity:0.5});
 });
 it.each([null,42,[],{},'invalid'])('tolerates malformed cached state %j without granting authority',async stored=>{
  const pending=deferred<MarketCartResponse>();mocks.stored.mockReturnValueOnce(stored);mocks.read.mockReturnValueOnce(pending.promise);
  render(tree('qa-a'));expect(current.items).toEqual([]);expect(current.isLoading).toBe(true);expect(current.checkoutOptions).toBeNull();
  await act(async()=>{pending.resolve(cart());await pending.promise;});await waitFor(()=>expect(current.isLoading).toBe(false));
 });
 it('reads a cached display draft once and never restores its checkout policy',async()=>{
  mocks.stored.mockReturnValue(cart());const pending=deferred<MarketCartResponse>();mocks.read.mockReturnValueOnce(pending.promise);
  const view=render(tree('qa-a'));expect(current.items).toHaveLength(1);expect(current.isLoading).toBe(true);expect(current.checkoutOptions).toBeNull();
  view.rerender(tree('qa-a'));expect(mocks.stored).toHaveBeenCalledOnce();
  await act(async()=>{pending.resolve(cart(2));await pending.promise;});await waitFor(()=>expect(current.isLoading).toBe(false));
 });
 it('keeps null tenants inert with no storage access',async()=>{
  render(tree(null));await act(async()=>{await current.refreshCart();expect(await current.addItem('p1')).toBe(false);});
  expect(current.isLoading).toBe(false);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.stored).not.toHaveBeenCalled();
 });
 it('initializes and retires safely under StrictMode',async()=>{
  mocks.read.mockResolvedValue(cart());render(<React.StrictMode>{tree('qa-a')}</React.StrictMode>);
  await waitFor(()=>expect(current.isLoading).toBe(false));expect(current.items).toHaveLength(1);expect(mocks.persist).toHaveBeenCalledOnce();
 });
});

describe('retired queued operations',()=>{
 it('does not execute a refresh queued behind a write after leaving the provider',async()=>{
  const view=await loaded();const pending=deferred<MarketCartResponse>();mocks.add.mockReturnValueOnce(pending.promise);
  let add:Promise<boolean>,refresh:Promise<void>;act(()=>{add=current.addItem('p1');refresh=current.refreshCart();});
  await waitFor(()=>expect(mocks.add).toHaveBeenCalledOnce());view.unmount();
  await act(async()=>{pending.resolve(cart(2));await Promise.all([add!,refresh!]);});
  expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.persist).toHaveBeenCalledOnce();
 });
 it.each([' ', '../qa-a', 'qa-a/other', 'qa-a?scope=other'])('refuses malformed tenant identities before touching cache or network: %s',tenant=>{
  render(tree(tenant));expect(current.items).toEqual([]);expect(current.isLoading).toBe(false);
  expect(mocks.stored).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
 });
});

describe('backend tenant slug compatibility',()=>{
 it.each(['pe\u00f1alol\u00e9n','s\u00e3o-paulo','tenant.name','tenant~name'])('preserves safe tenant segments accepted by public routing: %s',async tenant=>{
  mocks.read.mockResolvedValueOnce(cart());mocks.add.mockResolvedValueOnce(cart(2));
  render(tree(tenant,'/t/'+encodeURIComponent(tenant)+'/market'));
  await waitFor(()=>expect(mocks.read).toHaveBeenCalledWith(tenant));
  await waitFor(()=>expect(current.isLoading).toBe(false));
  await act(async()=>{expect(await current.addItem('p1')).toBe(true);});
  expect(mocks.add).toHaveBeenCalledWith(tenant,{productId:'p1',quantity:1});
  expect(mocks.persist.mock.calls.at(-1)[0]).toBe(tenant);
 });
 it.each(['.','..','qa%2Fother','qa%252Fother','qa\\other','qa#other','qa\u0000other','\ud800'])('rejects unsafe or unencodable tenant structure %j without network or storage',tenant=>{
  render(tree(tenant));expect(current.items).toEqual([]);expect(current.isLoading).toBe(false);
  expect(mocks.read).not.toHaveBeenCalled();expect(mocks.stored).not.toHaveBeenCalled();
 });
});
