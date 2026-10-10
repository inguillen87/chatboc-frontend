import {describe,expect,it} from 'vitest';
import {normalizeWidgetOrders} from './widgetPortal';
const history=(order:Record<string,unknown>)=>({orders:[{id:'42',...order}]}) as Parameters<typeof normalizeWidgetOrders>[0];
describe('widget portal reported amounts',()=>{
 it('preserves currency and discounts reported on the order and its items',()=>{
  const [order]=normalizeWidgetOrders(history({monto_total:'175',moneda:'USD',items:[{id:'1',name:'Producto',qty:'2',price:'100',subtotal:170}]}));
  expect(order.amount_evidence?.total.value).toBe(175);expect(order.amount_evidence?.currency.value).toBe('USD');
  expect(order.items[0].amount_evidence?.subtotal.value).toBe(170);expect(order.items[0].amount_evidence?.currency.value).toBe('USD');
 });
 it('does not turn missing prices into free products or unknown currencies into pesos',()=>{
  const [order]=normalizeWidgetOrders(history({items:[{id:'1',name:'Producto'}]}));
  expect(order.amountTotal).toBeUndefined();expect(order.amount_evidence?.currency.state).toBe('missing');
  expect(order.items[0].amount_evidence?.quantity.state).toBe('missing');
 });
 it('rejects contradictory order and item aliases',()=>{
  const [order]=normalizeWidgetOrders(history({total:175,monto_total:999,items:[{id:'1',qty:1,quantity:2}]}));
  expect(order.amount_evidence?.total.state).toBe('conflicting');expect(order.items[0].amount_evidence?.quantity.state).toBe('conflicting');
 });
});
