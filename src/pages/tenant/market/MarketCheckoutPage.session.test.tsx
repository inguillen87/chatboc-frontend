import React from 'react';
import {act,fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useNavigate} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({preview:vi.fn(),start:vi.fn(),refresh:vi.fn(),cart:{} as Record<string,unknown>}));
vi.mock('@/context/MarketCartContext',()=>({MarketCartProvider:({children}:{children:React.ReactNode})=>children,useMarketCart:()=>mocks.cart}));
vi.mock('@/api/market',()=>({previewPaymentCheckout:mocks.preview,startMarketCheckout:mocks.start}));
vi.mock('@/utils/frontendTelemetry',()=>({trackFrontendEvent:vi.fn()}));
vi.unmock('react-router-dom');
import MarketCheckoutPage from './MarketCheckoutPage';
const accepted={status:'pending',preference_id:'pref-1',order_id:'81',init_point:'https://checkout.example.test/1',message:'Continuar por el proveedor'};
const deferred=<T,>()=>{let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let navigate:ReturnType<typeof useNavigate>;
function Fixture(){navigate=useNavigate();return <MarketCheckoutPage/>;}
const fixture=()=> <MemoryRouter initialEntries={['/org-a/checkout']}><Routes><Route path="/:tenant/checkout" element={<Fixture/>}/></Routes></MemoryRouter>;
const show=()=>render(fixture());
beforeEach(()=>{
 mocks.preview.mockReset();mocks.start.mockReset();mocks.refresh.mockReset();window.localStorage.clear();
 mocks.preview.mockResolvedValue({payment_required:true,payment_ready:true});mocks.start.mockResolvedValue(accepted);mocks.refresh.mockResolvedValue(undefined);
 mocks.cart={items:[{id:'1',name:'Producto QA',quantity:1,price:20}],totalAmount:20,totalPoints:0,isLoading:false,error:null,refreshCart:mocks.refresh,customerProfile:{name:'Cliente QA',phone:'12345'},commercialState:null,checkoutOptions:{requires_contact_or_auth:true},checkoutPreview:{contact_ready:true}};
});
afterEach(cleanup);
describe('checkout submission lifecycle',()=>{
 it('coalesces two synchronous clicks before React disables the button',async()=>{
  const pending=deferred<Record<string,unknown>>();mocks.preview.mockReturnValueOnce(pending.promise);show();
  const start=screen.getByRole('button',{name:'Iniciar checkout'});
  await act(async()=>{start.dispatchEvent(new MouseEvent('click',{bubbles:true}));start.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  expect(mocks.preview).toHaveBeenCalledOnce();expect(mocks.start).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Nombre')).toBeDisabled();expect(screen.getByLabelText('Teléfono')).toBeDisabled();
  await act(async()=>{pending.resolve({payment_ready:true});await pending.promise;});
  await screen.findByRole('link',{name:'Continuar al pago'});expect(mocks.start).toHaveBeenCalledOnce();
 });
 it('keeps an accepted response when refreshing the cart fails, without offering another submission',async()=>{
  mocks.refresh.mockRejectedValueOnce(new Error('Cart unavailable'));show();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  expect(await screen.findByRole('link',{name:'Continuar al pago'})).toHaveAttribute('href',accepted.init_point);
  await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(screen.queryByText('Cart unavailable')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Iniciar checkout'})).toBeDisabled();
 });
 it('does not restore a local payment URL, result or contact from another browser session',async()=>{
  localStorage.setItem('chatboc_market_checkout_state_org-a',JSON.stringify({status:'success',paymentUrl:'https://forged.example.test',message:'FORGED RECEIPT',orderId:'FORGED ORDER',contact:{name:'OTHER CUSTOMER',phone:'99999'}}));
  show();await waitFor(()=>expect(screen.getByLabelText('Nombre')).toHaveValue('Cliente QA'));
  expect(screen.queryByText('FORGED RECEIPT')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'Continuar al pago'})).not.toBeInTheDocument();
  expect(localStorage.getItem('chatboc_market_checkout_state_org-a')).toBeNull();expect(mocks.start).not.toHaveBeenCalled();
 });
 it('does not write checkout receipts or contact drafts into local storage',async()=>{
  show();fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'PRIVATE EDIT'}});fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  await screen.findByRole('link',{name:'Continuar al pago'});
  expect(localStorage.getItem('chatboc_market_checkout_state_org-a')).toBeNull();
 });
 it('does not submit after an obsolete preview completes in another organization',async()=>{
  const pending=deferred<Record<string,unknown>>();mocks.preview.mockReturnValueOnce(pending.promise);show();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  act(()=>navigate('/org-b/checkout'));await act(async()=>{pending.resolve({payment_ready:true});await pending.promise;});
  expect(mocks.start).not.toHaveBeenCalled();expect(screen.queryByRole('link',{name:'Continuar al pago'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Iniciar checkout'})).toBeEnabled();
 });
 it('discards an obsolete checkout result without touching the new organization cart',async()=>{
  const pending=deferred<typeof accepted>();mocks.start.mockReturnValueOnce(pending.promise);show();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  await waitFor(()=>expect(mocks.start).toHaveBeenCalledOnce());act(()=>navigate('/org-b/checkout'));
  await act(async()=>{pending.resolve(accepted);await pending.promise;});
  expect(screen.queryByRole('link',{name:'Continuar al pago'})).not.toBeInTheDocument();expect(mocks.refresh).not.toHaveBeenCalled();
 });
 it('can retry a failed preflight without having submitted an order',async()=>{
  mocks.preview.mockRejectedValueOnce(new Error('PRIVATE PREVIEW BODY'));show();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  const retry=await screen.findByRole('button',{name:'Reintentar'});expect(mocks.start).not.toHaveBeenCalled();expect(screen.queryByText('PRIVATE PREVIEW BODY')).not.toBeInTheDocument();
  fireEvent.click(retry);expect(mocks.preview).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  await screen.findByRole('link',{name:'Continuar al pago'});expect(mocks.start).toHaveBeenCalledOnce();
 });
 it('does not re-submit automatically or via retry after an uncertain order write',async()=>{
  mocks.start.mockRejectedValueOnce(new Error('PRIVATE START BODY'));show();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  await screen.findByText('No pudimos iniciar el checkout');
  expect(screen.queryByText('PRIVATE START BODY')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Iniciar checkout'})).toBeDisabled();expect(mocks.start).toHaveBeenCalledOnce();
 });
});

describe('checkout changes during preflight',()=>{
 it.each(['items','blocked','loading'])('does not create an order when the cart becomes %s during preview',async condition=>{
  const pending=deferred<Record<string,unknown>>();mocks.preview.mockReturnValueOnce(pending.promise);const view=show();
  fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  if(condition==='items')mocks.cart={...mocks.cart,items:[{id:'2',quantity:2,price:50,name:'Changed product'}]};
  if(condition==='blocked')mocks.cart={...mocks.cart,checkoutOptions:{payment_required:true,payment_ready:false}};
  if(condition==='loading')mocks.cart={...mocks.cart,isLoading:true};
  view.rerender(fixture());await act(async()=>{pending.resolve({payment_ready:true});await pending.promise;});
  expect(mocks.start).not.toHaveBeenCalled();expect(screen.getByText('No pudimos iniciar el checkout')).toBeInTheDocument();
 });
 it('does not promote an empty API response to a successful order',async()=>{
  mocks.start.mockResolvedValueOnce({});show();fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  await screen.findByText('No pudimos iniciar el checkout');expect(screen.queryByRole('link',{name:'Continuar al pago'})).not.toBeInTheDocument();
  expect(screen.queryByText('Checkout iniciado')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Iniciar checkout'})).toBeDisabled();
 });
 it('uses form submission and moves keyboard focus to the result',async()=>{
  show();fireEvent.submit(screen.getByRole('form',{name:'Datos de contacto'}));
  const link=await screen.findByRole('link',{name:'Continuar al pago'});expect(link).toHaveAttribute('rel','noopener noreferrer');
  await waitFor(()=>expect(screen.getByTestId('checkout-outcome')).toHaveFocus());expect(mocks.start).toHaveBeenCalledOnce();
 });
 it('keeps checkout disabled until the cart read finishes',()=>{
  mocks.cart={...mocks.cart,isLoading:true};show();expect(screen.getByRole('button',{name:'Iniciar checkout'})).toBeDisabled();
  fireEvent.submit(screen.getByRole('form',{name:'Datos de contacto'}));expect(mocks.preview).not.toHaveBeenCalled();
 });
 it('works in StrictMode without launching work from discarded effects',async()=>{
  render(<React.StrictMode>{fixture()}</React.StrictMode>);fireEvent.click(screen.getByRole('button',{name:'Iniciar checkout'}));
  await screen.findByRole('link',{name:'Continuar al pago'});expect(mocks.preview).toHaveBeenCalledOnce();expect(mocks.start).toHaveBeenCalledOnce();
 });
});
