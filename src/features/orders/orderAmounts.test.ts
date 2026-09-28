import { describe, expect, it } from 'vitest';
import { assessOrderAmounts, assessOrderItemAmounts, assessPublicOrderAmounts, assessPublicOrderItemAmounts, formatPublishedAmount, formatPublishedQuantity, publishedNonNegativeNumber, summarizeOrderAmounts } from './orderAmounts';
const reported = <T,>(value:T)=>({state:'reported' as const,value});
const missing = {state:'missing' as const,value:null};
describe('order amount evidence',()=>{
  it.each([0,10,0.25,'0','0.00','0010.2500',' 100.25 ','0.0000001'])('reads a canonical reported number %j without defaults',value=>{
    expect(publishedNonNegativeNumber(value)).toBe(Number(value));
  });
  it.each([null,undefined,'',true,false,[],{},'1,5','1.000,00','1e3','0x10','Infinity',NaN,Infinity,-1,'-1','9007199254740993','9007199254740991.01','0.10000000000000001',1e-30])('refuses an ambiguous or unsafe number %j',value=>{
    expect(publishedNonNegativeNumber(value)).toBeNull();
  });
  it('keeps zero, missing and conflicting totals distinct',()=>{
    expect(assessOrderAmounts({total:0}).total).toEqual(reported(0));
    expect(assessOrderAmounts({}).total).toEqual(missing);
    expect(assessOrderAmounts({total:0,totals:{monetary:100}}).total).toEqual({state:'conflicting',value:null});
  });
  it('accepts equal redundant total and currency aliases',()=>{
    expect(assessOrderAmounts({total:'125.50',currency:'usd',totals:{total:125.5,monetary:'125.500',currency:'USD'}})).toEqual({total:reported(125.5),currency:reported('USD')});
  });
  it('does not infer an order total or its currency from items',()=>{
    expect(assessOrderAmounts({items:[{subtotal:100,currency:'USD'},{subtotal:200,currency:'ARS'}]})).toEqual({total:missing,currency:missing});
  });
  it('does not replace an invalid primary amount with a valid alternative',()=>{
    expect(assessOrderAmounts({total:'invalid',totals:{monetary:100}}).total.state).toBe('invalid');
  });
  it('retains a reported discounted or free subtotal',()=>{
    expect(assessOrderItemAmounts({quantity:2,price:100,subtotal:170}).subtotal).toEqual(reported(170));
    expect(assessOrderItemAmounts({quantity:2,price:100,subtotal:0}).subtotal).toEqual(reported(0));
    expect(assessOrderItemAmounts({quantity:2,price:100}).subtotal).toEqual(missing);
  });
  it('inherits only a published order currency, never an inferred one',()=>{
    expect(assessOrderItemAmounts({},reported('USD')).currency).toEqual(reported('USD'));
    expect(assessOrderItemAmounts({}).currency).toEqual(missing);
    expect(assessOrderItemAmounts({currency:'EUR'},reported('USD')).currency).toEqual(reported('EUR'));
  });
  it('keeps a line-specific currency conflict instead of falling back to the order',()=>{
    expect(assessOrderItemAmounts({currency:'USD',currency_id:'ARS'},reported('USD')).currency.state).toBe('conflicting');
  });
  it('carries a conflicting order currency into lines that do not publish their own',()=>{
    const evidence=assessOrderAmounts({currency:'ARS',totals:{currency:'USD'}});
    expect(assessOrderItemAmounts({},evidence.currency).currency.state).toBe('conflicting');
  });
  it.each([{quantity:1,cantidad:2},{price:100,unit_price:200},{price:100,precio:'bad'}])('does not pick between inconsistent item fields %j',item=>{
    const evidence=assessOrderItemAmounts(item);
    expect([evidence.quantity.state,evidence.price.state]).toEqual(expect.arrayContaining([item.quantity!==undefined?'conflicting':item.precio?'invalid':'conflicting']));
  });
  it('uses public original unit price and discounted subtotal as different fields',()=>{
    const evidence=assessPublicOrderItemAmounts({cantidad:'2',precio_unitario_original:'100.00',subtotal_con_descuento:'170.00',moneda:'USD'});
    expect(evidence.price).toEqual(reported(100));expect(evidence.subtotal).toEqual(reported(170));
    expect(assessPublicOrderAmounts({monto_total:'175',moneda:'USD'})).toEqual({total:reported(175),currency:reported('USD')});
  });
  it('does not assume public order currency from a line',()=>{
    expect(assessPublicOrderAmounts({monto_total:100,detalles:[{moneda:'ARS'}]}).currency).toEqual(missing);
  });
  it('formats published currencies explicitly without converting',()=>{
    expect(formatPublishedAmount(reported(100),reported('USD'))).toContain('USD');
    expect(formatPublishedAmount(reported(100),reported('ARS'))).toContain('ARS');
    expect(formatPublishedAmount(reported(100),missing)).toBe('100 · Moneda no informada');
    expect(formatPublishedAmount(missing,reported('ARS'))).toBe('Importe no informado');
    expect(formatPublishedAmount({state:'conflicting',value:null},reported('ARS'))).toBe('Importe a revisar');
    expect(formatPublishedQuantity(reported(0))).toBe('0');
    expect(formatPublishedQuantity(missing)).toBe('Cantidad no informada');
  });
});

describe('loaded-order amount coverage',()=>{
  it('separates currencies and excludes missing or contradictory data',()=>{
    const rows=[{total:100,currency:'ARS'},{total:25,currency:'USD'},{total:0,currency:'USD'},{total:null,currency:'ARS'},{total:50},{total:100,currency:'USD',totals:{monetary:200}}];
    const summary=summarizeOrderAmounts(rows.map(row=>({amount_evidence:assessOrderAmounts(row)})));
    expect(summary).toMatchObject({totalCount:6,includedCount:3,missingCount:2,reviewCount:1});
    expect(summary.groups).toEqual([{currency:'ARS',count:1,label:'ARS 100,00'},{currency:'USD',count:2,label:'USD 25,00'}]);
  });
  it('adds decimals without binary rounding and preserves large grouped totals',()=>{
    const rows=[{total:0.1,currency:'USD'},{total:0.2,currency:'USD'},{total:9007199254740991,currency:'ARS'},{total:9007199254740991,currency:'ARS'}];
    const result=summarizeOrderAmounts(rows.map(row=>({amount_evidence:assessOrderAmounts(row)})));
    expect(result.groups).toEqual([{currency:'ARS',count:2,label:'ARS 18.014.398.509.481.982,00'},{currency:'USD',count:2,label:'USD 0,30'}]);
  });
  it('does not claim zero revenue for an empty population',()=>{
    expect(summarizeOrderAmounts([])).toMatchObject({totalCount:0,includedCount:0,groups:[]});
  });
});
