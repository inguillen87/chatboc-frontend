import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({fetch:vi.fn()}));
vi.mock('@/utils/api', async () => ({
  ...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'),
  apiFetch:(...args:unknown[])=>mocks.fetch(...args),
}));
import { apiClient } from './client';
const order=(patch:Record<string,unknown>={})=>({id:'market:42',tenant_slug:'qa-order',status:'confirmed',items:[{id:1,name:'Artículo'}],...patch});
beforeEach(()=>mocks.fetch.mockReset());
describe('published order amount integrity',()=>{
  it('does not invent a total, quantity, price, subtotal or currency',async()=>{
    mocks.fetch.mockResolvedValue(order());
    const result=await apiClient.adminGetOrder('qa-order','market:42');
    expect(result.total).toBeNull();
    expect(result.items[0]).toMatchObject({quantity:null,price:null,subtotal:null,currency:null});
  });
  it('does not substitute an item sum for a missing order total',async()=>{
    mocks.fetch.mockResolvedValue(order({items:[{id:1,quantity:2,price:100,subtotal:170,currency:'USD'}]}));
    const result=await apiClient.adminGetOrder('qa-order','market:42');
    expect(result.total).toBeNull();
    expect(result.items[0].subtotal).toBe(170);
  });
  it('preserves an explicit zero subtotal rather than multiplying quantity by price',async()=>{
    mocks.fetch.mockResolvedValue(order({total:0,totals:{currency:'USD'},items:[{quantity:2,price:100,subtotal:0}]}));
    const result=await apiClient.adminGetOrder('qa-order','market:42');
    expect(result.total).toBe(0);
    expect(result.items[0]).toMatchObject({quantity:2,price:100,subtotal:0,currency:'USD'});
  });
  it('does not select one of two contradictory published totals',async()=>{
    mocks.fetch.mockResolvedValue(order({total:100,totals:{monetary:200,currency:'ARS'}}));
    expect((await apiClient.adminGetOrder('qa-order','market:42')).total).toBeNull();
  });
  it.each(['',true,[],{},'1.234,56','1e3',Infinity,NaN,-1])('does not convert an invalid amount %j to zero or money',async total=>{
    mocks.fetch.mockResolvedValue(order({total}));
    expect((await apiClient.adminGetOrder('qa-order','market:42')).total).toBeNull();
  });
  it('handles the list and detail through the same amount rules',async()=>{
    mocks.fetch.mockResolvedValue({orders:[order()]});
    expect((await apiClient.adminListOrders('qa-order'))[0].total).toBeNull();
  });
});

describe('portal and update amount evidence',()=>{
  it('normalizes portal rows without inventing amounts and preserves the tenant scope',async()=>{
    mocks.fetch.mockResolvedValue([order()]);
    const rows=await apiClient.listOrders('qa-order');
    expect(rows[0].total).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledWith('/api/v1/portal/qa-order/orders',{tenantSlug:'qa-order'});
  });
  it('does not accept a supplied presentation-evidence object instead of amount fields',async()=>{
    mocks.fetch.mockResolvedValue(order({amount_evidence:{total:{state:'reported',value:99999},currency:{state:'reported',value:'USD'}}}));
    const row=await apiClient.adminGetOrder('qa-order','market:42');
    expect(row.total).toBeNull();expect(row.amount_evidence?.total.state).toBe('missing');
  });
  it('keeps a changed receipt amount separate from a status mutation payload',async()=>{
    mocks.fetch.mockResolvedValue(order({status:'shipped',total:0,totals:{currency:'USD'}}));
    const row=await apiClient.adminUpdateOrder('qa-order','market:42',{status:'shipped'});
    expect(row.total).toBe(0);expect(row.currency).toBe('USD');
    expect(mocks.fetch.mock.calls[0][1].body).toEqual({status:'shipped'});
  });
});
