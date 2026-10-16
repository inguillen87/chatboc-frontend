import React from 'react';
import type {Order} from '@/types/unified';
import {summarizeOrderAmounts} from '@/features/orders/orderAmounts';
import './orderAmounts.css';
export function OrderAmountCoverage({orders}:{orders:Order[]}) {
  const summary=summarizeOrderAmounts(orders);
  return <section className="order-amount-coverage" aria-label="Totales informados por moneda">
    <h2>Totales informados por moneda</h2>
    <p>Se agrupan {summary.includedCount} de {summary.totalCount} pedidos cargados. No son cobros confirmados ni el total histórico.</p>
    {summary.groups.length?<ul>{summary.groups.map(group=><li key={group.currency}><strong>{group.label}</strong><span>{group.count} {group.count===1?'pedido':'pedidos'}</span></li>)}</ul>:<p>No hay totales con importe y moneda informados.</p>}
    {summary.missingCount>0?<p>{summary.missingCount} sin importe o moneda: excluidos de las sumas.</p>:null}
    {summary.reviewCount>0?<p>{summary.reviewCount} con datos a revisar: excluidos de las sumas.</p>:null}
  </section>;
}
