import React from 'react';
import type { Order } from '@/types/unified';
import type { OrderAmountEvidence, OrderItemAmountEvidence } from '@/types/orderAmounts';
import { formatPublishedAmount, formatPublishedQuantity, orderAmountEvidence, orderItemAmountEvidence } from '@/features/orders/orderAmounts';
import './orderAmounts.css';

export interface PublishedOrderAmountRow { name: string; sku?: string; evidence: OrderItemAmountEvidence }
export function PublishedOrderAmounts({evidence, rows, showTotal=true}: {
  evidence: OrderAmountEvidence; rows: PublishedOrderAmountRow[]; showTotal?: boolean;
}) {
  const values = [...(showTotal ? [evidence.total,evidence.currency] : []), ...rows.flatMap(row=>Object.values(row.evidence))];
  const review = values.some(value=>value.state==='invalid'||value.state==='conflicting');
  const incomplete = values.some(value=>value.state==='missing');
  return <section className="order-amounts" aria-label="Importes publicados del pedido">
    {review ? <p className="order-amounts-notice" role="status">Hay importes o monedas que requieren revisión. No se eligió un valor entre datos contradictorios.</p>
      : incomplete ? <p className="order-amounts-notice">Los datos no informados no equivalen a cero. No se calculan importes faltantes.</p> : null}
    {rows.length ? <ul className="order-amounts-lines">{rows.map((row,index)=><li key={index}>
      <p className="order-amounts-name">{row.name}</p>
      {row.sku ? <p className="order-amounts-sku">SKU: {row.sku}</p> : null}
      <dl>
        <div><dt>Cantidad</dt><dd data-amount-state={row.evidence.quantity.state}>{formatPublishedQuantity(row.evidence.quantity)}</dd></div>
        <div><dt>Precio unitario informado</dt><dd data-amount-state={row.evidence.price.state}>{formatPublishedAmount(row.evidence.price,row.evidence.currency)}</dd></div>
        <div><dt>Subtotal informado</dt><dd data-amount-state={row.evidence.subtotal.state}>{formatPublishedAmount(row.evidence.subtotal,row.evidence.currency)}</dd></div>
      </dl>
    </li>)}</ul> : <p className="order-amounts-empty">No hay artículos publicados en esta respuesta.</p>}
    {showTotal ? <dl className="order-amounts-total"><div><dt>Total informado</dt><dd data-testid="order-published-total" data-amount-state={evidence.total.state}>{formatPublishedAmount(evidence.total,evidence.currency)}</dd></div></dl> : null}
  </section>;
}
export function OrderAmountBreakdown({order,showTotal=true}: {order:Order;showTotal?:boolean}) {
  const evidence = orderAmountEvidence(order);
  return <PublishedOrderAmounts evidence={evidence} showTotal={showTotal} rows={order.items.map(item=>({
    name:item.name,sku:item.sku,evidence:orderItemAmountEvidence(item,evidence.currency),
  }))} />;
}
