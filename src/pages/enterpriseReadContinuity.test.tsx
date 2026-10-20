import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {ApiError} from '@/utils/api';
const runtime=vi.hoisted(()=>({slug:'synthetic-a',user:{id:'operator-a'},hasVerifiedSession:true,contacts:vi.fn(),orders:vi.fn(),adminOrders:vi.fn(),update:vi.fn()}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:runtime.user,hasVerifiedSession:runtime.hasVerifiedSession,loading:false,organizationProfileVerified:true})}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:runtime.slug})}));
vi.mock('@/components/access/SessionAuthorityContext',async original=>({...await original<typeof import('@/components/access/SessionAuthorityContext')>(),useSessionAuthority:()=>({hasVerifiedSession:runtime.hasVerifiedSession,clerkStatus:'ready',hasBearerSession:false})}));
vi.mock('@/api/client',()=>({apiClient:{adminListContacts:runtime.contacts,listOrders:runtime.orders,adminListOrdersWithSummary:runtime.adminOrders,adminListOrders:runtime.adminOrders,adminUpdateOrder:runtime.update,adminCreateOrder:vi.fn()}}));
vi.mock('@/hooks/usePortalContent',()=>({usePortalContent:()=>({content:{catalog:[]},commerceSession:null,publicOrders:[],isLoading:false})}));
vi.mock('@/components/cart/AbandonedCartRecoveryPanel',()=>({default:()=>null}));
vi.mock('@/components/cart/UploadOrderFromFile',()=>({default:()=>null}));
import ClientsPage from './pyme/crm/ClientsPage';
import PedidosPage from './pyme/pedidos/PedidosPage';
import UserOrdersPage from './user-portal/UserOrdersPage';
const contact={id:'contact-a',name:'Contacto de A',phone:'123',type:'customer',total_orders:0,ltv:0,last_interaction:'2026-10-01T12:00:00Z'};
const order={id:'order-a',status:'confirmed',total:20,created_at:'2026-10-01T12:00:00Z',notes:'Pedido de A',customer_profile:{name:'Cliente pedido A'},items:[{name:'Pedido de A',quantity:1,price:20}]};
const defer=()=>{let resolve!:(value:any)=>void,reject!:(error:unknown)=>void;const promise=new Promise<any>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tree=(kind:'contacts'|'operator-orders'|'customer-orders')=><MemoryRouter>{kind==='contacts'?<ClientsPage/>:kind==='operator-orders'?<PedidosPage tenantSlug={runtime.slug}/>:<UserOrdersPage/>}</MemoryRouter>;
beforeEach(()=>{runtime.slug='synthetic-a';runtime.user={id:'operator-a'};runtime.hasVerifiedSession=true;runtime.contacts.mockReset().mockResolvedValue({contacts:[]});runtime.orders.mockReset().mockResolvedValue([]);runtime.update.mockReset();runtime.adminOrders.mockReset().mockResolvedValue({orders:[],count:0,total:0,sources:[],summary:null});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('enterprise read continuity',()=>{
 it('restarts the contact read after StrictMode effect replay and retires its first attempt',async()=>{
  const first=defer(),second=defer();runtime.contacts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<React.StrictMode>{tree('contacts')}</React.StrictMode>);
  await waitFor(()=>expect(runtime.contacts).toHaveBeenCalledTimes(2));
  await act(async()=>{first.resolve({contacts:[contact]});await first.promise;});
  expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
  const fresh={...contact,id:'contact-replayed',name:'Contacto confirmado después del replay'};
  await act(async()=>{second.resolve({contacts:[fresh]});await second.promise;});
  expect(await screen.findByText(fresh.name)).toBeInTheDocument();
  expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Recargar'})).toBeEnabled();
 });

 it.each(['contacts','operator-orders','customer-orders'] as const)('reports %s read failure instead of claiming an empty collection',async kind=>{
  const read=kind==='contacts'?runtime.contacts:kind==='operator-orders'?runtime.adminOrders:runtime.orders;
  read.mockRejectedValueOnce(new Error('Synthetic transport failure'));
  render(tree(kind));expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('No se encontraron contactos.')).not.toBeInTheDocument();
  expect(screen.queryByText('Sin pedidos')).not.toBeInTheDocument();
  expect(screen.queryByText('No tenés pedidos registrados aún.')).not.toBeInTheDocument();
 });
 it('withdraws contacts A synchronously during B and never restores them after B fails',async()=>{
  runtime.contacts.mockResolvedValueOnce({contacts:[contact]});const view=render(tree('contacts'));await screen.findByText(contact.name);
  const b=defer();runtime.contacts.mockReturnValueOnce(b.promise);runtime.slug='synthetic-b';view.rerender(tree('contacts'));
  expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
  await act(async()=>{b.reject(new Error('B unavailable'));await b.promise.catch(()=>{});});
  expect(screen.queryByText(contact.name)).not.toBeInTheDocument();expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Ver'})).not.toBeInTheDocument();
 });
 it('ignores a contacts response retired by a session revision in the same organization',async()=>{
  const a=defer();runtime.contacts.mockReturnValueOnce(a.promise);const view=render(tree('contacts'));
  await waitFor(()=>expect(runtime.contacts).toHaveBeenCalledOnce());
  act(()=>advanceChatbocSessionRevision());runtime.hasVerifiedSession=false;view.rerender(tree('contacts'));
  await act(async()=>{a.resolve({contacts:[contact]});await a.promise;});
  expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
 });
 it('preserves the contact search after a same-scope error and explicitly retries the read once',async()=>{
  runtime.contacts.mockResolvedValueOnce({contacts:[contact]});render(tree('contacts'));await screen.findByText(contact.name);
  fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o teléfono...'),{target:{value:'Contacto'}});
  runtime.contacts.mockRejectedValueOnce(new Error('Read failed'));fireEvent.click(screen.getByRole('button',{name:'Recargar'}));
  await screen.findByRole('alert');expect(screen.getByPlaceholderText('Buscar por nombre o teléfono...')).toHaveValue('Contacto');
  const retry=defer();runtime.contacts.mockReturnValueOnce(retry.promise);const button=screen.getByRole('button',{name:'Reintentar'});
  fireEvent.click(button);fireEvent.click(button);expect(runtime.contacts).toHaveBeenCalledTimes(3);
  await act(async()=>{retry.resolve({contacts:[contact]});await retry.promise;});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByPlaceholderText('Buscar por nombre o teléfono...')).toHaveValue('Contacto');
 });
 it.each(['aba','unmount'] as const)('retires a delayed contact result after %s',async kind=>{
  const a=defer();runtime.contacts.mockReturnValueOnce(a.promise);const view=render(tree('contacts'));await waitFor(()=>expect(runtime.contacts).toHaveBeenCalledOnce());
  if(kind==='unmount')view.unmount();else{runtime.slug='synthetic-b';view.rerender(tree('contacts'));runtime.slug='synthetic-a';view.rerender(tree('contacts'));}
  await act(async()=>{a.resolve({contacts:[contact]});await a.promise;});expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
 });
 it.each(['contacts','operator-orders','customer-orders'] as const)('withdraws %s confirmed rows on a denied read',async kind=>{
  const read=kind==='contacts'?runtime.contacts:kind==='operator-orders'?runtime.adminOrders:runtime.orders;
  read.mockRejectedValueOnce(new Error('temporary'));
  render(tree(kind));await screen.findByRole('alert');
  read.mockResolvedValueOnce(kind==='contacts'?{contacts:[contact]}:kind==='operator-orders'?{orders:[order],count:1,total:1,sources:[],summary:null}:[order]);
  fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
  const visibleText=kind==='contacts'?contact.name:kind==='operator-orders'?'1 items • Cliente pedido A':order.notes; await screen.findByText(visibleText);
  if(kind==='customer-orders'){
   // Existing customer page has only explicit retry after an error. A session
   // revision triggers a new scoped read, whose denial must withdraw the row.
   read.mockRejectedValueOnce(new ApiError('Denied',403));act(()=>advanceChatbocSessionRevision());
  }else if(kind==='contacts'){read.mockRejectedValueOnce(new ApiError('Denied',403));fireEvent.click(screen.getByRole('button',{name:'Recargar'}));}
  else{
   read.mockRejectedValueOnce(new ApiError('Denied',403));act(()=>advanceChatbocSessionRevision());
  }
  await screen.findByRole('alert');expect(screen.queryByText(visibleText)).not.toBeInTheDocument();
 });
 it.each(['operator-orders','customer-orders'] as const)('retries %s failure as one GET and recovers without a mutation',async kind=>{
  const read=kind==='operator-orders'?runtime.adminOrders:runtime.orders;
  read.mockRejectedValueOnce(new Error('temporary'));render(tree(kind));await screen.findByRole('alert');
  const retry=defer();read.mockReturnValueOnce(retry.promise);const button=screen.getByRole('button',{name:'Reintentar'});fireEvent.click(button);fireEvent.click(button);
  expect(read).toHaveBeenCalledTimes(2);
  await act(async()=>{retry.resolve(kind==='operator-orders'?{orders:[],count:0,total:0,sources:[],summary:null}:[]);await retry.promise;});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(await screen.findByText(kind==='operator-orders'?'Sin pedidos':'No tenés pedidos registrados aún.')).toBeInTheDocument();
 });
 it.each(['contacts','operator-orders','customer-orders'] as const)('does not revive a loaded %s snapshot during A-B-A',async kind=>{
  const read=kind==='contacts'?runtime.contacts:kind==='operator-orders'?runtime.adminOrders:runtime.orders;
  const body=kind==='contacts'?{contacts:[contact]}:kind==='operator-orders'?{orders:[order],count:1,total:1,sources:[],summary:null}:[order];
  const visible=kind==='contacts'?contact.name:kind==='operator-orders'?'1 items • Cliente pedido A':order.notes;
  read.mockResolvedValueOnce(body);const view=render(tree(kind));await screen.findByText(visible);
  const b=defer(),again=defer();read.mockReturnValueOnce(b.promise).mockReturnValueOnce(again.promise);
  runtime.slug='synthetic-b';view.rerender(tree(kind));runtime.slug='synthetic-a';view.rerender(tree(kind));
  expect(screen.queryByText(visible)).not.toBeInTheDocument();
  await act(async()=>{b.resolve(kind==='contacts'?{contacts:[]}:kind==='operator-orders'?{orders:[],count:0,total:0,sources:[],summary:null}:[]);await b.promise;});
  expect(screen.queryByText(visible)).not.toBeInTheDocument();
  await act(async()=>{again.resolve(body);await again.promise;});await screen.findByText(visible);
 });
 it.each(['contacts','operator-orders','customer-orders'] as const)('suspends private %s reads without verified identity and recovers when verified',async kind=>{
  const read=kind==='contacts'?runtime.contacts:kind==='operator-orders'?runtime.adminOrders:runtime.orders;
  runtime.hasVerifiedSession=false;const view=render(tree(kind));expect(read).not.toHaveBeenCalled();
  runtime.hasVerifiedSession=true;runtime.user=null as any;view.rerender(tree(kind));expect(read).not.toHaveBeenCalled();
  runtime.user={id:'operator-a'};view.rerender(tree(kind));await waitFor(()=>expect(read).toHaveBeenCalledOnce());
  runtime.hasVerifiedSession=false;view.rerender(tree(kind));expect(read).toHaveBeenCalledOnce();
 });
 it('retires an operator mutation ACK and selection across A-B-A',async()=>{
  runtime.adminOrders.mockResolvedValueOnce({orders:[order],count:1,total:1,sources:[],summary:null});const view=render(tree('operator-orders'));
  await screen.findByRole('button',{name:'Abrir pedido order-a'});fireEvent.click(screen.getByRole('button',{name:'Abrir pedido order-a'}));
  const update=defer();runtime.update.mockReturnValueOnce(update.promise);fireEvent.click(screen.getByRole('button',{name:'Marcar Despachado'}));
  expect(runtime.update).toHaveBeenCalledOnce();
  const b=defer(),a=defer();runtime.adminOrders.mockReturnValueOnce(b.promise).mockReturnValueOnce(a.promise);
  runtime.slug='synthetic-b';view.rerender(tree('operator-orders'));runtime.slug='synthetic-a';view.rerender(tree('operator-orders'));
  await act(async()=>{update.resolve({...order,status:'shipped'});await update.promise;});
  expect(screen.queryByRole('button',{name:'Marcar Entregado'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Abrir pedido order-a'})).not.toBeInTheDocument();
  await act(async()=>{b.resolve({orders:[],count:0,total:0,sources:[],summary:null});a.resolve({orders:[],count:0,total:0,sources:[],summary:null});await Promise.all([b.promise,a.promise]);});
  expect(await screen.findByText('Sin pedidos')).toBeInTheDocument();
 });
 it('withdraws the manual order draft on session authority change',async()=>{
  render(tree('operator-orders'));await screen.findByText('Sin pedidos');
  fireEvent.change(screen.getByPlaceholderText('Buscar por cliente, WhatsApp, item, seguimiento o texto IA...'),{target:{value:'Borrador consulta'}});
  fireEvent.click(screen.getByRole('button',{name:'Crear Pedido'}));fireEvent.change(screen.getByPlaceholderText('Juan Pérez'),{target:{value:'Cliente borrador'}});
  expect(screen.getByPlaceholderText('Juan Pérez')).toHaveValue('Cliente borrador');
  act(()=>advanceChatbocSessionRevision());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Crear Pedido'}));expect(screen.getByPlaceholderText('Juan Pérez')).toHaveValue('');
 });
});
