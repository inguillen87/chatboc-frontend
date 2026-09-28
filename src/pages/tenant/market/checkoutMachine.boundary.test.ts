import {describe,expect,it} from 'vitest';
import {createInitialCheckoutState,hydrateCheckoutState,serializeCheckoutState,resolveCheckoutOutcome} from './checkoutMachine';
describe('checkout response provenance',()=>{
 it.each(['success','awaiting_payment','creating_order','error'])('never restores a locally claimed %s receipt',status=>{
  expect(hydrateCheckoutState({status,paymentUrl:'https://forged.example.test',message:'forged',orderId:'12',contact:{name:'private',phone:'private'}})).toEqual(createInitialCheckoutState());
 });
 it('does not serialize personal data or payment links',()=>{
  expect(serializeCheckoutState({...createInitialCheckoutState(),status:'success',paymentUrl:'https://pay.example.test',contact:{name:'private',phone:'123'}})).toEqual({});
 });
 it.each([{},null,{status:'confirmed'},{ok:false,status:'confirmed',order_id:12},{status:'failed',order_id:12},{status:'demo',order_id:12}])('never confirms an absent or rejected receipt %j',raw=>{
  const outcome=resolveCheckoutOutcome(raw as any);expect(outcome.status).toBe('error');expect(outcome.paymentUrl).toBeNull();
 });
 it.each(['javascript:alert(1)','data:text/html,test','http://pay.example.test','//pay.example.test','https://user:pass@pay.example.test','https://pay.example.test/\\unsafe'])('does not expose an unsafe payment URL %s',init_point=>{
  const outcome=resolveCheckoutOutcome({status:'pending',order_id:12,init_point});expect(outcome.paymentUrl).toBeNull();
 });
 it('accepts a provider preference receipt without fabricating an order id',()=>{
  const outcome=resolveCheckoutOutcome({preference_id:'pref-1',init_point:'https://pay.example.test'});
  expect(outcome.status).toBe('awaiting_payment');expect(outcome.orderId).toBeNull();
 });
 it('preserves distinct legacy and market order ids',()=>{
  expect(resolveCheckoutOutcome({estado:'confirmado',order_id:81,market_order_id:91}).orderId).toBe('91');
 });
 it('refuses contradictory payment URLs',()=>{
  expect(resolveCheckoutOutcome({status:'pending',order_id:12,checkoutUrl:'https://pay.example.test/1',init_point:'https://pay.example.test/2'}).paymentUrl).toBeNull();
 });
});

describe('backend pending-payment vocabulary',()=>{
 it.each(['pending_payment','pendiente_pago'])('keeps the published %s receipt pending without claiming payment',status=>{
  const result=resolveCheckoutOutcome({status,order_id:'81',market_order_id:91});
  expect(result.status).toBe('awaiting_payment');expect(result.orderId).toBe('91');expect(result.paymentUrl).toBeNull();
 });
});

describe('documented alternative session receipts',()=>{
 it('accepts an init_point-only checkout-session without fabricating order or preference ids',()=>{
  const result=resolveCheckoutOutcome({contract_version:'payments.checkout_session.v1',init_point:'https://checkout.example.test/session'});
  expect(result.status).toBe('awaiting_payment');expect(result.paymentUrl).toBe('https://checkout.example.test/session');expect(result.orderId).toBeNull();
 });
 it('accepts a preference-only checkout-session without inventing a payable link or order',()=>{
  const result=resolveCheckoutOutcome({contract_version:'payments.checkout_session.v1',preference_id:'pref-only'});
  expect(result.status).toBe('awaiting_payment');expect(result.paymentUrl).toBeNull();expect(result.orderId).toBeNull();
 });
 it('keeps an init_point-only session non-payable when commercial validation blocks payment',()=>{
  const result=resolveCheckoutOutcome({init_point:'https://checkout.example.test/session',amount_validated:false});
  expect(result.status).toBe('awaiting_payment');expect(result.paymentUrl).toBeNull();
 });
});
